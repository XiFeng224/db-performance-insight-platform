from prometheus_client import start_http_server, Gauge, Counter, Histogram
import pymysql
import time
from typing import Dict, Any
import threading


class MySQLMetricsExporter:
    
    def __init__(self, host='localhost', port=3306, user='root', password='', database='test'):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database
        self.connection = None
        
        self.qps = Gauge('mysql_qps', 'MySQL Queries Per Second')
        self.connections = Gauge('mysql_connections', 'MySQL Active Connections')
        self.slow_queries = Gauge('mysql_slow_queries_total', 'MySQL Slow Queries Total')
        self.uptime = Gauge('mysql_uptime_seconds', 'MySQL Uptime in Seconds')
        self.buffer_pool_size = Gauge('mysql_innodb_buffer_pool_size', 'InnoDB Buffer Pool Size')
        self.buffer_pool_reads = Gauge('mysql_innodb_buffer_pool_reads', 'InnoDB Buffer Pool Reads')
        self.buffer_pool_read_requests = Gauge('mysql_innodb_buffer_pool_read_requests', 'InnoDB Buffer Pool Read Requests')
        self.rows_read = Gauge('mysql_innodb_rows_read', 'InnoDB Rows Read')
        self.rows_inserted = Gauge('mysql_innodb_rows_inserted', 'InnoDB Rows Inserted')
        self.rows_updated = Gauge('mysql_innodb_rows_updated', 'InnoDB Rows Updated')
        self.rows_deleted = Gauge('mysql_innodb_rows_deleted', 'InnoDB Rows Deleted')
        
        self.running = False
        self.thread = None
    
    def connect(self):
        self.connection = pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.database,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
    
    def get_status_variables(self) -> Dict[str, Any]:
        if not self.connection:
            self.connect()
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("SHOW GLOBAL STATUS")
                return {row['Variable_name']: row['Value'] for row in cursor.fetchall()}
        except Exception as e:
            print(f"Error fetching status: {e}")
            return {}
    
    def collect_metrics(self):
        status = self.get_status_variables()
        
        if not status:
            return
        
        uptime = int(status.get('Uptime', 0))
        questions = int(status.get('Questions', 0))
        
        self.qps.set(questions / uptime if uptime > 0 else 0)
        self.connections.set(int(status.get('Threads_connected', 0)))
        self.slow_queries.set(int(status.get('Slow_queries', 0)))
        self.uptime.set(uptime)
        self.buffer_pool_size.set(int(status.get('Innodb_buffer_pool_size', 0)))
        self.buffer_pool_reads.set(int(status.get('Innodb_buffer_pool_reads', 0)))
        self.buffer_pool_read_requests.set(int(status.get('Innodb_buffer_pool_read_requests', 0)))
        self.rows_read.set(int(status.get('Innodb_rows_read', 0)))
        self.rows_inserted.set(int(status.get('Innodb_rows_inserted', 0)))
        self.rows_updated.set(int(status.get('Innodb_rows_updated', 0)))
        self.rows_deleted.set(int(status.get('Innodb_rows_deleted', 0)))
    
    def run(self, interval=15):
        self.running = True
        
        def _run():
            while self.running:
                try:
                    self.collect_metrics()
                except Exception as e:
                    print(f"Error collecting metrics: {e}")
                    try:
                        self.connect()
                    except Exception as conn_error:
                        print(f"Reconnection failed: {conn_error}")
                
                time.sleep(interval)
        
        self.thread = threading.Thread(target=_run, daemon=True)
        self.thread.start()
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        if self.connection:
            self.connection.close()


def main():
    exporter = MySQLMetricsExporter(
        host='localhost',
        port=3306,
        user='root',
        password='password',
        database='test'
    )
    
    start_http_server(9104)
    print("MySQL metrics exporter started on port 9104")
    
    exporter.run(interval=15)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down exporter...")
        exporter.stop()


if __name__ == '__main__':
    main()
