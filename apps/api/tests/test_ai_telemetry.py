from __future__ import annotations

from app.ai.telemetry import counter_snapshot, record_generation_event


def test_telemetry_counts_events_and_redacts_unknown_dimensions(caplog) -> None:
    with caplog.at_level("INFO", logger="app.ai"):
        record_generation_event(
            "test_redaction",
            capability="usecase_synthesis",
            source="ai",
            prompt_body="SECRET BUSINESS PAYLOAD",
        )

    assert counter_snapshot()["test_redaction"] >= 1
    assert "usecase_synthesis" in caplog.text
    assert "SECRET BUSINESS PAYLOAD" not in caplog.text
