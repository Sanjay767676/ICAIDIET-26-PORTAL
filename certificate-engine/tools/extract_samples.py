"""Pick generic test rows from a LOCAL D1 SQL export and write sample-participants.json.

Usage: python extract_samples.py <path-to-your-local-export.sql>

The output file is gitignored because it contains real author data from the dump.
No real names, colleges, or production backup paths are stored in this script.
"""
import json, os, sqlite3, sys

if len(sys.argv) < 2:
    raise SystemExit("Usage: python extract_samples.py <path-to-your-local-export.sql>")

sql = sys.argv[1]
db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row
try:
    db.executescript(open(sql, encoding="utf-8").read())
except sqlite3.Error as e:
    print("note:", e)  # some D1 statements do not load in sqlite; authors does

# Generic shape-based filters only: no real names or institutions.
queries = [
    "SELECT id, first_name, last_name, college, title FROM authors ORDER BY created_at LIMIT 1",
    "SELECT id, first_name, last_name, college, title FROM authors WHERE upper(first_name)=first_name ORDER BY RANDOM() LIMIT 1",
    "SELECT id, first_name, last_name, college, title FROM authors WHERE length(first_name || ' ' || last_name) > 25 ORDER BY RANDOM() LIMIT 1",
    "SELECT id, first_name, last_name, college, title FROM authors WHERE college LIKE '%College%' ORDER BY RANDOM() LIMIT 1",
    "SELECT id, first_name, last_name, college, title FROM authors WHERE college LIKE '%Institute%' ORDER BY RANDOM() LIMIT 1",
    "SELECT id, first_name, last_name, college, title FROM authors WHERE first_name LIKE 'Dr.%' OR first_name LIKE 'Dr %' ORDER BY RANDOM() LIMIT 1",
]

out = []
for query in queries:
    row = db.execute(query).fetchone()
    if row:
        out.append(dict(row))

dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sample-participants.json")
with open(dst, "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1)
print(f"wrote {len(out)} participants to {dst} (gitignored; do not commit)")
