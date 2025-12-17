from fastapi import APIRouter

router = APIRouter()

@router.post('/file_upload/')
def Hello():
    return {'file': 'upload!'}

