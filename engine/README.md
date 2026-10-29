# WaterChain diagnostic engine — Step 12

The Python standard-library engine reviews evidence records and returns a JSON report with eligibility decisions, pathway hypotheses, findings, a conservative conclusion, a relationship review, and explainable next actions.

## Run the engine

From the project root, a JSON CLI request can be piped to the engine:

```bash
python engine/diagnose_cli.py < request.json
```

Or import the function from Python:

```python
from engine.diagnose import diagnose
report = diagnose(records)  # use entered/imported records, not synthetic fixtures in a real case
print(report["conclusion"])
```

The Next.js API invokes this CLI with a JSON request. If `journey_model` is supplied, the engine uses explicit source, sampling-event and transfer relationships. If omitted, the backward-compatible legacy shared-batch mode is used.

## Step 12 explicit-journey mode

A sample bottle is a **sampling event**, not a physical object assumed to persist through source, collection, storage and serving. The optional graph describes:

- a source identifier mapped to the `waterSourceId` on linked evidence records;
- a journey grouping the related sampling events under investigation;
- sampling events linking existing records to a stage, relationship basis/reference and water/container entity ID;
- transfer events linking exact `fromEntityRef` and `toEntityRef` values between adjacent conceptual stages.

A directly documented or associated-visit sample link requires a real reference and an entity ID. A documented transfer requires a source reference; an observed transfer requires a reference or explanatory note. Self-reported/inferred/unverified links remain visible but do not provide direct transfer support.

The graph resolver returns **0**, **1**, or **2+** complete entity-connected paths. The numeric `path_count` value `2` is a bounded sentinel for two or more routes, not the exact total. The resolver stops once a second route is identified. Only one complete route may proceed to candidate-transition interpretation; 0 or 2+ routes cause abstention.

A complete route is still not proof of physical continuity or causation. Field references, source identifiers, transfer notes, and relationship bases are user-entered and unauthenticated. The engine does not estimate calibrated probabilities.

## Eligibility and interpretation

- Records must have a supported reportable analyte/result, method, timestamp, source ID and required QC metadata.
- Legacy batch mode also needs the unique shared-batch requirement; explicit-journey mode does not synthesize or require a common batch ID.
- The selected source mapping, stage, timeline, sample identity, analyte consistency, QC, discordant repeat and source-lineage checks remain active.
- A positive is an observation, not proof of where contamination began. Candidate-transition language requires negative observations at every earlier stage and a single resolved path.
- A negative result is not proof of absence. Missing data are not treated as negative.
- The next-action planner can suggest resolving references, source mapping, a missing stage, QC or discordance. It does not invent prices, turnaround times, probabilities or guaranteed information gain.

## Tests and reproducibility

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python -m unittest discover -s research/datasets -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
python engine/build_reproducibility_manifest.py
```

The evaluation and holdout cases are developer-authored synthetic software fixtures. Their expected-decision conformance is not real-world diagnostic accuracy or external scientific validation.

## Related modules

- `research/datasets/waterqualityuganda_adapter.py`: local, read-only profiling of the public dataset's original CSVs (user-downloaded; not bundled).
- `lib/investigation-model.ts` and `components/journey/WaterJourneyWorkbench.tsx`: frontend relationship model, provenance register/vault and action planner.
- `lib/provenance-vault.ts`: IndexedDB-based local original-file retention and SHA-256/size verification before download.
- `supabase/migrations/`: optional future database schema; not connected to this local prototype.
