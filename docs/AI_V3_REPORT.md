# DabClean AI V3 — implementation and verification report

Date: 2026-10-29 (Asia/Saigon). Workspace: `D:/Documents/DabClean`. Baseline source commit: `0a12b82`. This is an experimental implementation, **not a completed or accuracy-validated cleanliness model**. No new supervised cleanliness head has been trained. No production accuracy improvement is claimed.

## What is implemented

V3 adds a real pretrained vision-language encoder (CLIP ViT-B/32, local ONNX inference through Transformers.js) and an optional local vision-language reasoning adapter (Ollama, Qwen3-VL by default). It does not derive cleanliness from object count or image color. It preserves the old model and API and provides a separate versioned contract, quality screening, cancellation/resource boundaries, a new viewer, data provenance safeguards and executable evaluation tooling.

There are six independent criterion slots: visible dust, clutter, litter, stains, floor dirt and surface dirt. Every slot has an explicit status, nullable severity and confidence, evidence list and explanation of missing information. **CLIP currently exposes only an experimental clutter description candidate; five unsupported criteria abstain.** Even the clutter candidate is not a verified observation, localized finding or confidence probability. Ollama can supply per-criterion visual observations, locations and alternative explanations, but these remain unverified hypotheses with null numerical scores. It was not installed or run in this environment.

No made-up severity bars, calibrated confidences, boxes, visibility masks or overall room scores are shown. The UI has a conditional bar renderer for future calibrated results, but no current provider emits such results. There is no implemented supervised severity calibrator. This is an intentional release boundary: a truthful abstaining pipeline is available, while the requested reliable six-criterion model remains dependent on real annotation and validation.

## Audit of V2 and available data

- Real image features: a frozen MobileNet v1 alpha 1.0 backbone, 224×224 input, 1024-dimensional embedding; Dense 256/128 with dropout and a three-class softmax head. Labels are `sach`, `hoi-ban`, `rat-ban`. Scores are weighted class-anchor projections (10/50/90), not six independent measurements or physical dirt quantities.
- `predict.js` defaults to whole-image inference. Comments elsewhere still describe patch mode as default. The 3×3 patch path has a train/inference distribution shift and hand-set escalation rules; patches are not trained grime detectors or evidence boxes. It is retained for legacy compatibility, not used by V3.
- V2 scan averages scores across images. Its estimate endpoint uses a separate AI price table. V3 does not use either operation: no automatic multi-view averaging and no AI-driven booking price adjustment.
- Metadata records 1057 original images (200/416/441), 2114 augmented samples, and historical validation accuracy 0.874. That number is not an independent held-out benchmark and was not revalidated. Model metadata lacks an image/room inventory needed to rule out test contamination.
- Real dataset discovered outside the repository: `D:/folder anh/dataset`: 597 images, 200 clean / 198 slightly dirty / 199 very dirty. This differs from metadata by 460 images. No room/source mapping or independent six-criterion annotations were found in the audited folders.
- Actual SHA256/dHash audit: 594 images fit the 16-million-pixel decode policy, zero byte-identical duplicate pairs, five near-duplicate candidate pairs at dHash distance <= 6. Three images are valid JPEGs of 5712×4284, 6571×4381 and 6000×4000 and exceed that policy; they are **not declared corrupt**. Near-duplicate flags need human review, not automatic truth labels. Full filenames/fingerprints remain in private local cache.
- Dataset adequacy cannot be judged from folder counts alone. Scene/style bias, label disagreement, room overlap and overfitting are unmeasured. Existing historical evaluation scripts sample training/validation data and cannot establish unseen-room accuracy.
- Training bug found and fixed: reconstructing sample group IDs from planned augmentation counts misaligns later groups if a variant fails. The dataset builder now emits group IDs alongside actual successful samples. Splitting is global by room/source group even when one room has different class labels. Training requires an explicit mapping and refuses an output directory that already contains a model.

## Research and model decision

