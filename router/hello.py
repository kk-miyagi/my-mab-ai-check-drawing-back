from app_router import AppRouter
from fastapi import Body

router = AppRouter()

@router.post('/hello/')
async def Hello(body = Body(...)):
    print(f"In Hello body is :{body}")
    print(f"In Hello app_session is: {AppRouter.app_session}")
    return {'Hello': 'World!'}

