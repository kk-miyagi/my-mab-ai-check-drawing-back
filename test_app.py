from app_server import AppServer
import sys

if __name__ == "__main__":
    # arg is DEV or PROD
    AppServer(sys.argv[1]).start()
