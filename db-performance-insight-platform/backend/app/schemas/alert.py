from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class AlertBase(BaseModel):
    alert_type: str = Field(..., description="告警类型")
    severity: str = Field(..., description="严重程度")
    title: str = Field(..., description="告警标题")
    message: str = Field(..., description="告警消息")
    threshold_value: Optional[float] = Field(None, description="阈值")
    current_value: Optional[float] = Field(None, description="当前值")

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    severity: Optional[str] = Field(None, description="严重程度")
    title: Optional[str] = Field(None, description="告警标题")
    message: Optional[str] = Field(None, description="告警消息")
    status: Optional[str] = Field(None, description="状态")

class AlertResponse(AlertBase):
    id: int
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    
    class Config:
        from_attributes = True