| Approach | Spatial/context suitability | Deployment, cost and limitations | Decision |
|---|---|---|---|
| Existing MobileNet transfer learning | Whole-scene classification; no object relations or criterion labels | Existing Node/TFJS CPU path; no per-image API fee; 224px input loses small details | Preserve as baseline/rollback, do not invent criterion outputs |
| Generic object detector, e.g. COCO-SSD | Can locate common objects, but a book/toy/bottle is not inherently waste | Node integration exists; detector label coverage is not grime coverage; project-specific annotation needed | Not deployed as a clutter counter |
| SAM/semantic segmentation | Can delineate regions; SAM masks do not identify dirt semantics | Separate semantic labels, model/runtime resources and localization benchmark still required | No fake masks or boxes; future region supervision |
| Generic supervised ViT | Better capacity does not supply missing labels or prove context reasoning | Requires room-disjoint annotated data and measured target hardware | Not trained without data |
| CLIP ViT-B/32 | Learned image/text features allow contrasting orderly density vs scattered possessions; known multi-object and fine-detail limitations | Real local CPU inference, about 156 MB cached artifacts measured here; MIT weights, Transformers.js Apache-2.0 | Executable experimental context baseline, **not selected as best by accuracy** |
| Local Qwen3-VL through Ollama | Can describe objects, locations and ambiguity; still may hallucinate or misread shadows | Apache-2.0 model; requires a separately installed runtime/vision weights and measured RAM/latency; no successful run here | Implemented loopback-only structured adapter, not promoted |
| External VLM API | Potential richer reasoning, but privacy/consent, cost and vendor reliability need assessment | Would send room photos to a third party and add per-call costs | Not implemented or used |
| Hybrid detection + segmentation + VLM | Promising for region evidence and scene context | Needs reviewed regions, annotated severity, calibration and same-test comparisons | Architecture extension point; not claimed implemented |

