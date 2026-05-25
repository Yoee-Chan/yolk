# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "renderer" / "src" / "components" / "Chat.tsx"
text = p.read_text(encoding="utf-8")
text = text.replace("``);", "`);")  # fix double backtick before );
text = text.replace("[错误 ${code}]", "[进程退出码 ${code}]")
# user role in msg-role div only
text = text.replace(
    "{m.role === 'user' ? '\u00e4\u00bd\u00a0' : 'AI'}",
    "{m.role === 'user' ? '\u4f60' : 'AI'}",
)
text = text.replace(
    "{m.role === 'user' ? 'ä½\xa0' : 'AI'}",
    "{m.role === 'user' ? '\u4f60' : 'AI'}",
)
p.write_text(text, encoding="utf-8")
print("ok")
