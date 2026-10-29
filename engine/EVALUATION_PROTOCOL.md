# WaterChain Step 5: Evaluation protocol

**Scope:** software behavior of the current deterministic rule engine only.

**Fixture source:** generated in `evaluate.py`; all records use `SYN-*` identifiers and explicit synthetic notes. No real water-quality data are included.

**Cases:** 15. Three complete linked patterns expect a candidate transition at collection, storage, or serving. The other 12 expect no stage attribution because no transition is observed or some prerequisite for responsible attribution is absent.

**Decision extraction:** WaterChain earns a stage prediction only when the engine's output says `attribution_permitted=true` and the confidence label is `candidate transition only`. An observed positive at source does not automatically imply that contamination originated at source. All other outcomes are scored as abstentions for this protocol.

**Baseline:** earliest stage containing a raw `detected` result (or positive numeric quantified result), ignoring QC, missing metadata, source/batch lineage, chronology, and coverage. It is intentionally naive to provide a deterministic contrast on cases designed to exercise those exact issues. It is not asserted to represent any real product or established scientific baseline.

**Expected-decision labels:** hand-declared in the scenario definitions. `expected_decision` is a stage for the three fully linked clean-transition cases and `null` for cases where the appropriate system action is to abstain. `latent_ground_truth_entry_stage` stores scenario construction context for invalid-evidence cases, but is not treated as inferable from their supplied records.

**Metrics:**

- Expected-decision fixture accuracy = exact stage/abstention matches divided by all scenarios.
- Attribution coverage = scenarios receiving a stage prediction divided by all scenarios.
- Selective accuracy = correct emitted stage predictions divided by all emitted stage predictions.
- Correct attribution rate on identifiable fixtures = correct predictions divided by fixtures predeclared as identifiable.
- Correct abstention rate = no-prediction results divided by fixtures predeclared to require abstention.
- Unsupported attribution rate = stage predictions divided by fixtures predeclared to require abstention.

**Limits:** these values cannot establish real-world causal accuracy, sensitivity/specificity, calibration, external validity, superiority over deployed systems, or effects on health outcomes. The suite was authored alongside the rules, and independent, blinded, hold-out evaluation is a necessary next step.
