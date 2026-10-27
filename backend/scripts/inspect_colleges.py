import sqlite3
import re
import json

conn = sqlite3.connect('scripts/local_copy.sqlite')
cursor = conn.cursor()

# Get all authors with their submission info
cursor.execute('''
    SELECT 
        a.id, a.submission_id, a.is_primary, a.first_name, a.last_name, a.email, a.college,
        s.submission_code, s.title, s.status, s.payment_status, s.deleted_at
    FROM authors a
    LEFT JOIN submissions s ON a.submission_id = s.id
''')
authors = cursor.fetchall()

print(f"Total authors loaded: {len(authors)}")

# Check distinct raw colleges
raw_colleges = set()
for a in authors:
    c = (a[6] or '').strip()
    if c:
        raw_colleges.add(c)

print(f"Total distinct non-empty raw college strings: {len(raw_colleges)}")

with open('scripts/raw_colleges_list.txt', 'w', encoding='utf-8') as f:
    for c in sorted(raw_colleges):
        f.write(c + '\n')

conn.close()
