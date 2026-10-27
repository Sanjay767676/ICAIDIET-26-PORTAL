import sqlite3
import re
from collections import defaultdict
from compute_cbe_stats import get_canonical_college

conn = sqlite3.connect('scripts/local_copy.sqlite')
cursor = conn.cursor()

# Get all active submissions with payment_status
cursor.execute('''
    SELECT s.id, s.submission_code, s.title, s.payment_status,
           a.id, a.is_primary, a.first_name, a.last_name, a.college
    FROM submissions s
    JOIN authors a ON s.id = a.submission_id
    WHERE s.deleted_at IS NULL
''')
rows = cursor.fetchall()

subs = defaultdict(list)
for r in rows:
    sub_id = r[0]
    subs[sub_id].append({
        'sub_code': r[1],
        'title': r[2],
        'payment_status': r[3],
        'author_id': r[4],
        'is_primary': r[5],
        'name': f"{r[6]} {r[7]}",
        'college': r[8]
    })

total_active_subs = len(subs)
total_paid_subs = sum(1 for s in subs.values() if s[0]['payment_status'] == 'APPROVED')

# CBE metrics
cbe_authors_all_active = 0
cbe_authors_in_paid_papers = 0

paid_subs_primary_cbe = set()
all_subs_primary_cbe = set()

paid_subs_any_cbe = set()
all_subs_any_cbe = set()

cbe_college_paid_subs = defaultdict(set)
cbe_college_paid_authors = defaultdict(int)

for sub_id, auth_list in subs.items():
    is_paid = (auth_list[0]['payment_status'] == 'APPROVED')
    
    has_cbe = False
    primary_cbe = False
    
    for a in auth_list:
        res = get_canonical_college(a['college'])
        if res['is_cbe']:
            cbe_authors_all_active += 1
            has_cbe = True
            if a['is_primary'] == 1:
                primary_cbe = True
            if is_paid:
                cbe_authors_in_paid_papers += 1
                cbe_college_paid_authors[res['canonical']] += 1
                cbe_college_paid_subs[res['canonical']].add(sub_id)

    if has_cbe:
        all_subs_any_cbe.add(sub_id)
        if is_paid:
            paid_subs_any_cbe.add(sub_id)

    if primary_cbe:
        all_subs_primary_cbe.add(sub_id)
        if is_paid:
            paid_subs_primary_cbe.add(sub_id)

print(f"==================================================")
print(f"CONFERENCE OVERVIEW:")
print(f"  Total Active Papers / Submissions: {total_active_subs}")
print(f"  Total Conference Papers PAID: {total_paid_subs}")
print(f"==================================================")
print(f"COIMBATORE (CBE) METRICS:")
print(f"  Total CBE Authors Count (All Active Papers): {cbe_authors_all_active}")
print(f"  Total CBE Authors Count (Only PAID Papers): {cbe_authors_in_paid_papers}")
print(f"  --------------------------------------------------")
print(f"  Total CBE Papers (Primary author from CBE): {len(all_subs_primary_cbe)}")
print(f"  Total CBE Papers PAID (Primary author from CBE): {len(paid_subs_primary_cbe)}")
print(f"  --------------------------------------------------")
print(f"  Total Papers with At Least 1 CBE Author: {len(all_subs_any_cbe)}")
print(f"  Total Papers with At Least 1 CBE Author PAID: {len(paid_subs_any_cbe)}")
print(f"==================================================")
print(f"{'CBE College':<55}{'Paid Papers':<15}{'Paid Authors':<15}")
print(f"-" * 85)
for col, p_subs in sorted(cbe_college_paid_subs.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"{col:<55}{len(p_subs):<15}{cbe_college_paid_authors[col]:<15}")

conn.close()
