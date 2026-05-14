# -*- mode: python ; coding: utf-8 -*-
# 将 local-llm-engine/app 整包打入 exe，否则运行时报 No module named 'app'
import os
import sys

from PyInstaller.utils.hooks import collect_all, collect_data_files

spec_dir = os.path.dirname(os.path.abspath(SPEC))
repo_root = os.path.dirname(spec_dir)
LLM_ENGINE_DIR = os.path.join(repo_root, "local-llm-engine")
sys.path.insert(0, LLM_ENGINE_DIR)

datas = []
binaries = []
hiddenimports = []

d, b, h = collect_all("app")
datas += d
binaries += b
hiddenimports += h

# collect_all 导入 app.tool 时需 structlog；部分环境未装会导致子模块收集不完整
hiddenimports.append("structlog")
hiddenimports.append("daytona_sdk")
config_dir = os.path.join(LLM_ENGINE_DIR, "config")
datas += [(config_dir, "config")]

# 默认 workspace 目录（若不存在则仅打包空占位会在运行时由引擎创建）
_workspace = os.path.join(LLM_ENGINE_DIR, "workspace")
if os.path.isdir(_workspace):
    datas += [(_workspace, "workspace")]

datas += [(os.path.join(spec_dir, "llm_config"), "llm_config")]

try:
    datas += collect_data_files("tiktoken")
except Exception:
    pass

try:
    import tiktoken_ext

    for _plugin_root in getattr(tiktoken_ext, "__path__", []):
        datas.append((_plugin_root, "tiktoken_ext"))
except Exception:
    pass

hiddenimports.append("tiktoken_ext.openai_public")

a = Analysis(
    ["agent_stream.py"],
    pathex=[LLM_ENGINE_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="agent_stream",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
