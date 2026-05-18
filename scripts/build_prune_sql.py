"""Generate .scrape-log/prune_non_v2.sql: deletes notices_v2 rows whose
(region, sub_entity) is not in the v2 regions.json. UTF-8 output, safe to
paste into the Supabase SQL editor.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGIONS = ROOT / "src" / "data" / "regions.json"
OUT = ROOT / ".scrape-log" / "prune_non_v2.sql"

data = json.loads(REGIONS.read_text(encoding="utf-8"))
pairs = sorted({(r["region"], s["name"]) for r in data for s in r["subEntities"]})

lines = [
    "-- Prune notices_v2 rows whose (region, sub_entity) is NOT one of the 88 v2 entries.",
    "-- Generated from src/data/regions.json. Safe to re-run.",
    "delete from notices_v2",
    " where (region, sub_entity) not in (",
]
for i, (r, s) in enumerate(pairs):
    end = "," if i < len(pairs) - 1 else ""
    rs = r.replace("'", "''")
    ss = s.replace("'", "''")
    lines.append(f"   ('{rs}', '{ss}'){end}")
lines.append(" );")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT} ({len(lines)} lines, {len(pairs)} pairs)")
