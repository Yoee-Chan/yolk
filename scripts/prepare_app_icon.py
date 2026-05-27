"""从 yolk-log.png 裁切内容区域，生成桌面端用的正方形图标。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "yolk-log.png"
OUT_DIR = ROOT / "build"
PADDING_RATIO = 0.06


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        raise SystemExit(f"无法读取图标内容: {SRC}")

    cropped = img.crop(bbox)
    width, height = cropped.size
    side = max(width, height)
    pad = int(side * PADDING_RATIO)

    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    offset_x = (canvas.width - width) // 2
    offset_y = (canvas.height - height) // 2
    canvas.paste(cropped, (offset_x, offset_y), cropped)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (256, 512, 1024):
        out_path = OUT_DIR / f"icon-{size}.png"
        canvas.resize((size, size), Image.Resampling.LANCZOS).save(
            out_path, optimize=True
        )
        print(f"saved {out_path.relative_to(ROOT)}")

    master = OUT_DIR / "icon.png"
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(master, optimize=True)
    print(f"saved {master.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
