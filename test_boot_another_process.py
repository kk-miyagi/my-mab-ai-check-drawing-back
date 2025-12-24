from fastapi import FastAPI, BackgroundTasks, Request
from boot_another_process import BaseBootAnotherProcess
from manager.app_status_manager import AppStatus
from fastapi.responses import JSONResponse
app = FastAPI()


@app.post("/test-boot-another-process")
async def test(request: Request, background_tasks: BackgroundTasks):
    proc = BaseBootAnotherProcess()
    state = request.state
    print(state)
    req_status = AppStatus.create_from_state(state)
    # print(req_status)
    # if request.state.body:
    #     return request.state.body
    # else:
    # state = request.state
    # req_status = AppStatus.create_from_state(state)
    # print(f"req_status: {req_status}")
    cmd = "bash ./scripts/test.sh"
    background_tasks.add_task(proc.start, cmd)
    return JSONResponse(content={"message": "create batch"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("test_boot_another_process:app")
