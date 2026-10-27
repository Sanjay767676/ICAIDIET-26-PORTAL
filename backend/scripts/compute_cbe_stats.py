import sqlite3
import re
import json
from collections import defaultdict

conn = sqlite3.connect('scripts/local_copy.sqlite')
cursor = conn.cursor()

def get_canonical_college(raw):
    s = re.sub(r'\s+', ' ', (raw or '').strip())
    if not s or s.lower() == 'ddd':
        return {'canonical': 'Unspecified / Test', 'is_cbe': False, 'city': 'Unknown'}
    
    lower = s.lower()
    
    # 1. Non-CBE overrides (prevent false positives)
    if any(k in lower for k in ['hindustan institute of technology and science', 'hits', 'hindustan university']):
        return {'canonical': 'Hindustan Institute of Technology and Science (HITS)', 'is_cbe': False, 'city': 'Chennai'}
    if 'nehru college of engineering and research centre' in lower:
        return {'canonical': 'Nehru College of Engineering and Research Centre', 'is_cbe': False, 'city': 'Pampady, Kerala'}
    if 'bannari amman' in lower:
        return {'canonical': 'Bannari Amman Institute of Technology', 'is_cbe': False, 'city': 'Sathyamangalam, Erode'}
    if 'kongu engineering' in lower or 'kongu engg' in lower:
        return {'canonical': 'Kongu Engineering College', 'is_cbe': False, 'city': 'Perundurai, Erode'}
    if 'erode sengunthar' in lower:
        return {'canonical': 'Erode Sengunthar Engineering College', 'is_cbe': False, 'city': 'Erode'}
    if 'nandha college' in lower:
        return {'canonical': 'Nandha College of Technology', 'is_cbe': False, 'city': 'Erode'}
    if any(k in lower for k in ['k.s. rangasamy', 'k.s.rangasamy', 'k s rangasamy', 'ksr']):
        return {'canonical': 'K.S. Rangasamy College of Technology', 'is_cbe': False, 'city': 'Tiruchengode, Namakkal'}
    if 'm kumarasamy' in lower or 'm.kumarasamy' in lower:
        return {'canonical': 'M. Kumarasamy College of Engineering', 'is_cbe': False, 'city': 'Karur'}
    if 'l.r.g.' in lower or 'lrg' in lower:
        return {'canonical': 'L.R.G. Government Arts College for Women', 'is_cbe': False, 'city': 'Tirupur'}
    if 'csi college of engineering' in lower:
        return {'canonical': 'CSI College of Engineering', 'is_cbe': False, 'city': 'Ketti, Nilgiris'}

    # 2. Coimbatore Institutions (Normalized)
    # KIT Kalaignarkarunanidhi
    if any(k in lower for k in ['kalaignar', 'kit-kalaignar', 'kit - kalaignar', 'kit _ kalaignar', 'kit–kalaignar', 'kit \u2013 kalaignar', 'kit kalaignar', 'kalaingarkarunanidhi', 'kalainganr']):
        return {'canonical': 'KIT - Kalaignarkarunanidhi Institute of Technology', 'is_cbe': True, 'city': 'Coimbatore'}
    
    # SNS
    if 'sns college of technology' in lower or lower == 'snsct':
        return {'canonical': 'SNS College of Technology', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sns college of engineering' in lower or lower == 'snsce':
        return {'canonical': 'SNS College of Engineering', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sns' in lower:
        return {'canonical': 'SNS Institutions', 'is_cbe': True, 'city': 'Coimbatore'}

    # Sri Krishna
    if 'sri krishna college of technology' in lower or 'sri krishna college of technolog' in lower or lower == 'skct':
        return {'canonical': 'Sri Krishna College of Technology (SKCT)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sri krishna college of engineering' in lower or 'skcet' in lower:
        return {'canonical': 'Sri Krishna College of Engineering and Technology (SKCET)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sri krishna' in lower:
        return {'canonical': 'Sri Krishna Institutions', 'is_cbe': True, 'city': 'Coimbatore'}

    # KPR
    if 'kpr institute' in lower or 'kpriet' in lower:
        return {'canonical': 'KPR Institute of Engineering and Technology (KPRIET)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Dr. N.G.P.
    if any(k in lower for k in ['dr. n.g.p.', 'dr. n. g. p.', 'dr.n.g.p', 'dr ngp', 'dr. ngp', 'dr n.g.p']):
        return {'canonical': 'Dr. N.G.P. Institute of Technology', 'is_cbe': True, 'city': 'Coimbatore'}

    # Sri Ramakrishna
    if 'sri ramakrishna engineering college' in lower or 'sri ramaksrishna engineering college' in lower or lower == 'srec':
        return {'canonical': 'Sri Ramakrishna Engineering College (SREC)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sri ramakrishna institute of technology' in lower or lower == 'srit':
        return {'canonical': 'Sri Ramakrishna Institute of Technology (SRIT)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sri ramakrishna college of arts' in lower or lower == 'srcas':
        return {'canonical': 'Sri Ramakrishna College of Arts and Science', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'sri ramakrishna' in lower:
        return {'canonical': 'Sri Ramakrishna Institutions', 'is_cbe': True, 'city': 'Coimbatore'}

    # Karpagam
    if 'karpagam college of engineering' in lower or 'karpagam college and engineering' in lower or lower == 'kce':
        return {'canonical': 'Karpagam College of Engineering (KCE)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'karpagam institute of technology' in lower:
        return {'canonical': 'Karpagam Institute of Technology (KIT)', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'karpagam' in lower:
        return {'canonical': 'Karpagam Institutions (KAHE / KCE)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Kumaraguru
    if 'kumaraguru' in lower or lower == 'kct':
        return {'canonical': 'Kumaraguru College of Technology (KCT)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Sri Eshwar
    if 'sri eshwar' in lower or lower == 'sece':
        return {'canonical': 'Sri Eshwar College of Engineering (SECE)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Sri Shakthi
    if 'sri shakthi' in lower:
        return {'canonical': 'Sri Shakthi Institute of Engineering and Technology', 'is_cbe': True, 'city': 'Coimbatore'}

    # Hindusthan
    if 'hindusthan' in lower:
        return {'canonical': 'Hindusthan College of Engineering and Technology (HICET)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Karunya
    if 'karunya' in lower:
        return {'canonical': 'Karunya Institute of Technology and Sciences', 'is_cbe': True, 'city': 'Coimbatore'}

    # KGISL & KG College
    if 'kgisl' in lower:
        return {'canonical': 'KGISL Institute of Technology', 'is_cbe': True, 'city': 'Coimbatore'}
    if 'kg college of arts' in lower or 'kgcas' in lower:
        return {'canonical': 'KG College of Arts and Science', 'is_cbe': True, 'city': 'Coimbatore'}

    # PSG
    if 'psg' in lower:
        return {'canonical': 'PSG Institutions (PSG Tech / PSG iTech)', 'is_cbe': True, 'city': 'Coimbatore'}

    # CIT
    if 'coimbatore institute of technology' in lower or lower == 'cit':
        return {'canonical': 'Coimbatore Institute of Technology (CIT)', 'is_cbe': True, 'city': 'Coimbatore'}

    # GCT
    if any(k in lower for k in ['govt. college of technology', 'government college of technology', 'gct']):
        return {'canonical': 'Government College of Technology (GCT)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Dr. Mahalingam (Pollachi / Coimbatore District)
    if 'mahalingam' in lower or lower == 'mcet':
        return {'canonical': 'Dr. Mahalingam College of Engineering and Technology (MCET, Pollachi/CBE)', 'is_cbe': True, 'city': 'Pollachi/Coimbatore'}

    # VSB Coimbatore Campus
    if 'v.s.b' in lower or 'vsb' in lower:
        return {'canonical': 'V.S.B. College of Engineering Technical Campus (Coimbatore)', 'is_cbe': True, 'city': 'Coimbatore'}

    # Adithya
    if 'adithya institute' in lower:
        return {'canonical': 'Adithya Institute of Technology', 'is_cbe': True, 'city': 'Coimbatore'}

    # Akshaya
    if 'akshaya college' in lower:
        return {'canonical': 'Akshaya College of Engineering and Technology', 'is_cbe': True, 'city': 'Coimbatore'}

    # Sri Sai Ranganathan
    if 'sri sai ranganthan' in lower or 'sri sai ranganathan' in lower:
        return {'canonical': 'Sri Sai Ranganathan Engineering College', 'is_cbe': True, 'city': 'Coimbatore'}

    # EASA
    if 'easa college' in lower:
        return {'canonical': 'Easa College of Engineering and Technology', 'is_cbe': True, 'city': 'Coimbatore'}

    # Rathinam
    if 'rathinam' in lower:
        return {'canonical': 'Rathinam Technical Campus', 'is_cbe': True, 'city': 'Coimbatore'}

    # PROSUN
    if 'prosun energy' in lower:
        return {'canonical': 'PROSUN Energy Private Limited', 'is_cbe': True, 'city': 'Coimbatore'}

    # Generic CBE
    if 'coimbatore' in lower or 'cbe' in lower:
        return {'canonical': s, 'is_cbe': True, 'city': 'Coimbatore'}

    return {'canonical': s, 'is_cbe': False, 'city': 'Other / Unmapped'}


cursor.execute('''
    SELECT 
        a.id, a.submission_id, a.is_primary, a.first_name, a.last_name, a.email, a.college,
        s.submission_code, s.title, s.status, s.payment_status, s.deleted_at
    FROM authors a
    JOIN submissions s ON a.submission_id = s.id
''')
all_authors = cursor.fetchall()

def analyze_dataset(authors_subset, label):
    cbe_authors_count = 0
    non_cbe_authors_count = 0
    cbe_colleges_author_headcount = defaultdict(int)
    cbe_colleges_sub_ids = defaultdict(set)
    cbe_colleges_paid_subs = defaultdict(set)
    cbe_colleges_primary_authors = defaultdict(int)
    cbe_colleges_raw_names = defaultdict(set)
    
    all_raw_colleges_set = set()
    all_canonical_colleges_set = set()

    for a in authors_subset:
        raw_col = (a[6] or '').strip()
        if raw_col:
            all_raw_colleges_set.add(raw_col)
        res = get_canonical_college(raw_col)
        all_canonical_colleges_set.add(res['canonical'])
        
        if res['is_cbe']:
            cbe_authors_count += 1
            col_name = res['canonical']
            cbe_colleges_author_headcount[col_name] += 1
            cbe_colleges_sub_ids[col_name].add(a[1]) # submission_id
            cbe_colleges_raw_names[col_name].add(raw_col)
            if a[10] == 'APPROVED': # payment_status
                cbe_colleges_paid_subs[col_name].add(a[1])
            if a[2] == 1: # is_primary
                cbe_colleges_primary_authors[col_name] += 1
        else:
            non_cbe_authors_count += 1

    total_authors = len(authors_subset)
    distinct_subs = len(set(a[1] for a in authors_subset))

    sorted_colleges = sorted(cbe_colleges_author_headcount.items(), key=lambda x: x[1], reverse=True)

    return {
        'label': label,
        'total_submissions': distinct_subs,
        'total_authors': total_authors,
        'distinct_raw_colleges': len(all_raw_colleges_set),
        'distinct_canonical_colleges': len(all_canonical_colleges_set),
        'cbe_author_headcount': cbe_authors_count,
        'cbe_author_percentage': round(cbe_authors_count / total_authors * 100, 2),
        'cbe_colleges_count': len(cbe_colleges_author_headcount),
        'colleges_breakdown': [
            {
                'college': col,
                'author_headcount': count,
                'submissions_count': len(cbe_colleges_sub_ids[col]),
                'paid_submissions_count': len(cbe_colleges_paid_subs[col]),
                'primary_authors_count': cbe_colleges_primary_authors[col],
                'raw_name_variants_count': len(cbe_colleges_raw_names[col])
            }
            for col, count in sorted_colleges
        ]
    }

active_authors_subset = [a for a in all_authors if a[11] is None]
active_results = analyze_dataset(active_authors_subset, "ACTIVE SUBMISSIONS ONLY (Standard)")
all_results = analyze_dataset(all_authors, "ALL SUBMISSIONS (Including Soft-Deleted)")

with open('scripts/cbe_clean_analysis.json', 'w', encoding='utf-8') as f:
    json.dump({
        'active_submissions': active_results,
        'all_submissions_including_deleted': all_results
    }, f, indent=2)

print("SUCCESS: JSON saved to scripts/cbe_clean_analysis.json")
conn.close()
