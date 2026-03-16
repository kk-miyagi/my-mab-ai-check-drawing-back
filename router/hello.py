from app_router import AppRoute
from fastapi import Body, APIRouter

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/hello/')
async def Hello(body=Body(...)):
    return {'Hello': 'World!'}
