"""Generate an editorial Africa coverage SVG for the ACG presentation.

Outputs assets/africa-coverage.svg with one <path> per country, each tagged
data-iso + data-name so the frontend can style covered vs uncovered countries
via CSS.
"""
import geopandas as gpd
from pathlib import Path

NE_SHP = "C:/Users/Brian/AppData/Roaming/Python/Python314/site-packages/pyogrio/tests/fixtures/naturalearth_lowres/naturalearth_lowres.shp"
OUT = Path(__file__).parent / "assets" / "africa-coverage.svg"

# Countries ACG/Fund has operated in (matches slide content + WEAVE/portfolio work)
COVERED = {
    "Nigeria", "Ghana", "Ethiopia", "Kenya", "Uganda",
    "Tanzania", "Rwanda", "South Africa", "Senegal", "Egypt",
    "Morocco", "Côte d'Ivoire",
}

def path_from_geom(geom, scale, ox, oy, max_y):
    """Convert a shapely geom to SVG path `d`. Flips Y for SVG convention."""
    parts = []
    polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    for poly in polys:
        rings = [poly.exterior] + list(poly.interiors)
        for ring in rings:
            coords = list(ring.coords)
            if not coords:
                continue
            pts = []
            for i, (x, y) in enumerate(coords):
                sx = (x - ox) * scale
                sy = max_y - (y - oy) * scale
                pts.append(f"{'M' if i == 0 else 'L'}{sx:.2f},{sy:.2f}")
            parts.append("".join(pts) + "Z")
    return "".join(parts)

def main():
    df = gpd.read_file(NE_SHP)
    africa = df[df["continent"] == "Africa"].copy()

    # Bounds
    minx, miny, maxx, maxy = africa.total_bounds
    # Pad slightly
    pad = 0.5
    minx -= pad; miny -= pad; maxx += pad; maxy += pad

    W, H = 560, 640
    scale = min(W / (maxx - minx), H / (maxy - miny))
    draw_w = (maxx - minx) * scale
    draw_h = (maxy - miny) * scale
    ox_off = (W - draw_w) / 2
    oy_off = (H - draw_h) / 2

    paths = []
    for _, row in africa.iterrows():
        name = row["name"]
        iso = row["iso_a3"]
        covered = "true" if name in COVERED else "false"
        d = path_from_geom(row.geometry, scale, minx, miny, draw_h)
        # Apply the left/top offset
        # (embed via transform instead of rewriting coords)
        paths.append(
            f'<path class="africa-country" data-name="{name}" data-iso="{iso}" '
            f'data-covered="{covered}" d="{d}"/>'
        )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'preserveAspectRatio="xMidYMid meet" class="africa-map">'
        f'<g transform="translate({ox_off:.2f},{oy_off:.2f})">'
        f'{"".join(paths)}'
        f'</g></svg>'
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg, encoding="utf-8")
    covered_ct = sum(1 for _, r in africa.iterrows() if r["name"] in COVERED)
    print(f"wrote {OUT} · {len(africa)} countries · {covered_ct} covered")

if __name__ == "__main__":
    main()
