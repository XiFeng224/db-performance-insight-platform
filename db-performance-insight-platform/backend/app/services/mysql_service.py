import pymysql
from typing import List, Dict, Any, Optional
from app.config import settings
import json


class MySQLConnection:
    
    def __init__(self):
        self.connection = None
    
    def connect(self):
        try:
            self.connection = pymysql.connect(
                host=settings.mysql_host,
                port=settings.mysql_port,
                user=settings.mysql_user,
                password=settings.mysql_password,
                database=settings.mysql_database,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor,
                use_unicode=True
            )
        except Exception as e:
            print(f"MySQL connection error: {e}")
            raise
    
    def disconnect(self):
        if self.connection:
            self.connection.close()
    
    def execute_query(self, query: str, params: tuple = None) -> List[Dict]:
        if not self.connection:
            self.connect()
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchall()
        except Exception as e:
            print(f"Query execution error: {e}")
            return []
    
    def get_status_variables(self) -> Dict[str, Any]:
        query = "SHOW GLOBAL STATUS"
        return {row['Variable_name']: row['Value'] for row in self.execute_query(query)}
    
    def get_processlist(self) -> List[Dict]:
        query = "SHOW PROCESSLIST"
        return self.execute_query(query)
    
    def get_table_info(self, table_name: str = None) -> List[Dict]:
        if table_name:
            query = f"SHOW TABLE STATUS LIKE '{table_name}'"
        else:
            query = "SHOW TABLE STATUS"
        return self.execute_query(query)
    
    def get_index_info(self, table_name: str) -> List[Dict]:
        query = f"SHOW INDEX FROM {table_name}"
        return self.execute_query(query)
    
    def get_schema_info(self) -> Dict[str, List[Dict]]:
        tables = self.get_table_info()
        schema_info = {}
        
        for table in tables:
            table_name = table['Name']
            schema_info[table_name] = {
                'table_info': table,
                'indexes': self.get_index_info(table_name)
            }
        
        return schema_info
    
    def explain_query(self, sql: str) -> Dict[str, Any]:
        query = f"EXPLAIN FORMAT=JSON {sql}"
        result = self.execute_query(query)
        if not result or 'EXPLAIN' not in result[0]:
            return {}
        try:
            explain_json = json.loads(result[0]['EXPLAIN'])
            return explain_json if isinstance(explain_json, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def get_slow_query_log_status(self) -> Dict[str, Any]:
        status = self.get_status_variables()
        return {
            'slow_query_log': status.get('Slow_query_log', 'OFF'),
            'slow_query_log_file': status.get('Slow_query_log_file', ''),
            'long_query_time': status.get('Long_query_time', '10')
        }
    
    def get_innodb_status(self) -> Dict[str, Any]:
        status = self.get_status_variables()
        return {
            'buffer_pool_size': status.get('Innodb_buffer_pool_size', 0),
            'buffer_pool_reads': status.get('Innodb_buffer_pool_reads', 0),
            'buffer_pool_read_requests': status.get('Innodb_buffer_pool_read_requests', 0),
            'rows_read': status.get('Innodb_rows_read', 0),
            'rows_inserted': status.get('Innodb_rows_inserted', 0),
            'rows_updated': status.get('Innodb_rows_updated', 0),
            'rows_deleted': status.get('Innodb_rows_deleted', 0)
        }
