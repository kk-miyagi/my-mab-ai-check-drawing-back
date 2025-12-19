from fastapi import FastAPI, BackgroundTasks
from boot_another_process import BaseBootAnotherProcess

app = FastAPI()

@app.post("/test-boot-another-process")
async def test():
    background_tasks = BackgroundTasks()
    proc = BaseBootAnotherProcess("base_boot_another_process.log")
    cmd = "python -c \"from test import write_notification; write_notification('aaaaaa')\""
    background_tasks.add_task(proc.start, cmd)
    return {"message": "create batch"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("test_boot_another_process:app")
