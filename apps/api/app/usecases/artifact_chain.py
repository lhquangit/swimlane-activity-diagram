from __future__ import annotations

from app.schemas.usecase import ArtifactChainItem


def build_artifact_chain() -> list[ArtifactChainItem]:
    return [
        ArtifactChainItem(
            artifact_type="project_spec",
            label="ProjectSpec",
            source_of_truth=True,
            human_editable=True,
            generated_from=[],
            notes="Mô tả bối cảnh nghiệp vụ và ranh giới bài toán ở cấp dự án.",
        ),
        ArtifactChainItem(
            artifact_type="feature_intent",
            label="FeatureIntent",
            source_of_truth=True,
            human_editable=True,
            generated_from=["project_spec"],
            notes="Ý định chức năng cần build cho một module hoặc bài toán cụ thể.",
        ),
        ArtifactChainItem(
            artifact_type="use_case_draft",
            label="UseCaseDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["project_spec", "feature_intent"],
            notes="Danh sách use case để BA/Solution Engineer review trước khi sinh diagram.",
        ),
        ArtifactChainItem(
            artifact_type="diagram_draft",
            label="DiagramDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["use_case_draft"],
            notes="Swimlane activity diagram draft cho từng use case đã được approve.",
        ),
        ArtifactChainItem(
            artifact_type="formal_brd_draft",
            label="FormalBRDDraft",
            source_of_truth=False,
            human_editable=True,
            generated_from=["project_spec", "use_case_draft", "diagram_draft"],
            notes="BRD tổng hợp theo format formal sau khi use case và diagram đã ổn định.",
        ),
    ]
