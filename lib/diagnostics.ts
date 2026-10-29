import { z } from 'zod';
import { selectedJourneyModelSchema } from '@/lib/investigation-model';

export const findingSchema = z.object({
  code: z.string(), severity: z.enum(['blocker', 'warning', 'info']), message: z.string(), record_ids: z.array(z.string()),
});
export const hypothesisSchema = z.object({
  stage: z.enum(['source', 'collection', 'storage', 'serving']),
  label: z.string(),
  status: z.enum(['not_assessed', 'observed_positive', 'no_positive_observed']),
  supporting_evidence: z.array(z.string()),
  contradicting_evidence: z.array(z.string()),
  explanation: z.string(),
});
export const recordEligibilitySchema = z.object({
  record_code: z.string(), record_id: z.string(), stage: z.string(),
  eligible: z.boolean(), reason: z.string(),
  result_kind: z.enum(['positive', 'negative', 'neither']), on_pathway: z.boolean(),
  pathway_link_basis: z.string().nullable().optional(),
});
export type RecordEligibility = z.infer<typeof recordEligibilitySchema>;
export const diagnosticReportSchema = z.object({
  conclusion: z.string(),
  confidence_label: z.string(),
  attribution_permitted: z.boolean(),
  findings: z.array(findingSchema),
  hypotheses: z.array(hypothesisSchema),
  evidence_summary: z.object({
    records_received: z.number().int().nonnegative(),
    eligible_records: z.number().int().nonnegative(),
    eligible_by_stage: z.record(z.string(), z.number()),
    pathway_eligible_by_stage: z.record(z.string(), z.number()),
    pathway_batch_id: z.string().nullable(),
    positive_by_stage: z.record(z.string(), z.number()),
    negative_by_stage: z.record(z.string(), z.number()),
    shared_batch_ids: z.array(z.string()),
    all_four_stages_observed: z.boolean(),
    lineage_mode: z.enum(['legacy_batch', 'explicit_journey']).optional(),
    journey_id: z.string().nullable().optional(),
    journey_name: z.string().nullable().optional(),
  }),
  next_step: z.object({ action: z.string(), reason: z.string(), target_stage: z.string().nullable() }),
  limitations: z.array(z.string()),
  // Added in Step 10. Optional for backward compatibility with saved
  // Pass 2 reports; the engine always sends it for new reviews.
  record_eligibility: z.array(recordEligibilitySchema).optional(),
  lineage_review: z.object({
    mode: z.enum(['legacy_batch', 'explicit_journey']), journey_id: z.string().nullable(), journey_name: z.string().nullable(),
    status: z.enum(['not_supplied', 'linked_for_review', 'lineage_limited', 'evidence_incomplete']),
    stage_event_counts: z.record(z.string(), z.number().int().nonnegative()),
    transfer_edges: z.array(z.object({
      from_stage: z.string(), to_stage: z.string(), status: z.enum(['documented', 'observed', 'reported', 'uncertain', 'missing']), count: z.number().int().nonnegative(),
      supported_entity_pairs: z.array(z.object({ from_entity_ref: z.string(), to_entity_ref: z.string(), basis: z.enum(['documented', 'observed']) })).optional(),
    })),
    blockers: z.array(z.string()),
    path_count: z.number().int().nonnegative().optional(),
    selected_path_entity_refs: z.record(z.string(), z.string()).nullable().optional(),
  }).optional(),
  next_actions: z.array(z.object({
    id: z.string(), priority: z.enum(['high', 'medium']), action_type: z.enum(['linkage', 'sample', 'quality_control', 'repeat']), title: z.string(), why: z.string(),
    what_positive_would_mean: z.string(), what_negative_would_mean: z.string(), prerequisites: z.array(z.string()),
  })).optional(),
});
export const diagnosticApiResponseSchema = z.object({
  report: diagnosticReportSchema,
  generatedAt: z.string(),
  engine: z.string(),
  requestId: z.string().uuid(),
  evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  journeySha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
});
export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>;
export type SelectedJourneyModel = z.infer<typeof selectedJourneyModelSchema>;
export type DiagnosticApiResponse = z.infer<typeof diagnosticApiResponseSchema>;
