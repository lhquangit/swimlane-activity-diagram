from __future__ import annotations

import json

from pydantic import BaseModel

from app.schemas.spec import DiagramBRDSpec


def build_generation_prompts(payload: dict, interpreted: dict) -> tuple[str, str]:
    system_prompt = (
        "Ban la AI business analyst. Nhiem vu la sinh duy nhat mot JSON hop le "
        "khop chinh xac voi schema duoc cung cap. Khong them text ngoai JSON. "
        "Khong bịa actor, step, hay nhánh không tồn tại trong diagram. "
        "Neu decision edge khong co label, giu status la unlabeled va dua vao open_questions. "
        "Trong cac truong mo ta reader-facing, khong dua raw node id hoac lane id vao cau van."
    )
    user_content = json.dumps(
        {
            "schema": DiagramBRDSpec.model_json_schema(),
            "diagram": payload,
            "interpreted": interpreted,
        },
        ensure_ascii=False,
        default=_json_default,
    )
    return system_prompt, user_content


def _json_default(value):
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    raise TypeError(f"Object of type {value.__class__.__name__} is not JSON serializable")
