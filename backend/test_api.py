import requests
import json

try:
    r = requests.post(
        'http://127.0.0.1:8084/api/test-handshake', 
        auth=('admin', 'omnitech2026'),
        json={
            'host': '172.30.3.206', 
            'username': 'root', 
            'password': 'passwordless-ssh-active'
        }
    )
    print("STATUS:", r.status_code)
    print("RESPONSE:", r.json())
except Exception as e:
    print("ERROR:", e)
