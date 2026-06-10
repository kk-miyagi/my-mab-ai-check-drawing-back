import csv
from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import AppStatus, Status
from pathlib import Path

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/trouble/')
async def trouble(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    target_status = req_status.operations[0].status
    match target_status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.INFO,
                "TROUBLE START STATUS"
            )
            app_state.update_app_status(
                req_status
            )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.DOING:
            search_keys = req_status.others["search_keys"]
            logger.log(
                req_status,
                AppLogger.DEBUG,
                f"TROUBLE DOING STATUS, search_keys: {search_keys}"
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
                search_items = {
                    row[col_name]: row["result"]
                    for row in reader if row[col_name] in search_keys
                }

            req_status.others["search_items"] = search_items
            up_status = Status.END
            req_status.group_status = up_status
            app_state.update_app_status(
                req_status
            )
            logger.log(
                req_status,
                AppLogger.DEBUG,
                f"TROUBLE DOING STATUS, search_items: {search_items}"
            )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.END:
            logger.log(
                req_status,
                AppLogger.INFO,
                "TROUBLE END STATUS"
            )
            app_state.update_app_status(
                req_status
            )
            return AppRoute.create_responce_from_status(
                req_status
            )
