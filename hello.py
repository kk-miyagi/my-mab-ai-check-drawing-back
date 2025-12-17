from fastapi import APIRouter

router = APIRouter()

@router.post('/hello/')
def Hello():
    return {'Hello': 'World!'}

