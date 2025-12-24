import asyncio
import logging


class BaseBootAnotherProcess:

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        logging.basicConfig(
            filename="base_boot_another_process.log",
            format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
            level=logging.INFO,
            encoding="utf-8",
        )

    def start(self, args):
        try:
            self.logger.info("ok")
            asyncio.run(self.do(args))  # TODO: マルチファイルアップロードを参考にしてみる

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
            print(stdout.decode())
            print(stderr)
            # 渡された関数を呼ぶ
            # xxxxxx(ここでステータスを更新する)
            # バッチ処理のステータスと全体のステータスの両方を更新する
            print("end")
        except:
            raise Exception

        print(proc.returncode)
        if proc.returncode == 0:
            return "ok!"
