# Step 16 — Novelty and product-strategy assessment

## The feature added

WaterChain now includes a Decision Sensitivity Studio integrated into the existing evidence eligibility and journey model. It lets a reviewer temporarily omit selected eligible on-pathway records, rerun the same diagnostic engine, compare decision categories, and export a fingerprint-bound sensitivity artifact without editing the original register.

## Why this is useful

A diagnostic conclusion may depend heavily on one sample or one stage. Showing which omissions change the engine's decision helps a reviewer identify evidence on which the current conclusion depends and prioritize verification. This adds an explicit challenge to WaterChain's workflow: do not only ask whether evidence supports the current review; also ask how the review changes when selected evidence is unavailable.

## Novelty boundaries

Sensitivity analysis, leave-one-out analysis, evidence traceability, and water-safety planning are established ideas; WaterChain must not claim those techniques are globally new. The product-level differentiation hypothesis is their integration into one small-investigation workflow alongside explicit water-journey linkage, per-record eligibility, cautious abstention, ActionLoop, risk/control review, temporal observations, and next-action planning.

This is a product differentiation hypothesis, not a patentability opinion or a verified claim of global novelty. A meaningful novelty study still requires broader prior-art research and direct comparison with existing water-quality monitoring, laboratory information management, chain-of-custody, risk-register, and water-safety-plan tools.

## Practical validation needed

Evaluate the feature using independently authored cases and domain-expert review. Measure whether sensitivity outputs help reviewers identify genuinely load-bearing evidence, avoid unsupported conclusions, and choose better follow-up steps. Do not use the percentage of synthetic fixtures passed as evidence of real-world accuracy.

## Relevant external context

- WHO's 2026 drinking-water quality guidelines emphasize risk-based management from catchment to consumer, water safety plans, sanitary inspections, and surveillance: https://www.who.int/publications/i/item/9789240121225
- The Water Quality Uganda dataset documents separate borehole, household visit, sample, and laboratory-blank tables, illustrating the importance of explicit relationships and cautious joins: https://openwashdata.github.io/waterqualityuganda/
- Research on contamination source identification and sensor placement already exists, so WaterChain should not position source localization itself as new: https://www.sciencedirect.com/science/article/pii/S2401586325031428

These sources motivate practical design constraints; they do not validate WaterChain's performance.
