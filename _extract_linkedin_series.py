"""Extract daily LinkedIn audience from the Sprout Profile CSV into a compact
JSON series consumable by app.js.

Source: temp/Profile Performance (The Fund) January 1, 2026 - March 31, 2026.csv
Output: data/linkedin.json  {start, end, points: [{date, count, delta}, ...]}
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE.parents[2] / "temp" / "Profile Performance (The Fund) January 1, 2026 - March 31, 2026.csv"
OUT = HERE / "data" / "linkedin.json"

points = []
with SRC.open(encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row.get("Network") != "LinkedIn":
            continue
        date = row["Date"]  # "01-01-2026"
        audience = row.get("Audience", "").replace(",", "").strip()
        if not audience:
            continue
        try:
            n = int(audience)
        except ValueError:
            continue
        # mm-dd-yyyy → yyyy-mm-dd
        parts = date.split("-")
        iso = f"{parts[2]}-{parts[0]}-{parts[1]}"
        points.append({"date": iso, "count": n})

points.sort(key=lambda p: p["date"])
start = points[0]["count"] if points else 0
for p in points:
    p["delta"] = p["count"] - start

data = {
    "start": start,
    "end": points[-1]["count"] if points else 0,
    "net": points[-1]["count"] - start if points else 0,
    "first_date": points[0]["date"] if points else None,
    "last_date": points[-1]["date"] if points else None,
    "points": points,
}

OUT.write_text(json.dumps(data, indent=2))
print(f"wrote {len(points)} daily points")
print(f"  start: {data['first_date']} = {data['start']:,}")
print(f"  end:   {data['last_date']} = {data['end']:,}")
print(f"  net:   +{data['net']:,}")
