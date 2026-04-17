"""Process new partner meeting images into the existing images/ folder and
update images.json manifest.

Source: temp/New Fund pics for Partners meeting presentation/
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).parent
SRC = HERE.parents[2] / "temp" / "New Fund pics for Partners meeting presentation"
OUT_IMG = HERE / "images"
MANIFEST = HERE / "data" / "images.json"

MAX_W = 1600
QUALITY = 85
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "img"


FOLDER_MAP = {
    "AVPA 2025": "avpa-2025",
}

FILENAME_SECTION_MAP = {
    "cape town": "superreturn",
    "fund launch": "fund-launch",
    "weave capital": "weave",
    "nigeria round": "roundtables",
    "mastercard_kenya": "east-africa",
    "mastercard_uganda": "east-africa",
    "_shd": "portfolio-new",
}

existing = json.loads(MANIFEST.read_text())
existing_files = {e["file"] for e in existing}
seen_dest = {Path(f).name for f in existing_files}

new_entries = []
for src in sorted(SRC.rglob("*")):
    if src.suffix.lower() not in IMG_EXT:
        continue

    parent = src.parent.name
    section = FOLDER_MAP.get(parent, None)
    if section is None:
        lname = src.name.lower()
        for key, tag in FILENAME_SECTION_MAP.items():
            if key in lname:
                section = tag
                break
    if section is None:
        section = slugify(parent) if parent != SRC.name else "misc"

    slug = slugify(src.stem)[:52]
    dest_name = f"{section}--{slug}.jpg"
    suffix = 2
    while dest_name in seen_dest:
        dest_name = f"{section}--{slug}-{suffix}.jpg"
        suffix += 1
    seen_dest.add(dest_name)
    dest = OUT_IMG / dest_name

    try:
        img = Image.open(src)
        img = ImageOps.exif_transpose(img).convert("RGB")
        w, h = img.size
        if w > MAX_W:
            new_h = int(h * MAX_W / w)
            img = img.resize((MAX_W, new_h), Image.LANCZOS)
        img.save(dest, "JPEG", quality=QUALITY, optimize=True)
        entry = {
            "file": f"images/{dest_name}",
            "section": section,
            "sub": None,
            "orig_name": src.name,
            "w": img.size[0],
            "h": img.size[1],
        }
        new_entries.append(entry)
        existing.append(entry)
        print(f"  {dest_name} ({img.size[0]}x{img.size[1]})")
    except Exception as e:
        print(f"SKIP {src.name}: {e}")

MANIFEST.write_text(json.dumps(existing, indent=2))
print(f"\nadded {len(new_entries)} new images (total now {len(existing)})")
