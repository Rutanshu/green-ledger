"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { checkBindingHealth } from "@/lib/factors";
import { activateProfile, supersedeProfile } from "@/lib/factors/impactProfile";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import type { UnitDimension } from "@/lib/units";
import {
  parseFormula, checkFormulaDimension, extractDependencies, checkForCycle,
  dimensionOfBase, DIMENSIONLESS, formatDimension, FormulaSyntaxError, DimensionMismatchError, CycleError,
  type Dimension,
} from "@/lib/formula";

type ActionState = { ok: boolean; error?: string } | null;

async function requireBuilder() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Not signed in." as const };
  if (!can(membership.role, "manage_questionnaire")) {
    return { error: `Your role can't edit the questionnaire.` as const };
  }
  return { membership };
}

// ---------- templates ----------

const TemplateInput = z.object({
  name: z.string().min(1, "Give the template a name."),
});

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = TemplateInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const orgId = auth.membership.org.id;
  const template = await withOrgTransaction(orgId, async (tx) => {
    const t = await tx.questionnaireTemplate.create({
      data: { organizationId: orgId, name: parsed.data.name, version: 1, status: "DRAFT" },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "QuestionnaireTemplate",
      entityId: t.id,
      after: t,
    });
    return t;
  });

  revalidatePath("/builder");
  redirect(`/builder/${template.id}`);
}

