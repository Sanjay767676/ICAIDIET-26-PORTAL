import sqlite3
import json
from collections import defaultdict

conn = sqlite3.connect('scripts/local_copy.sqlite')
cursor = conn.cursor()

# 1. Total authors and distinct raw college strings
cursor.execute('''
    SELECT a.college, COUNT(*) as cnt
    FROM authors a
    JOIN submissions s ON a.submission_id = s.id
    WHERE s.deleted_at IS NULL AND a.college IS NOT NULL AND TRIM(a.college) != ''
    GROUP BY a.college
    ORDER BY cnt DESC
''')
active_colleges = cursor.fetchall()
print(f"Total distinct raw college strings (active submissions): {len(active_colleges)}")

cursor.execute('''
    SELECT college, COUNT(*) as cnt
    FROM authors
    WHERE college IS NOT NULL AND TRIM(college) != ''
    GROUP BY college
    ORDER BY cnt DESC
''')
all_colleges = cursor.fetchall()
print(f"Total distinct raw college strings (all submissions including soft-deleted): {len(all_colleges)}")

# Let's inspect some of the college strings
with open('scripts/all_raw_colleges.json', 'w', encoding='utf-8') as f:
    json.dump([{'college': r[0], 'count': r[1]} for r in active_colleges], f, indent=2)

conn.close()
