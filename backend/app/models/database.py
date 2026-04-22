from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text, Time
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class SlowQuery(Base):
    __tablename__ = "slow_queries"

    id = Column(Integer, primary_key=True, index=True)
    sql_fingerprint = Column(String(500), index=True)
    sql_text = Column(Text)
    execution_time = Column(Float)
    lock_time = Column(Float)
    rows_sent = Column(Integer)
    rows_examined = Column(Integer)
    database = Column(String(100), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    query_time = Column(Float)
    client_ip = Column(String(50))
    user = Column(String(100))

    def to_dict(self):
        return {
            "id": self.id,
            "sql_fingerprint": self.sql_fingerprint,
            "sql_text": self.sql_text,
            "execution_time": self.execution_time,
            "lock_time": self.lock_time,
            "rows_sent": self.rows_sent,
            "rows_examined": self.rows_examined,
            "database": self.database,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "query_time": self.query_time,
            "client_ip": self.client_ip,
            "user": self.user,
        }


class ExecutionPlan(Base):
    __tablename__ = "execution_plans"

    id = Column(Integer, primary_key=True, index=True)
    slow_query_id = Column(Integer, index=True)
    plan_json = Column(JSON)
    plan_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class OptimizationSuggestion(Base):
    __tablename__ = "optimization_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    slow_query_id = Column(Integer, index=True)
    suggestion_type = Column(String(100))
    description = Column(Text)
    priority = Column(String(20))
    impact_score = Column(Float)
    sql_statement = Column(Text)
    owner = Column(String(100), nullable=True)
    due_date = Column(String(20), nullable=True)
    exec_status = Column(String(20), default="todo")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    applied = Column(Boolean, default=False)
    applied_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "slow_query_id": self.slow_query_id,
            "suggestion_type": self.suggestion_type,
            "description": self.description,
            "priority": self.priority,
            "impact_score": self.impact_score,
            "sql_statement": self.sql_statement,
            "owner": self.owner,
            "due_date": self.due_date,
            "exec_status": self.exec_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "applied": self.applied,
            "applied_at": self.applied_at.isoformat() if self.applied_at else None,
        }


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), index=True)
    severity = Column(String(20))
    title = Column(String(200))
    message = Column(Text)
    threshold_value = Column(Float)
    current_value = Column(Float)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "threshold_value": self.threshold_value,
            "current_value": self.current_value,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class PerformanceSnapshot(Base):
    __tablename__ = "performance_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_name = Column(String(200))
    qps = Column(Float)
    active_connections = Column(Integer)
    slow_queries_count = Column(Integer)
    avg_execution_time = Column(Float)
    metrics_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "snapshot_name": self.snapshot_name,
            "qps": self.qps,
            "active_connections": self.active_connections,
            "slow_queries_count": self.slow_queries_count,
            "avg_execution_time": self.avg_execution_time,
            "metrics_data": self.metrics_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OpsActionLog(Base):
    __tablename__ = "ops_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), index=True)
    instance = Column(String(200), nullable=True, index=True)
    result = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "action": self.action,
            "instance": self.instance,
            "result": self.result,
            "time": self.created_at.isoformat() if self.created_at else None,
        }


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="general", index=True)
    severity = Column(String(20), default="medium", index=True)
    status = Column(String(30), default="pending", index=True)
    reporter_id = Column(Integer, nullable=True, index=True)
    assignee_id = Column(Integer, nullable=True, index=True)
    eta_minutes = Column(Integer, nullable=True)
    due_at = Column(DateTime, nullable=True)
    location = Column(String(200), nullable=True)
    asset_code = Column(String(100), nullable=True, index=True)
    adopted_optimization_suggestion_id = Column(Integer, nullable=True, index=True)
    adopted_optimization_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)
    closed_at = Column(DateTime, nullable=True)

    @staticmethod
    def _safe_iso(value: Any) -> str | None:
        if value is None:
            return None
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "severity": self.severity,
            "status": self.status,
            "reporter_id": self.reporter_id,
            "assignee_id": self.assignee_id,
            "eta_minutes": self.eta_minutes,
            "due_at": self._safe_iso(self.due_at),
            "location": self.location,
            "asset_code": self.asset_code,
            "adopted_optimization_suggestion_id": self.adopted_optimization_suggestion_id,
            "adopted_optimization_note": self.adopted_optimization_note,
            "created_at": self._safe_iso(self.created_at),
            "updated_at": self._safe_iso(self.updated_at),
            "closed_at": self._safe_iso(self.closed_at),
        }


class DutyShift(Base):
    __tablename__ = "duty_shifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String(50), default="assistant")
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class TicketEvent(Base):
    __tablename__ = "ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, nullable=False, index=True)
    actor_id = Column(Integer, nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "actor_id": self.actor_id,
            "event_type": self.event_type,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    keywords = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general", index=True)
    view_count = Column(Integer, default=0)
    solve_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        total = max(1, self.view_count)
        return {
            "id": self.id,
            "title": self.title,
            "keywords": self.keywords,
            "content": self.content,
            "category": self.category,
            "view_count": self.view_count,
            "solve_count": self.solve_count,
            "solve_rate": round(self.solve_count / total, 4),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TicketRating(Base):
    __tablename__ = "ticket_ratings"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, nullable=False, index=True)
    rater_id = Column(Integer, nullable=True, index=True)
    response_speed_score = Column(Integer, nullable=False)
    service_attitude_score = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "rater_id": self.rater_id,
            "response_speed_score": self.response_speed_score,
            "service_attitude_score": self.service_attitude_score,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AICallLog(Base):
    __tablename__ = "ai_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    scene = Column(String(50), index=True)  # chat / intake / handover
    engine = Column(String(50), index=True)  # qwen / rule
    source = Column(String(50), index=True)  # qwen / kb / fallback
    fallback = Column(Boolean, default=False, index=True)
    latency_ms = Column(Integer, default=0)
    success = Column(Boolean, default=True, index=True)
    message = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "scene": self.scene,
            "engine": self.engine,
            "source": self.source,
            "fallback": self.fallback,
            "latency_ms": self.latency_ms,
            "success": self.success,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
