import sqlite3
import os

db_path = 'scripts/local_copy.sqlite'
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
conn.execute('PRAGMA synchronous = OFF;')
conn.execute('PRAGMA journal_mode = MEMORY;')
conn.execute('PRAGMA defer_foreign_keys = ON;')

cursor = conn.cursor()

with open('scripts/remote_dump.sql', 'r', encoding='utf-8') as f:
    sql_script = f.read()

# Wrap in transaction for instant bulk insertion
cursor.execute('BEGIN TRANSACTION;')
cursor.executescript(sql_script)
conn.commit()

cursor.execute('SELECT count(*) FROM submissions')
sub_count = cursor.fetchone()[0]
cursor.execute('SELECT count(*) FROM authors')
auth_count = cursor.fetchone()[0]

print(f'Done! Local SQLite DB built.')
print(f'Submissions: {sub_count}, Authors: {auth_count}')
conn.close()