export async function publishTemplate(templateId: string): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const template = await db.questionnaireTemplate.findFirst({
    where: { id: templateId },
    include: {
      sections: {
        include: {
          questions: { include: { binding: true } },
          items: { include: { position: { include: { binding: true } } } },
        },
      },
    },
  });
  if (!template) return { ok: false, error: "Template not found." };

  const boundQuestions = template.sections
    .flatMap((s) => s.questions)
    .filter((q): q is typeof q & { binding: NonNullable<typeof q.binding> } => q.binding !== null)
    .map((q) => ({ code: q.code, binding: q.binding }));
  // A position referenced from several sections of the SAME template would
  // otherwise be health-checked and snapshotted once per reference — dedupe
  // by position id first, since it's genuinely one storage slot.
  const boundPositions = [...new Map(
    template.sections
      .flatMap((s) => s.items)
      .filter((i): i is typeof i & { position: typeof i.position & { binding: NonNullable<typeof i.position.binding> } } => i.position.binding !== null)
      .map((i) => [i.position.id, { code: i.position.positionCode, binding: i.position.binding }] as const),
  ).values()];
  const allBound = [...boundQuestions, ...boundPositions];

  // CLAUDE.md rule 9: a question cannot be published with a broken or
  // ambiguous factor binding. A form that silently records zeros is the
  // worst possible bug in this product — so this is a hard gate, not a
  // warning, and it re-checks live rather than trusting a stale health
  // column that might predate the question's last edit.
  const boundFuelCodes = [...new Set(allBound.map(({ binding: b }) => b.fuelOrMaterialCode))];
  const [factorSets, site] = await Promise.all([
    // Scoped to fuels this template actually binds to — see
    // data-collection/actions.ts for why an unfiltered fetch doesn't scale.
    db.emissionFactorSet.findMany({ include: { factors: { where: { fuelOrMaterialCode: { in: boundFuelCodes } } } } }),
    db.site.findFirst({ orderBy: { code: "asc" } }),
  ]);
  const candidates = buildFactorCandidates(factorSets);

  const broken: string[] = [];
  for (const { binding: b } of allBound) {
    if (!site) break;
    const bases: Array<"LOCATION_BASED" | "MARKET_BASED" | undefined> =
      b.outputBasis === "DUAL" ? ["LOCATION_BASED", "MARKET_BASED"] : [undefined];
    for (const basis of bases) {
      const result = checkBindingHealth(candidates, {
        activityType: b.activityType,
        method: b.method,
        fuelOrMaterialCode: b.fuelOrMaterialCode,
        basis,
        regionStrategy: b.regionStrategy,
        fixedRegion: b.fixedRegion,
        siteCountry: site.country,
        siteGridRegion: site.gridRegion,
        on: new Date(),
      });
      if (result.health === "BROKEN" || result.health === "AMBIGUOUS") broken.push(b.fuelOrMaterialCode);
    }
  }
  if (broken.length > 0) {
    return {
      ok: false,
      error: `Can't publish yet — ${[...new Set(broken)].join(", ")} ${broken.length > 1 ? "have" : "has"} no emission factor linked. Fix ${broken.length > 1 ? "them" : "it"} in Factor Lab first.`,
    };
  }

  await withOrgTransaction(orgId, async (tx) => {
    const updated = await tx.questionnaireTemplate.update({
      where: { id: templateId },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: auth.membership.user.id },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "APPROVE",
      entityType: "QuestionnaireTemplate",
      entityId: templateId,
      after: updated,
    });

    // CLAUDE.md rule 3 / GHG_TOOL_ARCHITECTURE.md §20: publishing snapshots
    // every live binding into a new, immutable ImpactProfile version — the
    // audit trail answering "what did our factor bindings look like the day
    // we published this questionnaire" independent of FactorBinding's own,
    // separately editable, live state.
    const prevActive = await tx.impactProfile.findFirst({ where: { organizationId: orgId, status: "ACTIVE" } });
    if (prevActive) {
      await tx.impactProfile.update({
        where: { id: prevActive.id },
        data: { status: supersedeProfile(prevActive.status as "ACTIVE"), supersededAt: new Date() },
      });
    }
    const lastVersion = await tx.impactProfile.findFirst({
      where: { organizationId: orgId, name: template.name },
      orderBy: { version: "desc" },
    });
    const profile = await tx.impactProfile.create({
      data: {
        organizationId: orgId,
        name: template.name,
        version: (lastVersion?.version ?? 0) + 1,
        status: activateProfile("DRAFT"),
        activatedAt: new Date(),
        assignments: {
          create: allBound.map(({ code, binding: b }) => ({
            positionCode: code,
            scope: b.scope,
            scope3Category: b.scope3Category,
            activityType: b.activityType,
            method: b.method,
            fuelOrMaterialCode: b.fuelOrMaterialCode,
            regionStrategy: b.regionStrategy,
            outputBasis: b.outputBasis,
          })),
        },
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "ImpactProfile",
      entityId: profile.id,
      after: profile,
    });
  });

  revalidatePath(`/builder/${templateId}`);
  revalidatePath("/builder");
  revalidatePath("/");
  return { ok: true };
}

// ---------- sections ----------

const SectionInput = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1, "Give the section a title."),
  scope: z.enum(["SCOPE_1", "SCOPE_2", "SCOPE_3"]),
  scope3Category: z.coerce.number().int().min(1).max(15).optional().or(z.literal("").transform(() => undefined)),
});

export async function createSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = SectionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);
  const template = await db.questionnaireTemplate.findFirst({
    where: { id: parsed.data.templateId },
    include: { sections: true },
  });
  if (!template) return { ok: false, error: "Template not found." };

  await withOrgTransaction(orgId, async (tx) => {
    const section = await tx.questionnaireSection.create({
      data: {
        templateId: template.id,
        title: parsed.data.title,
        scope: parsed.data.scope,
        scope3Category: parsed.data.scope3Category ?? null,
        sortOrder: template.sections.length,
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "QuestionnaireSection",
      entityId: section.id,
      after: section,
    });
  });

  revalidatePath(`/builder/${parsed.data.templateId}`);
  return { ok: true };
}

