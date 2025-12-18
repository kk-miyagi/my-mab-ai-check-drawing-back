from app_router import AppRouter

router = AppRouter()

@router.post('/file_upload/')
def Hello():
    return {'file': 'upload!'}

