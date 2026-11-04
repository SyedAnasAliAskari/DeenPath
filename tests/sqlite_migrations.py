"""Real SQLite DDL/data preservation checks. Android SQLiteOpenHelper/device behavior is separate."""
from pathlib import Path
import sqlite3, re, json
source=Path('android/app/src/main/java/org/salahguard/app/LocalDatabase.kt').read_text(encoding='utf-8')
upgrade=source.split('override fun onUpgrade',1)[1].split('fun load',1)[0]
assert not re.search(r'\b(DROP|DELETE)\b',upgrade,re.I),'Upgrade must not delete user data'
statements=re.findall(r'"(CREATE TABLE IF NOT EXISTS [^"\n]+)"',upgrade)
for version in (1,2,3,4):
 db=sqlite3.connect(':memory:')
 db.execute('CREATE TABLE snapshots(id INTEGER PRIMARY KEY,value TEXT NOT NULL)')
 fixture=json.dumps({'schema':1,'records':[{'id':'counter:today','entity':'tasbih_progress','data':{'count':47}}],'queue':[{'id':'pending-uuid'}]})
 db.execute('INSERT INTO snapshots VALUES(1,?)',(fixture,))
 if version>=2:
  db.execute('CREATE TABLE reading_positions(path TEXT PRIMARY KEY,page INTEGER NOT NULL DEFAULT 0)')
  db.execute('INSERT INTO reading_positions VALUES(?,?)',('/private/document',12))
 for statement in statements:db.execute(statement)
 assert db.execute('SELECT value FROM snapshots').fetchone()[0]==fixture
 assert db.execute("SELECT name FROM sqlite_master WHERE name='native_meta'").fetchone()
 assert db.execute("SELECT name FROM sqlite_master WHERE name='reading_positions'").fetchone()
 assert db.execute("SELECT name FROM sqlite_master WHERE name='owned_card_texts'").fetchone()
 if version>=2:assert db.execute('SELECT page FROM reading_positions').fetchone()[0]==12
 db.close();print(f'PASS: SQLite {version} -> 5 preserves queued counter progress and reading position')
