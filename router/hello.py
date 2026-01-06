from app_router import AppRoute
from fastapi import Body, APIRouter

router = APIRouter(route_class=AppRoute)


@router.post('/hello/')
async def Hello(body=Body(...)):
    print(f"In Hello body is :{body}")
    return {'Hello': 'World!'}
