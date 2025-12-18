from app_router import AppRouter

router = AppRouter()

@router.post('/hello/')
def Hello():
    print(router.app)
    return {'Hello': 'World!'}

