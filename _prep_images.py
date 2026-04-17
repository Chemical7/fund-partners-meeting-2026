"""Copy & downscale partner meeting images into this folder.

Reads from: temp/Fund Partners meeting resources/
Writes to: ./images/<slug>.jpg (1600w max, quality 85)
Produces: data/images.json manifest
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).parent
SRC = HERE.parents[2] / "temp" / "Fund Partners meeting resources"
OUT_IMG = HERE / "images"
OUT_MANIFEST = HERE / "data" / "images.json"
OUT_IMG.mkdir(parents=True, exist_ok=True)
OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)

MAX_W = 1600
QUALITY = 85
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "img"


# Section tag = parent folder slug
FOLDER_MAP = {
    "AgroEknor": "agroeknor",
    "Aruwa Capital": "aruwa",
    "East Africa Video Stills": "east-africa",
    "IV - Kazanz Fund": "kazana",
    "Kaduna Visit  - Tomato Jos": "tomato-jos",
    "Koolboks": "koolboks",
    "Roundtables": "roundtables",
    "Taeillio": "taeillio",
    "Wemy Industries": "wemy",
}

# Further subdivide east-africa by filename prefix
EA_SUBTAGS = {
    "mastercard_kenya": "kenya",
    "mastercard_uganda_equator-chocolate": "uganda-equator",
    "mastercard_uganda_forma-foods": "uganda-forma",
    "mastercard_uganda_inua-capital": "uganda-inua",
}

manifest = []
seen_dest = set()
for src in sorted(SRC.rglob("*")):
    if src.suffix.lower() not in IMG_EXT:
        continue
    # Walk up parents to find a known section folder
    section = None
    for p in src.parents:
        if p == SRC:
            break
        if p.name in FOLDER_MAP:
            section = FOLDER_MAP[p.name]
            break
    if section is None:
        section = slugify(src.parent.name)

    # east africa sub-tagging
    sub = None
    if section == "east-africa":
        lname = src.name.lower()
        for prefix, tag in EA_SUBTAGS.items():
            if prefix in lname:
                sub = tag
                break
        if sub is None:
            sub = "kenya" if "kenya" in lname else "other"

    slug = slugify(src.stem)[:48]
    dest_name = f"{section}--{slug}.jpg"
    # ensure uniqueness
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
        manifest.append({
            "file": f"images/{dest_name}",
            "section": section,
            "sub": sub,
            "orig_name": src.name,
            "w": img.size[0],
            "h": img.size[1],
        })
        print(f"  {dest_name} ({img.size[0]}x{img.size[1]})")
    except Exception as e:
        print(f"SKIP {src.name}: {e}")

OUT_MANIFEST.write_text(json.dumps(manifest, indent=2))
print(f"\nwrote {len(manifest)} images, manifest at {OUT_MANIFEST}")
