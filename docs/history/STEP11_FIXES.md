# WaterChain Step 11 — Bug Fix Summary

## 1. Eligible but off-pathway results

**Problem:** Stage display treated any engine-eligible positive or negative result at that stage as part of the selected pathway, even when the engine marked the record `on_pathway: false`.

**Fix:** Stage summaries now count and prioritize only eligible entries marked `on_pathway`. Eligible observations that belong to another/unselected batch are labeled `Eligible positive — not linked to selected pathway`, `Eligible negative — off selected pathway`, or `Eligible record — off selected pathway`. The detail panel explains that these records do not contribute to the selected pathway hypotheses. The pathway count now reads `On pathway`, based on `pathway_eligible_by_stage`.

**Identity matching:** Stage details join the engine eligibility table to evidence records using the immutable `record_id` / local record UUID, not the user-visible `record_code`.

## 2. Stale report conclusion remains visible

**Problem:** After evidence changed, the warning and disabled export were visible, but the old conclusion and result panels remained prominently displayed.

**Fix:** Stale reports now show an alert and a collapsed `View previous report` disclosure. The old conclusion and summary are hidden until explicitly opened. The disclosure clearly states that the result is stale and not an assessment of the current evidence. A fresh review makes the current result panels visible again. Stale review-bundle export remains disabled.

## 3. Manual record-code uniqueness

**Problem:** Manual record entry generated a short random suffix without checking for a collision in the active investigation.

**Fix:** `generateUniqueRecordCode` generates candidates and checks them against existing record codes case-insensitively, retrying if a collision occurs. The manual save path has a defensive duplicate check. The immutable internal `id` remains a UUID and is used to link the record to its eligibility response.

## Scientific behavior

No Python diagnostic decision rules were changed. No new data or fabricated results were added to live investigations. Both evaluation scripts remain synthetic fixture checks, not real-world diagnostic validation.
