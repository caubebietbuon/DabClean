# Clean vs Cluttered Challenge protocol

The checked-in manifest is deliberately empty. There are no generated labels or synthetic benchmark images. `npm run benchmark:v3` must report missing data until real, reviewed, independent examples are supplied. The old three-class training folders do not constitute six-criterion ground truth.

## Collection and annotation

1. Collect consented real photographs with source/license records. Keep private originals and annotation exports under `private/` or `images/` (gitignored), or an external protected location. Remove personal identifying details before sharing research artifacts; do not publish raw room images by default.
2. Include low/high object density crossed with orderly/disorderly arrangements, maximalism, toys and active work, nearly empty stained rooms, normal use, darkness, shadows, patterned/worn materials, small/large stains and several views of the same room. Match density across orderly/disorderly cases; never label by object count.
3. Assign a stable roomId to all angles, times and variants of each room. Group exact duplicates and human-reviewed near duplicates; all members stay in one split. Images previously used by the legacy model cannot enter its independent test set. Its metadata does not contain a training image inventory; new room collection is required unless provenance can exclude contamination.
4. Two reviewers independently label each criterion before reconciliation. Preserve independent annotations privately. Publish agreement rates and disagreements by criterion; do not claim inter-rater agreement from consensus labels alone. `consensusReviewed` records adjudication, not independent agreement.
5. Label `clear`, `concern`, `unobservable`, or `uncertain`. `clear` means no significant visible signal in an observable region, not a guarantee of sanitation. Shadows/patterns/wear and temporary use with ambiguous intent are uncertain. Hidden surfaces or insufficient detail are unobservable. Dust requires visible close detail. Toys and papers are not automatically waste.
6. Only supply a 0–100 severity reference when reviewers have an agreed rubric supported by exemplars. Define per-criterion anchors, visibility limits and scoring intervals using real pilot data, then freeze them before the test split. Otherwise use `score: null`; unobservable/uncertain must have null scores. Do not fabricate numeric labels to unlock UI bars.
7. Split by room BEFORE augmentation. Keep train, calibration, and test rooms separate. Fit any severity regressors, acceptance thresholds and confidence calibration using train/calibration only. Freeze prompt/model/version and all thresholds before testing. Review false positives in maximalist and high-density orderly rooms independently.

## Manifest item format

Each real item requires: `id`, `file` (relative to manifest), `roomId`, `split` (`train`, `calibration`, `test`), `challenge`, `annotators` (two distinct reviewer IDs), `consensusReviewed: true`, and `labels`. Labels contain every key `dust`, `clutter`, `litter`, `stains`, `floor`, `surfaces`, each with `state` and `score` (nullable). Optional `legacyLabel` can record the old three-class label for future overall comparison.

Challenge values: `many_ordered`, `few_disordered`, `maximalist_ordered`, `empty_stained`, `normal_use`, `dark`, `shadow`, `pattern`, `small_stain`, `large_stain`, `other`. Set manifest-level `unseenByLegacy: true` only when provenance supports it. This is an operator attestation, not automatic proof.

The validator blocks missing data, missing reviewer/consensus fields, same-room split leakage, unsafe file paths, invalid numeric labels, duplicate IDs, exact duplicates and dHash distance <= 6 candidates across splits. dHash can miss duplicates and flag different rooms with similar layouts; human review and provenance remain mandatory. A small passing manifest does not imply adequate sample size or representativeness.

## Running and interpreting results

```powershell
# Working directory: ai-module/
node scripts/audit-dataset-v3.js "D:\folder anh\dataset"
node scripts/benchmark-v3.js ./benchmark/private/challenge.json ./benchmark/private/results.json
```

Both pipelines process the same held-out images. Legacy outputs remain three-class predictions; no six-criterion values are invented for it. V3 reports accepted predictions and experimental candidates separately, confusion matrices (including abstention), per-class precision/recall/F1, numeric MAE with coverage, ECE with calibration sample counts, reliability-bin data, challenge-specific false positives/false negatives, latency and end-of-worker RSS. Null metrics mean unavailable, not zero error. RSS is not worker peak memory. The JSON reliability bins can be plotted once real calibrated confidence samples exist; a meaningful reliability diagram cannot be drawn from all-null confidence.

Current CLIP deliberately refuses five unsupported criteria and all severity/confidence scores; accepted coverage is therefore zero. Candidate agreement can be studied for clutter, but is not production accuracy. Ollama observations also remain unverified. No model is promoted based on smoke tests or on its own confidence. Detection/segmentation localization metrics require additional reviewed region annotations and an actual detector; the current pipeline does not invent boxes.

After data collection, use paired room-level evaluation and uncertainty intervals, stratify by challenge/lighting/style, and compare risk vs accepted coverage. Choose any release targets with the product owner after measuring annotation noise; no arbitrary 95/99% target is asserted here.
