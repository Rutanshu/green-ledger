/**
 * Audit actions/entities are internal, system-level vocabulary — not
 * something an org renames — so these are plain display maps rather than
 * routed through the full Label system (redesign spec §11).
 */
export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  LOCK: "Locked",
  UNLOCK: "Unlocked",
  APPROVE: "Approved",
  REJECT: "Sent back",
  RECALCULATE: "Recalculated",
  EXPORT: "Exported",
  LOGIN: "Signed in",
  IMPORT: "Imported",
  RESTATE: "Restated",
  IMPERSONATE: "Impersonation event on",
};

export const ENTITY_LABEL: Record<string, string> = {
  PositionValue: "a data entry",
  ActivityRecord: "an activity record",
  EmissionRecord: "an emissions calculation",
  QuestionnaireAssignment: "a facility's submission",
  RuleViolation: "a data-quality flag",
  Restatement: "a correction to a locked period",
  ReportingPeriod: "a reporting period",
  Report: "a report",
  Membership: "a membership",
  Organization: "the company",
};
