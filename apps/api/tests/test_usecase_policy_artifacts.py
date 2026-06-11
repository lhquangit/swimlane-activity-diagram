from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_example_env_promotes_the_stronger_usecase_model_policy() -> None:
    env_example = (REPO_ROOT / "apps" / "api" / ".env.example").read_text(
        encoding="utf-8"
    )

    assert "USECASE_MODEL_PRIMARY=openai/gpt-5.5" in env_example
    assert "USECASE_PROMPT_VERSION=1.2.0" in env_example


def test_model_policy_doc_records_quality_bar_and_candidate_matrix() -> None:
    policy_doc = (
        REPO_ROOT / "docs" / "product" / "usecase-synthesis-model-policy.md"
    ).read_text(encoding="utf-8")

    assert "Quality bar" in policy_doc
    assert "openai/gpt-5.5" in policy_doc
    assert "openai/gpt-5.4-mini" in policy_doc
    assert "Tích điểm cho thú cưng" in policy_doc
