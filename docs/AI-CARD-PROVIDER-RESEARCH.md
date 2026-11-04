# Image provider evaluation — 2026-11-03

Candidate: Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell`. Its official API accepts a text prompt and 1–8 inference steps and returns base64 image bytes. The publisher describes the model as Apache 2.0 and allows commercial use; this is a model-license finding, not a blanket warranty that every generated output is free of third-party rights. Cloudflare service terms and the account's model terms must also be accepted and recorded before publishing artwork.

Cloudflare's current allowance is 10,000 Neurons per account per UTC day, shared with other Workers AI usage. Free accounts fail at their limit rather than silently enabling a paid plan. The price table lists 4.80 Neurons per 512×512 tile plus 9.60 per inference step for schnell. Conditional estimate: an image actually returned at 1024×1024 with four steps would be 4 tiles × 4.80 + 4 × 9.60 = 57.60 Neurons under that table. Dimensions, billed usage, retry cost and account eligibility must be measured with a sample; no fixed daily image count is promised. Other models have different limits, rates and terms.

No live sample has been generated: the server Cloudflare account/token and Gemini configuration have not been provided. Image quality, actual output dimensions, actual usage headers and application-specific output/storage rights remain unqualified. A sample should use an empty Islamic architectural courtyard with geometric decoration, no people, faces, scripture or sensitive figure depictions. Save the provider/model/date/license provenance with the image and require independent artwork review. Do not activate paid billing. Existing verified artwork/library entries must be reused while generation is unavailable; unverified drafts must never be distributed.

Official sources:
- https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://huggingface.co/black-forest-labs/FLUX.1-schnell
- https://developers.cloudflare.com/workers-ai/platform/data-usage/
- https://www.cloudflare.com/service-specific-terms-application-services/
