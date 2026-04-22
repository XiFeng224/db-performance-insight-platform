import sqlite3

conn = sqlite3.connect('backend/data/platform.db')
cursor = conn.cursor()

# Get all tables
tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', [t[0] for t in tables])
print()

# Count rows in each table
for table in tables:
    table_name = table[0]
    count = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f'{table_name}: {count} rows')

conn.close()