import sqlite3

path = 'backend/data/platform.db'
conn = sqlite3.connect(path)
cursor = conn.cursor()

tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print(f'Database: {path}')
print('Tables:', [t[0] for t in tables])
print()

for table in tables:
    table_name = table[0]
    count = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f'  {table_name}: {count} rows')

# Show sample data
print()
print('Sample tickets:')
tickets = cursor.execute("SELECT id, title, status, severity FROM tickets LIMIT 5").fetchall()
for t in tickets:
    print(f'  {t}')

print()
print('Sample knowledge articles:')
articles = cursor.execute("SELECT id, title, category FROM knowledge_articles LIMIT 5").fetchall()
for a in articles:
    print(f'  {a}')

conn.close()