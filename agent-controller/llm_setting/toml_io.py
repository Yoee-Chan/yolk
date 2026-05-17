"""读写 local-llm-engine/config/config.toml 的 [llm] 段。"""
from __future__ import annotations

import os
import re
import tomllib
from typing import Any


def read_llm_section(toml_path: str) -> dict[str, Any]:
    if not os.path.exists(toml_path):
        return {}
    with open(toml_path, "rb") as f:
        raw = tomllib.load(f)
    llm = raw.get("llm", {})
    if not isinstance(llm, dict):
        return {}
    return {k: v for k, v in llm.items() if not isinstance(v, dict)}


def write_llm_section(toml_path: str, llm_values: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(toml_path), exist_ok=True)
    if os.path.exists(toml_path):
        with open(toml_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "# Global LLM configuration\n"

    block_lines = ["[llm]"]
    for key, value in llm_values.items():
        if value is None:
            continue
        if isinstance(value, str):
            block_lines.append(f'{key} = "{_escape_toml_str(value)}"')
        elif isinstance(value, bool):
            block_lines.append(f"{key} = {'true' if value else 'false'}")
        else:
            block_lines.append(f"{key} = {value}")
    new_block = "\n".join(block_lines) + "\n"

    pattern = re.compile(r"(?ms)^\[llm\]\s*\n.*?(?=^\[|\Z)")
    if pattern.search(content):
        content = pattern.sub(new_block, content, count=1)
    else:
        content = content.rstrip() + "\n\n" + new_block

    with open(toml_path, "w", encoding="utf-8") as f:
        f.write(content)


def _escape_toml_str(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')
