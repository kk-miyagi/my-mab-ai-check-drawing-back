import os
import asyncio
import sys
import logging

class BaseBootAnotherProcess:

    def __init__(self, log_file_name):
        self.logger = logging.getLogger(__name__)
        self.log_file_name = log_file_name

        logging.basicConfig(
            filename=self.log_file_name,
            format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
            level=logging.INFO,
            encoding="utf-8",
        )

    def start(self, args):
        try:
            print("sssss")
            self.logger.info("ok")
            asyncio.run(self.do(args))
        except Exception as e:
            self.logger.info(f"{e}: エラーが発生しています。")

    async def do(self, cmd: str):
        try:
            print("start")
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            print("end")
        except:
            raise Exception
        
        print(proc.returncode)
        if proc.returncode == 0:
            return "ok!"