Primary references consulted: [Transformers.js image classification API](https://huggingface.co/docs/transformers.js/api/pipelines), [CLIP ONNX model](https://huggingface.co/Xenova/clip-vit-base-patch32), [CLIP authors' paper](https://cdn.openai.com/papers/Learning_Transferable_Visual_Models_From_Natural_Language_Supervision.pdf), [multi-object CLIP limitations](https://arxiv.org/abs/2502.19842), [SAM source](https://github.com/facebookresearch/segment-anything), [Qwen3-VL model card/license](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct), [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs). Technology research does not substitute for a DabClean benchmark.

## Pipeline, API and integration

`multipart -> admission/rate limit -> worker -> signature/decode/pixel checks -> EXIF orientation/metadata removal -> quality screen -> local semantic provider -> per-image contract -> safe DOM viewer`

- `POST /api/ai/v3/analyze`: at most four static JPEG/PNG/WebP files, six MB per file, no additional multipart fields. Real signatures/decoder output are checked rather than trusting extension/MIME. Hard pixel limit: 16 million; inference image edge capped at 1600; no AI sharpening.
- Quality checks measure luminance extremes, resolution and Laplacian variance. These are conservative, configurable-in-code operational screens, not learned dirt or calibrated visibility thresholds. They can reject a featureless but valid image; users may need better framing. No occlusion detector or indoor scene ground-truth gate is claimed.
- CLIP contrasts high-density organized shelves/maximalism/active work with low-density scattered objects and blocked walkways. It can still get these relations wrong. During a real smoke test it also favored spurious stain descriptions on a sofa/cats photo; those unsupported criteria were therefore suppressed and now abstain.
- Ollama URL is restricted to literal loopback; credentials, remote hosts and redirects are rejected. JSON structure is validated, strings bounded, self-reported numerical scores ignored. Model text in an image is treated as data rather than instructions by the analysis prompt; prompt instructions do not eliminate hallucination/injection risks.
- Image uploads stay in RAM, are not logged or written to application storage. EXIF is stripped before inference. CLIP downloads model artifacts only; room images are not sent to Hugging Face. Ollama receives sanitized images only on the same machine; operators must review its own logging/retention settings.
- One upload/analysis is admitted at a time per router process; no unbounded worker queue. Per-connection IP limit: 10 attempts/minute; no client-supplied forwarding header is trusted. Workers have a 768 MB JS heap setting, 150-second wall deadline, and cancellation/termination. Native ONNX/Sharp memory is outside the JS heap cap: use OS/container memory and CPU limits for hosting. Multiprocess deployments need shared ingress quotas, authentication and capacity policy.
- Exact normalized-image duplicates are marked `duplicateOf`; separate angles remain separate. There is no overlap matching, stain counting or arbitrary room-score averaging.
- V3 scanner calls a single configured same-origin endpoint. It never retries private photos against another server, silently fabricates results, applies a price factor or maps an uncertain suggestion to a service ID. Existing backend quote/booking logic remains the price authority.
- V2 `/scan`, `/estimate`, CLI and model files are retained. An initialization failure in the backend AI adapter no longer exposes its native internal error to clients.

## Actual verification results

| Check | Actual result |
|---|---|
| `npm test` in ai-module | 21 tests pass, 0 fail after fixes |
| New unit/integration cases | Unknown/null handling, image signatures, malformed input, oversize dimensions/bytes/files, quality rejection, EXIF removal, VLM structure/privacy, benchmark metrics/leakage, real worker HTTP behavior, concurrent admission, error redaction, rate limiting, hard timeout/cancellation, DOM XSS, booking script parsing, failed-augmentation lineage |
| `npm run check-formats` | Existing decoder successfully processed JPEG/PNG/WebP/GIF/TIFF/AVIF; V3 intentionally accepts only the first three static formats |
| Clean install | `npm ci` passed in backend and ai-module. Initial AI reinstall failed because the running server held a native DLL; stopping it and repeating succeeded. Tests passed after reinstall |
| Dependency security | `npm audit --omit=dev` reports zero known vulnerabilities in both packages; this is not an overall security guarantee |
| Browser | Standalone V3 page uploaded a real public sample, executed the local model and rendered per-image results/unknown states. Booking and API JS syntax and the shared renderer were tested; full booking wizard browser flow was not completed |
| Backend integration smoke | V3 capabilities, V2 health/services and booking HTML returned 200 through the real backend app; disguised image upload returned 415 through the real V3 worker |
| V3 semantic execution | Real CLIP weights loaded and inferred on a public COCO/Hugging Face documentation photo and one actual existing dataset room photo |
| Legacy/V3 smoke comparison | On the public sample: legacy worker 10.323 s, V3 5.737 s, end RSS ~351.8 MB. On one existing training-folder room image: legacy 11.588 s, V3 4.465 s, end RSS ~354.5 MB. Single observations include different cold/load costs, not throughput statistics or accuracy comparisons |
| `npm run benchmark:v3` | Blocked as designed: `MISSING_REAL_LABELLED_DATASET`. JSON records before/after metrics as null; no accuracy improvement claimed |
| Supervised V3 training / severity calibration / local Ollama inference | Not run: missing reviewed six-criterion/room provenance data; Ollama runtime/vision weights unavailable |
| MySQL integration / production end-to-end | Not run. Regression tests used isolated in-memory test servers with an intentionally unreachable DB port, not a real MySQL schema/constraint test |

Existing regression suites were run against both current source and the baseline source, with fresh isolated test servers and the same patched dependency runtime. Results were the same:

| Suite | Current and baseline |
|---|---|
| backend/test-comprehensive.js | 19 pass, 2 fail (promo stacking and concurrency expectations) |
| backend/test-guest-access.js | 11 pass, 1 fail (creating booking) |
| backend/test-rbac-staff.js | 9/10 pass; test 8 fails |
| backend/test-return-url.js | 12 pass, 0 fail |
| test-wallet-system.js | Fails at wallet query assertion |
| test-job-photos-flow.js | 7 pass, 14 fail |

These results do not establish their root causes or MySQL behavior. They prevent an all-green regression claim; they were not hidden, disabled or modified. Root-cause repair of those unrelated business flows was not included in this AI change.

## Dataset and remaining release work

Follow [the annotation and benchmark protocol](../ai-module/benchmark/README.md). Collect new consented room-disjoint cases, preserve independent reviewer labels and agreement, establish real severity anchors, annotate regions, fit/calibrate models on train/calibration only, and evaluate paired old/new behavior on unseen test rooms. No generated image or model-created annotation is treated as ground truth.

Precision/recall/F1/confusion, MAE, ECE/reliability bins, abstention, the two clutter challenge error rates and runtime reporting are implemented and unit-tested. They have **not** produced valid domain accuracy results because the held-out annotated manifest is empty. No release threshold, severity color policy or confidence probability is learned from the current data. No trained object detector/segmenter, spatial graph, verified boxes, semantic floor masks, dust quantification, or multi-view geometric matching is present.

The machine has a GTX 1050 Ti with 4 GB VRAM; this implementation was tested on CPU. CLIP cache measured about 156 MB; measured process RSS is not a peak-memory guarantee. There is no per-image external API fee; local compute, model downloads, storage and annotation still have costs. Qwen memory/latency on this GPU was not benchmarked and is not guaranteed.

## Setup, training and rollback

1. In `backend/`, run `npm ci`. In `ai-module/`, run `npm ci`, `npm run prepare:v3`, `npm test`, then `npm start`. Use Node 22+ (24 tested). Stop Node servers before reinstalling native dependencies on Windows.
2. Open `http://localhost:5100/v3.html`; for integrated booking start the backend separately on port 5000. For production verify MySQL, JWT, ingress quotas, package/runtime/model licensing and OS resource limits separately.
3. No database migration, schema, business prices or required secret changes. Optional V3 settings are documented in `ai-module/.env.example`; put them in `backend/.env` for integrated serving. Set `AI_V3_OFFLINE=true` after preparing weights for cache-only serving.
4. For Ollama install its official runtime and a suitable local vision model, verify on the same challenge dataset, then configure `AI_V3_PROVIDER=ollama`. The code does not install/pull a multi-GB vision model or send images to a remote API for you.
5. Legacy training requires `--groups <room-groups.json>` and a new `--out` directory. Group IDs are supplied before augmentation; old weights are never automatically overwritten. This trains the existing three-class architecture, not a nonexistent V3 six-head model.
6. Disable V3 with `AI_V3_ENABLED=false` and use the explicit V2 demo/API for legacy operation, or revert the V3 code changes after review. There is no automatic fallback that could make an uncertain V3 analysis become a V2 price. Old model files are unchanged. Work is local and has not been pushed as part of this upgrade.

## Changed files

- Existing: `.gitignore`, `README.md`, `docs/PROJECT_CONTEXT.md`, `ai-module/README.md`, `ai-module/.env.example`, `ai-module/package.json`, `ai-module/package-lock.json`, `ai-module/public/index.html`, `ai-module/src/app.js`, `ai-module/src/routes/aiRoutes.js`, `ai-module/src/ml/dataset.js`, `ai-module/train.js`, `backend/package-lock.json`, `backend/src/routes/aiRoutes.js`, `frontend/api.js`, `frontend/booking.html`.
- New inference: `ai-module/src/v3/{contract,quality,prompts,clipProvider,ollamaProvider,worker,engine,routes,benchmark,legacyWorker}.js`, `ai-module/src/ml/groupSplit.js`.
- New tooling/tests: `ai-module/scripts/{prepare-v3,smoke-v3,audit-dataset-v3,benchmark-v3}.js`, `ai-module/test/v3/{contracts,frontend,http,training}.test.js`.
- New UI: `frontend/js/ai-v3.js`, `frontend/css/ai-v3.css`, `ai-module/public/v3.html`, `ai-module/public/v3-demo.js`.
- New documentation/data contract: this report, `ai-module/benchmark/README.md`, `ai-module/benchmark/manifest.json`, `ai-module/benchmark/latest-report.json`. Images, downloaded weights, individual dataset fingerprints and private execution logs stay outside tracked files.