export async function deleteSection(sectionId: string) {
  const auth = await requireBuilder();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const section = await db.questionnaireSection.findFirst({ where: { id: sectionId } });
  if (!section) return;

  await withOrgTransaction(orgId, async (tx) => {
    await tx.questionnaireSection.delete({ where: { id: sectionId } });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "DELETE",
      entityType: "QuestionnaireSection",
      entityId: sectionId,
      before: section,
    });
  });

  revalidatePath(`/builder/${section.templateId}`);
}

// ---------- questions (the "custom fields") ----------

const QuestionInput = z.object({
  sectionId: z.string().min(1),
  code: z.string().regex(/^[a-z][a-z0-9_]*$/, "Code must be lowercase_with_underscores, starting with a letter."),
  label: z.string().min(1, "Give the question a label."),
  helpText: z.string().optional(),
  inputType: z.enum(["NUMBER_WITH_UNIT", "NUMBER", "TEXT", "SINGLE_SELECT", "MULTI_SELECT", "DATE", "BOOLEAN", "INDICATOR"]),
  unitDimension: z.string().optional(),
  allowedUnits: z.array(z.string()).optional(),
  options: z.string().optional(), // comma-separated, for SINGLE_SELECT/MULTI_SELECT
  isRequired: z.coerce.boolean().optional(),
  formula: z.string().optional(), // INDICATOR only
});

/**
 * A question is a valid formula dependency only if it has a known,
 * numeric dimension: NUMBER_WITH_UNIT (its real unitDimension), NUMBER
 * (dimensionless), or another INDICATOR (its checked computedDimensionJson).
 * Anything else (TEXT, BOOLEAN, a select...) has no numeric value to
 * compute with and is excluded from the lookup entirely, so referencing
 * one is reported as "unknown identifier" rather than silently coercing it.
 */
function buildIdentifierDimensions(
  templateQuestions: readonly { code: string; inputType: string; unitDimension: string | null; computedDimensionJson: unknown }[],
): Record<string, Dimension> {
  const out: Record<string, Dimension> = {};
  for (const q of templateQuestions) {
    if (q.inputType === "NUMBER_WITH_UNIT" && q.unitDimension) {
      out[q.code] = dimensionOfBase(q.unitDimension as UnitDimension);
    } else if (q.inputType === "NUMBER") {
      out[q.code] = DIMENSIONLESS;
    } else if (q.inputType === "INDICATOR" && q.computedDimensionJson) {
      out[q.code] = q.computedDimensionJson as Dimension;
    }
  }
  return out;
}

/**
 * Parses, dimension-checks and cycle-checks a candidate indicator formula
 * against every OTHER question already in the template — "a cycle is
 * rejected at save time, not discovered mid-calculation" and "kWh + L is
 * rejected at parse time" (GHG_TOOL_ARCHITECTURE.md §10). Never persists
 * anything; the caller does that only once this returns ok.
 */
function validateIndicatorFormula(
  code: string,
  formulaSource: string,
  templateQuestions: readonly {
    code: string;
    inputType: string;
    unitDimension: string | null;
    formula: string | null;
    computedDimensionJson: unknown;
  }[],
): { ok: true; dimension: Dimension } | { ok: false; error: string } {
  let ast;
  try {
    ast = parseFormula(formulaSource);
  } catch (err) {
    return { ok: false, error: err instanceof FormulaSyntaxError ? err.message : "Invalid formula." };
  }

  const deps = extractDependencies(ast);
  const known = new Set(templateQuestions.map((q) => q.code));
  const missing = deps.filter((d) => !known.has(d));
  if (missing.length > 0) {
    return { ok: false, error: `Formula references unknown question(s) in this template: ${missing.join(", ")}.` };
  }

  // Cycle check: every existing indicator's own dependencies, plus this
  // candidate's, as one edge set.
  const edges = new Map<string, string[]>();
  for (const q of templateQuestions) {
    if (q.inputType === "INDICATOR" && q.formula) {
      try {
        edges.set(q.code, extractDependencies(parseFormula(q.formula)));
      } catch {
        edges.set(q.code, []); // an already-broken existing formula shouldn't block validating a new one
      }
    }
  }
  edges.set(code, deps);
  try {
    checkForCycle(edges);
  } catch (err) {
    return { ok: false, error: err instanceof CycleError ? err.message : "Formula dependency cycle." };
  }

  const identifierDimension = buildIdentifierDimensions(templateQuestions);
  try {
    const dimension = checkFormulaDimension(ast, identifierDimension);
    return { ok: true, dimension };
  } catch (err) {
    return { ok: false, error: err instanceof DimensionMismatchError ? err.message : (err as Error).message };
  }
}

