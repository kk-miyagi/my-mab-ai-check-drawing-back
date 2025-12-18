import sys
import requests


def main(req_url):
    url = f"http://127.0.0.1:8000/{req_url}/"
    data = {"user": "foo", "epic": "TEST", "operation": "TEST", "operation_id": "32c40739-8e44-4cdc-afcc-40f4727bc534", "status": "start"}

    response = requests.post(url, json=data)  # JSON形式で送信
    print(response.headers)
    print(response.status_code)
    print(response.json())


if __name__ == '__main__':
    main(sys.argv[1])
