from __future__ import annotations

import re


def normalize_inline_text(text: str | None) -> str:
    if not text:
        return ""
    collapsed = " ".join(part.strip() for part in text.splitlines() if part.strip())
    return re.sub(r"\s+", " ", collapsed).strip()


def split_structured_note(text: str | None) -> tuple[str, list[str]]:
    if not text:
        return ("", [])
    raw_lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not raw_lines:
        return ("", [])

    heading = normalize_inline_text(raw_lines[0]).rstrip(":").rstrip(".")
    bullet_items = [
        normalize_inline_text(line.lstrip("-").strip())
        for line in raw_lines[1:]
        if line.startswith("-")
    ]

    if bullet_items:
        return (heading, bullet_items)

    remaining = [normalize_inline_text(line) for line in raw_lines[1:]]
    if remaining:
        return (normalize_inline_text(" ".join([heading, *remaining])), [])
    return (heading, [])