export async function createQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };

  const raw = Object.fromEntries(formData);
  const parsed = QuestionInput.safeParse({
    ...raw,
    allowedUnits: formData.getAll("allowedUnits"),
    isRequired: formData.get("isRequired") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (d.inputType === "NUMBER_WITH_UNIT" && (!d.unitDimension || !d.allowedUnits?.length)) {
    return { ok: false, error: "A number-with-unit question needs a dimension and at least one allowed unit." };
  }
  if ((d.inputType === "SINGLE_SELECT" || d.inputType === "MULTI_SELECT") && !d.options?.trim()) {
    return { ok: false, error: "Give at least one option (comma-separated)." };
  }
  if (d.inputType === "INDICATOR" && !d.formula?.trim()) {
    return { ok: false, error: "An indicator needs a formula." };
  }

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);
  const section = await db.questionnaireSection.findFirst({
    where: { id: d.sectionId },
    include: { questions: true, template: { include: { sections: { include: { questions: true } } } } },
  });
  if (!section) return { ok: false, error: "Section not found." };
  const templateQuestions = section.template.sections.flatMap((s) => s.questions);
  if (templateQuestions.some((q) => q.code === d.code)) {
    return { ok: false, error: `Code "${d.code}" is already used in this template.` };
  }

  const options =
    d.inputType === "SINGLE_SELECT" || d.inputType === "MULTI_SELECT"
      ? d.options!.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ code: v, label: v }))
      : undefined;

  let indicatorDimension: Dimension | null = null;
  if (d.inputType === "INDICATOR") {
    const result = validateIndicatorFormula(d.code, d.formula!, templateQuestions);
    if (!result.ok) return { ok: false, error: result.error };
    indicatorDimension = result.dimension;
  }

  const question = await withOrgTransaction(orgId, async (tx) => {
    const q = await tx.question.create({
      data: {
        sectionId: section.id,
        code: d.code,
        label: d.label,
        helpText: d.helpText || null,
        inputType: d.inputType,
        unitDimension: d.inputType === "NUMBER_WITH_UNIT" ? (d.unitDimension as UnitDimension) : null,
        allowedUnits: d.inputType === "NUMBER_WITH_UNIT" ? (d.allowedUnits as never[]) : [],
        options: options ?? undefined,
        isRequired: d.inputType === "INDICATOR" ? false : (d.isRequired ?? true),
        sortOrder: section.questions.length,
        formula: d.inputType === "INDICATOR" ? d.formula : null,
        computedDimension: indicatorDimension ? formatDimension(indicatorDimension) : null,
        computedDimensionJson: indicatorDimension ?? undefined,
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "Question",
      entityId: q.id,
      after: q,
    });
    return q;
  });

  revalidatePath(`/builder/${section.templateId}`);
  return { ok: true };
}

export async function deleteQuestion(questionId: string) {
  const auth = await requireBuilder();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const question = await db.question.findFirst({ where: { id: questionId }, include: { section: true } });
  if (!question) return;

  await withOrgTransaction(orgId, async (tx) => {
    await tx.question.delete({ where: { id: questionId } });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "DELETE",
      entityType: "Question",
      entityId: questionId,
      before: question,
    });
  });

  revalidatePath(`/builder/${question.section.templateId}`);
}

