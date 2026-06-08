from __future__ import annotations

import json
from copy import deepcopy
from http.client import HTTPException, IncompleteRead, RemoteDisconnected
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ValidationError

from app.config import Settings

from .base import ProviderResult, ProviderUsage


class OpenRouterProviderError(Exception):
    def __init__(self, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class OpenRouterProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def generate_structured(
        self,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        model: str,
    ) -> ProviderResult:
        api_key = self._settings.ai_openrouter_api_key or self._settings.openrouter_api_key
        if not api_key:
            raise OpenRouterProviderError("Missing AI_OPENROUTER_API_KEY.", retryable=False)

        request_body = {
            "model": model,
            "temperature": 0.2,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": response_schema.__name__,
                    "strict": True,
                    "schema": build_openai_strict_schema(response_schema),
                },
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        http_referer = (
            self._settings.ai_openrouter_http_referer
            or self._settings.openrouter_http_referer
        )
        app_title = self._settings.ai_openrouter_app_title or self._settings.openrouter_app_title
        if http_referer:
            headers["HTTP-Referer"] = http_referer
        if app_title:
            headers["X-Title"] = app_title

        request = Request(
            f"{self._settings.ai_openrouter_base_url or self._settings.openrouter_base_url}/chat/completions",
            data=json.dumps(request_body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._settings.ai_timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise OpenRouterProviderError(
                f"OpenRouter HTTP {exc.code}: {detail or exc.reason}",
                retryable=exc.code >= 500 or exc.code == 429,
            ) from exc
        except URLError as exc:
            raise OpenRouterProviderError(
                f"OpenRouter network error: {exc.reason}", retryable=True
            ) from exc
        except (IncompleteRead, RemoteDisconnected, HTTPException, ConnectionError, TimeoutError) as exc:
            raise OpenRouterProviderError(_transport_error_message(exc), retryable=True) from exc

        content = _extract_content(payload)
        try:
            output = response_schema.model_validate(json.loads(content))
        except json.JSONDecodeError as exc:
            raise OpenRouterProviderError("Model returned non-JSON content.", retryable=True) from exc
        except ValidationError as exc:
            message = exc.errors()[0].get("msg", "unknown validation error")
            raise OpenRouterProviderError(
                f"Model returned JSON khong khop schema: {message}", retryable=True
            ) from exc

        usage = payload.get("usage") or {}
        return ProviderResult(
            output=output,
            usage=ProviderUsage(
                estimated_cost_usd=_to_float(usage.get("cost")),
                prompt_tokens=_to_int(usage.get("prompt_tokens")),
                completion_tokens=_to_int(usage.get("completion_tokens")),
                total_tokens=_to_int(usage.get("total_tokens")),
            ),
        )


def build_openai_strict_schema(response_schema: type[BaseModel]) -> dict[str, Any]:
    schema = deepcopy(response_schema.model_json_schema())
    _normalize_openai_strict_schema(schema)
    return schema


def _normalize_openai_strict_schema(node: Any) -> None:
    if isinstance(node, dict):
        properties = node.get("properties")
        if isinstance(properties, dict):
            node["required"] = list(properties.keys())
            node["additionalProperties"] = False
        for child in node.values():
            _normalize_openai_strict_schema(child)
    elif isinstance(node, list):
        for item in node:
            _normalize_openai_strict_schema(item)


def _extract_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise OpenRouterProviderError("OpenRouter returned no choices.", retryable=True)
    content = (choices[0].get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            item.get("text", "") if isinstance(item, dict) else item
            for item in content
            if isinstance(item, (dict, str))
        ]
        if any(parts):
            return "".join(parts)
    raise OpenRouterProviderError("OpenRouter returned unsupported content shape.", retryable=True)


def _to_float(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def _to_int(value: Any) -> int | None:
    return int(value) if isinstance(value, (int, float)) else None


def _transport_error_message(exc: Exception) -> str:
    if isinstance(exc, IncompleteRead):
        return (
            "OpenRouter trả response không hoàn chỉnh trong lúc stream dữ liệu. "
            f"Đã đọc được {len(exc.partial or b'')} bytes trước khi kết nối bị ngắt."
        )
    if isinstance(exc, RemoteDisconnected):
        return "OpenRouter đóng kết nối trước khi trả xong response."
    return f"OpenRouter transport error: {exc}"
