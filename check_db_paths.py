import sqlite3

# 检查两个可能的数据库位置
paths = [
    'backend/data/platform.db',
    'c:/Users/HP/Desktop/项目一/backend/data/platform.db'
]

for path in paths:
    try:
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

        conn.close()
        print()
    except Exception as e:
        print(f'Error accessing {path}: {e}')
        print()