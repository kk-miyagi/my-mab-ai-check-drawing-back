import csv
from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import AppStatus
from pathlib import Path

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/trouble-init/')
async def trouble_init(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    logger.log(
        req_status,
        AppLogger.DEBUG,
        "TROUBLE-INIT START"
    )

    f_dir = Path(__file__).parent.parent / 'trouble-response'
    csv_files = list(f_dir.glob('*.csv'))
    if not csv_files:
        logger.log(
            req_status,
            AppLogger.ERROR,
            f"No CSV files found in {f_dir}"
        )
        return req_status
    latest_file = max(csv_files, key=str)
    col_name = "部品名(大区分)"

    with open(latest_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        search_keys = [row[col_name] for row in reader]

    req_status.others["search_keys"] = search_keys
    logger.log(
        req_status,
        AppLogger.DEBUG,
        "TROUBLE-INIT END"
    )
    return req_status
