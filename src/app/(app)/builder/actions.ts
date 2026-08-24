"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { checkBindingHealth } from "@/lib/factors";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import type { UnitDimension } from "@/lib/units";

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
    include: { sections: { include: { questions: { include: { binding: true } } } } },
  });
  if (!template) return { ok: false, error: "Template not found." };

  // CLAUDE.md rule 9: a question cannot be published with a broken or
  // ambiguous factor binding. A form that silently records zeros is the
  // worst possible bug in this product — so this is a hard gate, not a
  // warning, and it re-checks live rather than trusting a stale health
  // column that might predate the question's last edit.
  const [factorSets, site] = await Promise.all([
    db.emissionFactorSet.findMany({ include: { factors: true } }),
    db.site.findFirst({ orderBy: { code: "asc" } }),
  ]);
  const candidates = buildFactorCandidates(factorSets);

  const bindings = template.sections.flatMap((s) => s.questions).map((q) => q.binding).filter((b) => b !== null);
  const broken: string[] = [];
  for (const b of bindings) {
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
    return { ok: false, error: `Can't publish — broken/ambiguous binding on: ${[...new Set(broken)].join(", ")}. Fix in Factor Lab first.` };
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
  inputType: z.enum(["NUMBER_WITH_UNIT", "NUMBER", "TEXT", "SINGLE_SELECT", "MULTI_SELECT", "DATE", "BOOLEAN"]),
  unitDimension: z.string().optional(),
  allowedUnits: z.array(z.string()).optional(),
  options: z.string().optional(), // comma-separated, for SINGLE_SELECT/MULTI_SELECT
  isRequired: z.coerce.boolean().optional(),
});

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

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);
  const section = await db.questionnaireSection.findFirst({
    where: { id: d.sectionId },
    include: { questions: true },
  });
  if (!section) return { ok: false, error: "Section not found." };
  if (section.questions.some((q) => q.code === d.code)) {
    return { ok: false, error: `Code "${d.code}" is already used in this section.` };
  }

  const options =
    d.inputType === "SINGLE_SELECT" || d.inputType === "MULTI_SELECT"
      ? d.options!.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ code: v, label: v }))
      : undefined;

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
        isRequired: d.isRequired ?? true,
        sortOrder: section.questions.length,
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

// ---------- factor bindings ----------

const BindingInput = z.object({
  questionId: z.string().min(1),
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

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);
  const question = await db.question.findFirst({
    where: { id: d.questionId, section: { template: { organizationId: orgId } } },
    include: { binding: true, section: { select: { templateId: true } } },
  });
  if (!question) return { ok: false, error: "Question not found." };

  // Compute real health immediately — same logic Factor Lab's "Test
  // binding" uses — so a newly-bound question never shows a stale/unknown
  // state, and the builder can warn before the user even tries to publish.
  const [factorSets, site] = await Promise.all([
    db.emissionFactorSet.findMany({ include: { factors: true } }),
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

  await withOrgTransaction(orgId, async (tx) => {
    const binding = await tx.factorBinding.upsert({
      where: { questionId: d.questionId },
      create: {
        questionId: d.questionId,
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
      action: question.binding ? "UPDATE" : "CREATE",
      entityType: "FactorBinding",
      entityId: binding.id,
      before: question.binding,
      after: binding,
    });
  });

  revalidatePath(`/builder/${question.section.templateId}`);
  return {
    ok: true,
    error: worst.health === "BROKEN" || worst.health === "AMBIGUOUS" ? `Bound, but health is ${worst.health}: ${worst.message}` : undefined,
  };
}
