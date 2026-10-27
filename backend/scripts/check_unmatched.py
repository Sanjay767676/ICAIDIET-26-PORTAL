import json

with open('scripts/cbe_unmatched.json', 'r', encoding='utf-8') as f:
    unmatched = json.load(f)

print(f"Total unmatched entries: {len(unmatched)}")

# Check if any have 'coimbatore' or 'cbe' or 'pollachi'
cbe_keywords = ['coimbatore', 'cbe', 'pollachi', 'kinathukadavu', 'arasur', 'saravanampatti', 'malumichampatti', 'navakkarai', 'eachanari', 'thudiyalur', 'peelamedu', 'kuniamuthur', 'kovaipudur']

for u in unmatched:
    low = u.lower()
    for kw in cbe_keywords:
        if kw in low:
            print(f"Found keyword '{kw}': {u}")

