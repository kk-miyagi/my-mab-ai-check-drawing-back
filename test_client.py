import sys
import requests


def main(req_url):
    datas = []
    files = [] 
    if req_url == 'issue/operation_id':
        datas = [
           {"user": None, "epic": "TEST", "operation": "TEST", "operation_id": None, "status": "start"},
           {"user": "foo", "epic": None, "operation": "TEST", "operation_id": None, "status": "start"},
           {"user": "foo", "epic": "TEST", "operation": None, "operation_id": None, "status": "start"},
           {"user": "foo", "epic": "TEST", "operation": "TEST", "operation_id": None, "status": "start"},
           {"user": "foo", "epic": "TEST", "operation": "TEST", "operation_id": "", "status": "start"},
           {"user": "foo", "epic": "TEST", "operation": "TEST", "operation_id": "AAA", "status": "start"},
        ] 
    elif req_url == 'multi_fileupload':
        datas = [
           {"user": "XXXX", "epic": "TEST", "operation": "TEST", "operation_id": "AAA", "status": "doing"},
        ]
        files.append({'file_1': open('test_client.py', 'rb')})
        files.append({'file_2': open('test_app.py', 'rb')})
    elif req_url == "test-boot-another-process":
        datas = [
           {"user": "foo", "epic": "TEST", "operation": "TEST", "operation_id": "AAA", "status": "start"},
        ]
    else:
        print(f"URL UNMATCH: {req_url}")
        sys.exit(1)

    url = f"http://127.0.0.1:8000/{req_url}/"
    for i, data in enumerate(datas):
        if len(files) > 0:
            print("data and files send!")
            response = requests.post(url, files=files[0], data=data)  # JSON形式で送信
        else:
            print("json send!")
            response = requests.post(url, json=data)  # JSON形式で送信
        print(f"{i}: headers:{response.headers}")
        print(f"{i}: status_code:{response.status_code}")
        print(f"{i}: body json:{response.json()}")


if __name__ == '__main__':
    main(sys.argv[1])




