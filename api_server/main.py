import os
import sys
from api_server.app_server import AppServer


def main():
    env_str = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
            'RUN_ENV', 'DEV')
    host = os.environ.get('API_HOST', '0.0.0.0')
    port = int(os.environ.get('API_PORT', '8000'))
    AppServer(env_str, host=host, port=port).start(env_str)


if __name__ == '__main__':
    main()
