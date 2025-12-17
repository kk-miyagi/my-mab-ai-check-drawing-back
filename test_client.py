import sys
import requests


def main(req_time):
    url = f"http://127.0.0.1:8000/{req_time}/"
    data = {"title": "foo", "body": "bar", "userId": 1}

    response = requests.post(url, json=data)  # JSON形式で送信
    print(response.status_code)
    print(response.json())


if __name__ == '__main__':
    main(sys.argv[1])
