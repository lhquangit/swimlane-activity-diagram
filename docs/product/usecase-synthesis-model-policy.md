# Use Case Synthesis Model Policy

Date: 2026-06-12
Owner: Codex
Status: Active

## Quality bar

Use Case synthesis has a different quality bar from BRD generation.

The output is acceptable only when it is:

1. usable for BA review without rewriting the whole portfolio,
2. segmented into distinct business boundaries instead of one broad flow,
3. grounded to canonical actors, inputs, outputs, triggers, and constraints,
4. specific enough to drive downstream Diagram and BRD generation.

If a model produces schema-valid JSON but still collapses multiple business stages into one coarse
flow, that model/pipeline does not meet the bar for the default persisted `Use Case` experience.

## Default policy

- Default `USECASE_MODEL_PRIMARY`: `openai/gpt-5.5`
- Default `USECASE_PROMPT_VERSION`: `1.2.0`
- BA-facing `Use Case` authoring is AI-only; `USECASE_GENERATION_MODE` now controls runtime
  availability, not a user-facing choice between AI and scaffold output
- Mini-tier models such as `openai/gpt-5.4-mini` are not the default policy for BA-facing Use Case
  synthesis anymore

Reasoning:

- The pipeline currently asks one model pass to do business decomposition, actor responsibility
  assignment, alternate-flow design, and evidence grounding.
- That workload is closer to planning than to lightweight text expansion.
- The previous default `openai/gpt-5.4-mini` was a reasonable exploration baseline but left too
  much risk that outputs would remain broad even when AI was enabled correctly.

## Candidate evaluation matrix

| Candidate | Segmentation quality | Cost/latency posture | Complaint-domain readout | Decision |
| --- | --- | --- | --- | --- |
| `openai/gpt-5.4-mini` single pass | Medium-low | Cheap / fast | Often collapses multi-stage business flows such as `Tích điểm cho thú cưng` into coarse or weakly separated use cases | Rejected as default |
| `openai/gpt-5.5` single pass + prompt `1.2.0` | Higher | Higher than mini | Better fit for real domains that need business-stage separation: GPS issuance, camera re-id, `Tích điểm cho thú cưng`, guest vehicle entry, maintenance ticket intake | Chosen default |
| `mini` primary + critic pass | Potentially medium-high | Two-pass complexity | Worth revisiting only if cost pressure becomes material after stronger single-pass baseline is stable | Deferred |

## Representative domains

The current representative domains for acceptance are:

- GPS device issuance
- Camera / re-id investigation
- Tích điểm cho thú cưng
- Đăng ký xe khách
- Tiếp nhận phiếu bảo trì căn hộ

These domains are intentionally mixed:

- human-led administrative flow,
- technical-actor-heavy flow,
- multi-stage resident operation,
- gate/physical access workflow,
- service ticket workflow.

## Operating guidance

1. If local or staging wants the BA-facing AI path, prefer `USECASE_MODEL_PRIMARY=openai/gpt-5.5`.
2. If the team needs a cheaper exploratory path, keep it explicit and do not present it as a
   BA-facing authoring mode.
3. Revisit a critic pass only after the stronger single-pass baseline is stable against the current
   complaint-domain suite.
4. `deterministic` and `ai_shadow` may still exist as internal environment states, but they should
   make authoring unavailable rather than returning scaffold portfolios to users.
5. Do not enable broad AI authoring in a given environment unless the representative golden suite
   stays green and manual BA review of complaint domains is acceptable.
