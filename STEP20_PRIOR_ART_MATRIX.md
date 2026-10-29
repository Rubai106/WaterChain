# STEP20_PRIOR_ART_MATRIX.md — Prior-art research for WaterChain novelty positioning

**Researched:** 2026-10-29 (all URLs accessed today; search-result access dates recorded per entry).
**Purpose:** ground the novelty argument for the BCS ICT Fest Project Showcasing submission in documented alternatives. This is a product-design prior-art scan, not a legal opinion, patent search, or freedom-to-operate analysis (consistent with the Step 12 scan).
**Rule applied:** distinguish capabilities confirmed by documentation from capabilities that could not be verified. No claim is made that an individual mechanism is unprecedented.

## 1. Category: water-quality monitoring & public-data platforms

### EPA Water Quality Exchange (WQX) + Water Quality Portal (WQP)
- **Source URL:** https://www.epa.gov/waterdata/water-quality-data-upload-wqx (accessed 2026-10-29)
- **FAQ:** https://www.epa.gov/waterdata/frequent-questions-water-quality-exchange-wqx (accessed 2026-10-29)
- **Intended users / use case:** federal, state, tribal agencies, watershed organizations submitting ambient water-monitoring data to EPA; the WQP (USGS/EPA/National Water Quality Monitoring Council) then serves 430M+ records publicly.
- **Evidence/data types:** physical, chemical, biological, habitat, metrics, index data; ESAR-based XML schema; WQXWeb templates/API/eXchange Network node.
- **Identity & relationships:** schema-level standardization and organization identifiers (traceability/accountability per NY DEC: http://dec.ny.gov/environmental-protection/water/water-quality/monitoring/water-quality-data); **no documented concept of a sample-to-sample "water journey" or contamination-transition attribution** — the purpose is archival/sharing, not interpretation.
- **QC behavior:** format conformance required for submission; analytical QC is the submitter's responsibility, not evaluated by the exchange.
- **Ambiguity/insufficient evidence:** not in scope — WQX does not assess whether submitted results support a conclusion; it archives them.
- **Traceability/audit:** submission-standard traceability (who submitted, in a standard structure); public retrieval.
- **Follow-up recommendations:** none — no interpretive layer.
- **Deployment/limitations:** US-centric, registration-gated (CDX), institutional submitters; a reviewer working with a handful of lab results gains no decision support.
- **Capabilities confirmed:** data standard, submission tooling, public portal. **Could not verify:** any built-in evidence-review or abstention logic — none documented.

### mWater (mWater Foundation, Inc.)
- **Source URL:** https://www.mwater.co/platform (named in brief; accessed via policies page https://www.mwater.co/policies and platform documentation, 2026-10-29). Platform scale corroborated by https://medium.com/@relific/best-mobile-data-collection-apps-for-ngos-a-practical-guide-for-2026-e4b24c98916a (390,000+ accounts, 51M+ survey responses across 199 countries).
- **Intended users / use case:** WASH NGOs, utilities, governments; offline-first field data collection, site registration, repeated surveys, mapping, dashboards.
- **Evidence/data types:** water-point surveys, sanitary inspections, water-quality test results (incl. Aquagenx CBT integration with automatic MPN calculation, 95% CI, WHO risk category: https://www.aquagenx.com/mwater-water-testing/).
- **Identity & relationships:** sites tracked across visits; **no documented construct for linking one sample bottle to the next stage of the same physical water's journey**, and no transfer-relationship reasoning between samples.
- **QC behavior:** result capture with confidence intervals; QC of the *interpretive chain* (is this evidence sufficient for a claim?) is not a platform function.
- **Ambiguity/insufficient evidence:** field app; ambiguity resolution is left to the analyst.
- **Traceability/audit:** survey history, GPS, timestamps, photos.
- **Follow-up recommendations:** monitoring dashboards and alerts (e.g., SMS suggestions of safer sources in the Mwanza project per https://humanipo.com/news/30188/usaid-injects-100000-into-mwater-startup); no per-case evidence-gap-driven action planner.
- **Deployment/limitations:** cloud platform, account-based; field-collection-first, not evidence-review-first.
- **Could not verify:** any abstention logic when a conclusion is unsupported; any sample-to-sample lineage reasoning.

## 2. Category: laboratory information management systems & sample chain-of-custody

### CloudLIMS (water/wastewater edition)
- **Source URL:** https://cloudlims.com/lims-solutions/lims-for-wastewater-and-drinking-water-testing-labs/ (accessed 2026-10-29)
- **Use case:** lab sample intake → testing → CoA; barcode tracking; complete chain-of-custody from receipt to disposal; automatic out-of-spec flagging; instrument integration.
- **Identity:** per-sample container CoC, analytical batches, QC runsheets with blanks/duplicates/spikes and pass/fail calculations.
- **Gap vs WaterChain:** LIMS custody ends at the laboratory door — it tracks the *bottle*, not whether that bottle can be joined to a transport or storage sample to support a contamination-entry claim. It does not abstain on behalf of a reviewer or explain unresolved evidence relationships. QC pass/fail is about analytical validity, not interpretive sufficiency.
- **Could not verify (no trial account):** exact UX of QC review screens; nothing in documentation suggests cross-sample journey reasoning.

### Matrix "Neptune" LIMS (Autoscribe)
- **Source URL:** https://www.limsforum.com/matrix-neptune-lims-the-modern-deliverable-solution-for-all-water-and-waste-water-testing-laboratories/50502/ (accessed 2026-10-29)
- **Relevant:** CoC "events" per sample container, sample splitting with individual child-sample tracking, runsheets with QC calculations.
- **Gap vs WaterChain:** same custody boundary as above; interpretation of *what the results jointly support* remains a human task outside the system.

### Clearline LIMS (SENAITE-based)
- **Source:** Capterra/GetApp listings (accessed 2026-10-29). Chain of custody, NELAP/ISO 17025/EPA compliance workflows.
- **Gap vs WaterChain:** compliance-oriented; no published evidence-review/abstention workflow for field-investigation conclusions.

**Category conclusion:** LIMS products own bottle-level custody and analytical QC, a different (and complementary) problem from WaterChain's: whether a small set of already-produced results jointly supports a contamination-transition claim. None of the surveyed products document an interpretive abstention gate.

## 3. Category: field-data collection & quality-assurance systems

### KoboToolbox / Akvo FLOW
- **Sources:** https://trainingcred.com/sl/training-course/community-water-sanitation-and-hygiene-promotion-training (Sierra Leone deployment), https://thewashroom.waterforpeople.org/resources/water-for-peoples-lessons-doubts-and-experience-of-mapping-rural-water-supply-systems-in-malawi/ (Akvo FLOW, 40k+ WASH records in Malawi), https://thewaternetwork.com/q-a-0-y/mapping-tools-for-water-and-sanitation-infrastructure-nCoyuBq7ba7-M3ORVQVTUg (accessed 2026-10-29)
- **Use case:** offline mobile surveys, water-point mapping, hygiene assessments; widely deployed by NGOs and ministries.
- **Gap vs WaterChain:** data *capture* platforms. They do not encode per-record eligibility for interpretation, do not model transfers between samples, and do not generate evidence-gap-driven next actions. A reviewer exporting Kobo data to a spreadsheet is exactly the manual baseline WaterChain compares itself against in `validation/MANUAL_WORKFLOW_BASELINE.md`.

## 4. Category: structured spreadsheets & manual evidence review

### WHO Water Safety Plans + sanitary inspection (the actual incumbent workflow)
- **Sources:** WHO Guidelines for Drinking-water Quality 4th ed. + addenda (https://www.who.int/publications/i/item/9789240121225); WHO sanitary-inspection packages (https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/water-safety-and-quality/water-safety-planning/sanitary-inspection-packages); GDWQ Chapter 5 surveillance (https://cdn.who.int/media/docs/default-source/wash-documents/water-safety-and-quality/dwq-guidelines-4/gdwq4-with-add1-chap5.pdf?sfvrsn=527ccd3_3); critical review of sanitary inspection vs water-quality analysis (https://www.sciencedirect.com/science/article/pii/S0048969720307476); ETV Bharat summary of the 3rd addendum (https://www.etvbharat.com/en/health/who-third-addendum-guidelines-drinking-water-enn26062001229) — all accessed 2026-10-29.
- **The workflow as practiced:** sanitary inspection = 9–12 yes/no risk-factor questions per source type, scored by counting "yes" answers; literature shows *mixed* correlation between sanitary risk scores and measured microbial quality (some studies significant, others not). WSPs require system assessment, monitoring, and management plans; incident investigation must determine cause, document, and correct.
- **Gap vs WaterChain:** the incumbent is checklist-based and human-interpreted. It provides no machine-checkable rule for "these four results cannot jointly support a transition claim because the batch lineage is unproven," no per-record eligibility computation, and no structured unresolved-evidence explanation a second reviewer can audit. WaterChain is designed to sit *inside* this workflow (aligned with WSP surveillance, not replacing it), digitizing the discipline of the review step that is currently done on paper or in a spreadsheet.
- **Evidence-level note:** the Uganda literature found in this search (e.g., https://iwaponline.com/washdev/article/9/4/683/70048/Quality-of-water-sources-in-Southwestern-Uganda; https://9lib.org/document/oy8d9prz-combining-sanitary-inspection-water-quality-data-western-uganda.html) confirms the real-world context — high fecal contamination rates, boreholes safest — but none of these studies automate evidence-sufficiency review. This supports the problem statement; it does not validate WaterChain.

### Spreadsheet + checklist (WaterChain's own study comparator)
- **Source:** `validation/MANUAL_WORKFLOW_BASELINE.md` (in-repo), with isomorphic task sets A/B, balanced assignment plan, rubric-scored outcomes. Prepared; no participants yet.
- This is the honest comparator: the naive first-positive algorithm in the Step 18 code comparison is *not* the manual-workflow claim and must never be presented as one.

## 5. Category: data-lineage, provenance, and evidence-audit software

- General-purpose data-lineage/provenance tools (e.g., in data engineering) track dataset transformations, not physical water movement; forensic/audit tools track document chains, not sample-to-sample interpretive sufficiency. No surveyed product combines sample identity, transfer documentation, QC gates, explicit abstention, and reviewer-facing unresolved-evidence explanations for water-quality investigation.
- EQuIS (EarthSoft) WQX packaging (https://help.earthsoft.com/wqx-package-overview.htm) automates WQX submission formatting — again a submission pipeline, not an interpretation gate.

## Required novelty conclusion

WaterChain's strongest defensible differentiation is **integration, not invention of a single mechanism**:

> An explicit, reviewer-facing workflow that (1) separates sample bottles from physical water/container entities, (2) requires documented identity and transfer relationships before cross-stage interpretation, (3) applies per-record eligibility gates (method, timestamp, QC, analyte, finite numerics), (4) abstains with a named reason when evidence is insufficient instead of producing a best-guess attribution, (5) explains exactly which evidence was excluded and what remains unresolved, and (6) turns each unresolved condition into a traceable, prerequisite-named follow-up action — with the whole chain reproducible (fingerprints, audit ledger, exportable artifacts) for a second reviewer.

Each ingredient exists somewhere (LIMS custody, WQX standardization, WHO checklists, spreadsheet review). What the surveyed products do not document is this combination applied to the specific question "does this handful of lab results jointly support a candidate contamination-transition claim, and if not, what exactly is missing." That integration is valuable to its intended user (a reviewer or field supervisor triaging lab results) because unsupported origin claims are a real failure mode — the Step 18 fixtures demonstrate how easily a naive reading attributes a stage (88.9% on adversarial cases), while WaterChain withholds attribution with a reason (0%).

**Claims that must NOT be made:** "first-ever," "industry-leading," "AI-powered source detection," patentability, global novelty, field validation, or that the integration is a new algorithm. The honest frame is: a disciplined, testable implementation of review hygiene for a step that the incumbent workflow performs informally.
