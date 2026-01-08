from app_server import AppServer
import sys

if __name__ == "__main__":
    # arg is DEV or PROD
    env_str = sys.argv[1]
    AppServer(env_str).start(env_str)
