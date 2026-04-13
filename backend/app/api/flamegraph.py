from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.utils.flamegraph import FlameGraphGenerator, QueryPerformanceSampler

router = APIRouter(prefix="/api/flamegraph", tags=["flamegraph"])


class FlameGraphRequest(BaseModel):
    query_id: int
    execution_time: float
    stack_trace: str = None


@router.post("/generate")
async def generate_flamegraph(
    request: FlameGraphRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        sampler = QueryPerformanceSampler()
        sampler.sample_query_execution(
            request.query_id,
            request.execution_time,
            request.stack_trace
        )
        
        return {
            'd3_data': sampler.get_flamegraph_data(),
            'svg': sampler.get_flamegraph_svg(),
            'hotspots': sampler.get_hotspots()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-stack")
async def analyze_stack_trace(
    request: FlameGraphRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        generator = FlameGraphGenerator()
        
        if request.stack_trace:
            generator.parse_mysql_stack(request.stack_trace)
        else:
            simulated_stack = generator._simulate_query_stack(
                request.query_id,
                request.execution_time
            )
            generator.add_sample(simulated_stack)
        
        return {
            'd3_data': generator.generate_d3_data(),
            'hotspots': generator.get_hotspots()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