// ---------- section items (positions, referenced not owned) ----------

const AddPositionInput = z.object({
  sectionId: z.string().min(1),
  positionId: z.string().min(1, "Choose a position."),
});

/**
 * A questionnaire REFERENCES an existing global position — it never
 * creates a new one. The same position can be added to any number of
 * sections/templates and is still one storage slot (BUILD_PLAN Step 2.2
 * acceptance criterion) — @@unique([sectionId, positionId]) only stops it
 * being added twice to the SAME section, not reused elsewhere.
 */
export async function addPositionToSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = AddPositionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const section = await db.questionnaireSection.findFirst({
    where: { id: d.sectionId, template: { organizationId: orgId } },
    include: { template: true },
  });
  if (!section) return { ok: false, error: "Section not found." };

  const position = await db.position.findFirst({ where: { id: d.positionId } });
  if (!position) return { ok: false, error: "Position not found." };

  const existing = await db.questionnaireSectionItem.findFirst({ where: { sectionId: d.sectionId, positionId: d.positionId } });
  if (existing) return { ok: false, error: `${position.positionCode} is already in this section.` };

  await withOrgTransaction(orgId, async (tx) => {
    const count = await tx.questionnaireSectionItem.count({ where: { sectionId: d.sectionId } });
    const item = await tx.questionnaireSectionItem.create({
      data: { sectionId: d.sectionId, positionId: d.positionId, sortOrder: count },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "QuestionnaireSectionItem",
      entityId: item.id,
      after: item,
    });
  });

  revalidatePath(`/builder/${section.templateId}`);
  return { ok: true };
}

export async function removeSectionItem(itemId: string) {
  const auth = await requireBuilder();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const item = await db.questionnaireSectionItem.findFirst({
    where: { id: itemId, section: { template: { organizationId: orgId } } },
    include: { section: true },
  });
  if (!item) return;

  await withOrgTransaction(orgId, async (tx) => {
    await tx.questionnaireSectionItem.delete({ where: { id: itemId } });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "DELETE",
      entityType: "QuestionnaireSectionItem",
      entityId: itemId,
      before: item,
    });
  });

  revalidatePath(`/builder/${item.section.templateId}`);
}

// ---------- factor bindings ----------

const BindingInput = z.object({
  questionId: z.string().optional(),
  positionId: z.string().optional(),
  scope: z.enum(["SCOPE_1", "SCOPE_2", "SCOPE_3"]),
  scope3Category: z.coerce.number().int().min(1).max(15).optional().or(z.literal("").transform(() => undefined)),
  activityType: z.enum([
    "STATIONARY_COMBUSTION", "MOBILE_COMBUSTION", "FUGITIVE", "PROCESS", "PURCHASED_ELECTRICITY",
    "PURCHASED_HEAT", "PURCHASED_STEAM", "PURCHASED_COOLING", "SPEND", "DISTANCE", "MASS", "WASTE", "OTHER",
  ]),
  method: z.enum([
    "FUEL_BASED", "DISTANCE_BASED", "SPEND_BASED", "AVERAGE_DATA",
    "SUPPLIER_SPECIFIC", "WASTE_TYPE_SPECIFIC", "MATERIAL_BASED", "HYBRID",
  ]),
  fuelOrMaterialCode: z.string().min(1, "Fuel / material code is required."),
  regionStrategy: z.enum(["SITE_COUNTRY_THEN_GRID_THEN_GLOBAL", "SITE_GRID_ONLY", "FIXED_REGION", "GLOBAL_ONLY"]),
  outputBasis: z.enum(["SINGLE", "DUAL"]),
});

