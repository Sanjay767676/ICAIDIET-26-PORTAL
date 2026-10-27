import sqlite3
import re
import json

known_cbe_patterns = [
    # Patterns and canonical names for Coimbatore institutions:
    (r'sns\s*(?:college\s*of\s*)?technology|snsct', 'SNS College of Technology'),
    (r'sns\s*(?:college\s*of\s*)?engineering|snsce', 'SNS College of Engineering'),
    (r'sns\s*(?:college\s*of\s*)?(?:arts|pharmacy|physiotherapy|academy|institutions)|sns\s+group', 'SNS Institutions (Other / Group)'),
    (r'sri\s*krishna\s*college\s*of\s*eng(?:ineering)?(?:\s*and\s*tech(?:nology)?)?|skcet', 'Sri Krishna College of Engineering and Technology (SKCET)'),
    (r'sri\s*krishna\s*college\s*of\s*technology|skct', 'Sri Krishna College of Technology (SKCT)'),
    (r'sri\s*krishna\s*arts\s*and\s*science|skasc', 'Sri Krishna Arts and Science College'),
    (r'kalaignar|kit[-\s_–]*kalaignar|kalaignarkarunanidhi|kalaingarkarunanidhi', 'KIT - Kalaignarkarunanidhi Institute of Technology'),
    (r'kpr\s*inst|kpriet', 'KPR Institute of Engineering and Technology'),
    (r'kumaraguru|kct\b', 'Kumaraguru College of Technology (KCT)'),
    (r'sri\s*ramakrishna\s*eng(?:ineering)?\s*college|srec\b', 'Sri Ramakrishna Engineering College (SREC)'),
    (r'sri\s*ramakrishna\s*inst(?:itute)?\s*of\s*tech|srit\b', 'Sri Ramakrishna Institute of Technology (SRIT)'),
    (r'sri\s*ramakrishna\s*college\s*of\s*arts|srcas\b', 'Sri Ramakrishna College of Arts and Science'),
    (r'sri\s*ramakrishna\s*mission\s*vidyalaya', 'Sri Ramakrishna Mission Vidyalaya'),
    (r'sri\s*eshwar|sece\b', 'Sri Eshwar College of Engineering'),
    (r'sri\s*shakthi|sriet\b', 'Sri Shakthi Institute of Engineering and Technology'),
    (r'dr\.?\s*n\.?\s*g\.?\s*p\.?|ngp\b', 'Dr. N.G.P. Institute of Technology / Arts'),
    (r'hindusth?an\s*college\s*of\s*eng|hicet\b|hindusthan\s*inst.*tech|hindusthan', 'Hindusthan Institutions (HICET / HIT)'),
    (r'karpagam\s*college\s*of\s*eng|kce\b', 'Karpagam College of Engineering'),
    (r'karpagam\s*inst|kit\b(?!.*kalaignar)', 'Karpagam Institute of Technology'),
    (r'karpagam\s*acad|karpagam\s*univ|kahe\b|karpagam', 'Karpagam Academy of Higher Education / Karpagam Institutions'),
    (r'karunya', 'Karunya Institute of Technology and Sciences'),
    (r'kgisl\b|kg\s*information', 'KGISL Institute of Technology'),
    (r'kg\s*college\s*of\s*arts|kgcas\b', 'KG College of Arts and Science'),
    (r'psg\s*college|psg\s*tech|psg\s*itech|psg\b', 'PSG Institutions (PSG Tech / PSG iTech / CAS)'),
    (r'coimbatore\s*institute\s*of\s*tech|cit\b', 'Coimbatore Institute of Technology (CIT)'),
    (r'govt\.?\s*college\s*of\s*tech|gct\b', 'Government College of Technology (GCT)'),
    (r'dr\.?\s*mahalingam|mcet\b', 'Dr. Mahalingam College of Engineering and Technology (MCET, Pollachi/CBE)'),
    (r'akshaya\s*college', 'Akshaya College of Engineering and Technology'),
    (r'adithya\s*inst', 'Adithya Institute of Technology'),
    (r'sri\s*sai\s*ranganathan', 'Sri Sai Ranganathan Engineering College'),
    (r'rathinam', 'Rathinam Technical Campus / College'),
    (r'nehr?u\s*(?:college\s*of\s*a|arts|institute\s*of\s*tech|nit\b|niet\b)', 'Nehru Group of Institutions (Coimbatore)'),
    (r'avs\s*college|avinashilingam', 'Avinashilingam Institute for Home Science and Higher Education'),
    (r'bharathiar\s*univ', 'Bharathiar University'),
    (r'cms\s*college', 'CMS College of Science and Commerce / Engineering'),
    (r'sns\b', 'SNS Institutions'),
    (r'coimbatore|cbe\b', 'Other Coimbatore Institution'),
]

conn = sqlite3.connect('scripts/local_copy.sqlite')
cursor = conn.cursor()

cursor.execute('''
    SELECT 
        a.id, a.submission_id, a.is_primary, a.first_name, a.last_name, a.email, a.college,
        s.submission_code, s.title, s.status, s.payment_status, s.deleted_at
    FROM authors a
    LEFT JOIN submissions s ON a.submission_id = s.id
''')
authors = cursor.fetchall()

# Let's inspect all raw colleges and test against patterns
distinct_raw = set((a[6] or '').strip() for a in authors if (a[6] or '').strip())

matched_cbe = {}
unmatched = []

for raw in sorted(distinct_raw):
    lower = raw.lower()
    matched = False
    for pat, canonical in known_cbe_patterns:
        # Avoid matching HITS (Chennai) with Hindusthan
        if 'hindustan institute of technology and science' in lower or 'hits' in lower:
            break
        # Avoid matching Nehru College of Engineering and Research Centre (Pampady, Kerala)
        if 'pampady' in lower or 'thrissur' in lower or 'kerala' in lower:
            break
        # Avoid matching KIT - Kanpur or Kolhapur if any
        if re.search(pat, lower):
            matched_cbe[raw] = canonical
            matched = True
            break
    if not matched:
        unmatched.append(raw)

print(f"Matched Coimbatore raw strings: {len(matched_cbe)}")
print(f"Unmatched raw strings: {len(unmatched)}")

with open('scripts/cbe_matched.json', 'w', encoding='utf-8') as f:
    json.dump(matched_cbe, f, indent=2)

with open('scripts/cbe_unmatched.json', 'w', encoding='utf-8') as f:
    json.dump(unmatched, f, indent=2)

conn.close()
