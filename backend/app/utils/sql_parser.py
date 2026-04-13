import sqlparse
import re
from typing import Optional, List
from collections import defaultdict


class SQLFingerprintExtractor:
    
    @staticmethod
    def normalize_sql(sql: str) -> str:
        sql = sql.strip()
        sql = re.sub(r'\s+', ' ', sql)
        sql = re.sub(r"'[^']*'", "'?'", sql)
        sql = re.sub(r'"[^"]*"', '"?"', sql)
        sql = re.sub(r'\b\d+\b', '?', sql)
        sql = re.sub(r'\b0x[0-9a-fA-F]+\b', '?', sql)
        sql = sql.upper()
        
        return sql
    
    @staticmethod
    def extract_fingerprint(sql: str) -> str:
        normalized = SQLFingerprintExtractor.normalize_sql(sql)
        
        formatted = sqlparse.format(normalized, reindent=True, keyword_case='upper')
        
        fingerprint = re.sub(r'\s+', ' ', formatted).strip()
        
        return fingerprint
    
    @staticmethod
    def calculate_similarity(sql1: str, sql2: str) -> float:
        fp1 = SQLFingerprintExtractor.extract_fingerprint(sql1)
        fp2 = SQLFingerprintExtractor.extract_fingerprint(sql2)
        
        if fp1 == fp2:
            return 1.0
        
        words1 = set(fp1.split())
        words2 = set(fp2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0


class SlowQueryParser:
    
    @staticmethod
    def parse_mysql_slow_log(log_line: str) -> Optional[dict]:
        pattern = r'# Time: (?P<timestamp>.+?)\n# User@Host: (?P<user>.+?)\n# Query_time: (?P<query_time>.+?)\s+Lock_time: (?P<lock_time>.+?)\s+Rows_sent: (?P<rows_sent>.+?)\s+Rows_examined: (?P<rows_examined>.+?)\n(?P<database>use\s+([^;]+);)?\n(?P<sql>.+)'
        
        match = re.search(pattern, log_line, re.DOTALL)
        if match:
            return {
                'timestamp': match.group('timestamp'),
                'user': match.group('user'),
                'query_time': float(match.group('query_time')),
                'lock_time': float(match.group('lock_time')),
                'rows_sent': int(match.group('rows_sent')),
                'rows_examined': int(match.group('rows_examined')),
                'database': match.group('database'),
                'sql': match.group('sql').strip()
            }
        return None
    
    @staticmethod
    def parse_simple_format(log_entry: dict) -> dict:
        fingerprint = SQLFingerprintExtractor.extract_fingerprint(log_entry.get('sql', ''))
        
        return {
            'sql_fingerprint': fingerprint,
            'sql_text': log_entry.get('sql', ''),
            'execution_time': log_entry.get('query_time', 0),
            'lock_time': log_entry.get('lock_time', 0),
            'rows_sent': log_entry.get('rows_sent', 0),
            'rows_examined': log_entry.get('rows_examined', 0),
            'database': log_entry.get('database', ''),
            'client_ip': log_entry.get('client_ip', ''),
            'user': log_entry.get('user', '')
        }


class QueryCluster:
    
    def __init__(self):
        self.clusters = defaultdict(list)
        self.fingerprint_map = {}
    
    def add_query(self, sql: str, metadata: dict):
        fingerprint = SQLFingerprintExtractor.extract_fingerprint(sql)
        self.clusters[fingerprint].append(metadata)
        self.fingerprint_map[fingerprint] = sql
    
    def get_clusters(self) -> dict:
        result = {}
        for fingerprint, queries in self.clusters.items():
            result[fingerprint] = {
                'count': len(queries),
                'avg_execution_time': sum(q.get('execution_time', 0) for q in queries) / len(queries),
                'max_execution_time': max(q.get('execution_time', 0) for q in queries),
                'total_rows_examined': sum(q.get('rows_examined', 0) for q in queries),
                'sample_sql': self.fingerprint_map.get(fingerprint, ''),
                'queries': queries
            }
        return result
    
    def get_top_slow_queries(self, top_n: int = 10) -> List[dict]:
        clusters = self.get_clusters()
        sorted_clusters = sorted(
            clusters.values(),
            key=lambda x: x['avg_execution_time'] * x['count'],
            reverse=True
        )
        return sorted_clusters[:top_n]