export async function upsertBinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requireBuilder();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = BindingInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (!d.questionId && !d.positionId) return { ok: false, error: "No target for this binding." };

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const question = d.questionId
    ? await db.question.findFirst({
        where: { id: d.questionId, section: { template: { organizationId: orgId } } },
        include: { binding: true, section: { select: { templateId: true } } },
      })
    : null;
  const position = d.positionId
    ? await db.position.findFirst({ where: { id: d.positionId }, include: { binding: true } })
    : null;
  if (d.questionId && !question) return { ok: false, error: "Question not found." };
  if (d.positionId && !position) return { ok: false, error: "Position not found." };

  // A position-bound item's template comes through the section it's
  // referenced from, not through ownership (it may be referenced from
  // several) — revalidate whichever section triggered this save.
  const templateIdForRevalidate = question
    ? question.section.templateId
    : (await db.questionnaireSectionItem.findFirst({ where: { positionId: d.positionId! }, select: { section: { select: { templateId: true } } } }))
        ?.section.templateId;

  // Compute real health immediately — same logic Factor Lab's "Test
  // binding" uses — so a newly-bound question never shows a stale/unknown
  // state, and the builder can warn before the user even tries to publish.
  const [factorSets, site] = await Promise.all([
    // Scoped to this one binding's fuel — see data-collection/actions.ts.
    db.emissionFactorSet.findMany({ include: { factors: { where: { fuelOrMaterialCode: d.fuelOrMaterialCode } } } }),
    db.site.findFirst({ orderBy: { code: "asc" } }),
  ]);
  const candidates = buildFactorCandidates(factorSets);
  const rank = { OK: 0, FALLBACK_REGION: 1, AMBIGUOUS: 2, BROKEN: 3 } as const;
  let worst: { health: keyof typeof rank; message: string | null } = { health: "OK", message: null };
  if (site) {
    const bases: Array<"LOCATION_BASED" | "MARKET_BASED" | undefined> =
      d.outputBasis === "DUAL" ? ["LOCATION_BASED", "MARKET_BASED"] : [undefined];
    for (const basis of bases) {
      const result = checkBindingHealth(candidates, {
        activityType: d.activityType,
        method: d.method,
        fuelOrMaterialCode: d.fuelOrMaterialCode,
        basis,
        regionStrategy: d.regionStrategy,
        siteCountry: site.country,
        siteGridRegion: site.gridRegion,
        on: new Date(),
      });
      if (rank[result.health] > rank[worst.health]) worst = result;
    }
  }

  const bindingWhere = question ? { questionId: d.questionId! } : { positionId: d.positionId! };
  const previousBinding = question ? question.binding : position!.binding;

  await withOrgTransaction(orgId, async (tx) => {
    const binding = await tx.factorBinding.upsert({
      where: bindingWhere,
      create: {
        questionId: d.questionId ?? null,
        positionId: d.positionId ?? null,
        scope: d.scope,
        scope3Category: d.scope3Category ?? null,
        activityType: d.activityType,
        method: d.method,
        fuelOrMaterialCode: d.fuelOrMaterialCode,
        regionStrategy: d.regionStrategy,
        outputBasis: d.outputBasis,
        health: worst.health,
        healthMessage: worst.message,
        healthCheckedAt: new Date(),
      },
      update: {
        scope: d.scope,
        scope3Category: d.scope3Category ?? null,
        activityType: d.activityType,
        method: d.method,
        fuelOrMaterialCode: d.fuelOrMaterialCode,
        regionStrategy: d.regionStrategy,
        outputBasis: d.outputBasis,
        health: worst.health,
        healthMessage: worst.message,
        healthCheckedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: previousBinding ? "UPDATE" : "CREATE",
      entityType: "FactorBinding",
      entityId: binding.id,
      before: previousBinding,
      after: binding,
    });
  });

  if (templateIdForRevalidate) revalidatePath(`/builder/${templateIdForRevalidate}`);
  return {
    ok: true,
    error: worst.health === "BROKEN" || worst.health === "AMBIGUOUS" ? `Bound, but health is ${worst.health}: ${worst.message}` : undefined,
  };
}
