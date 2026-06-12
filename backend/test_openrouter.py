import requests

url = 'https://openrouter.ai/api/v1/chat/completions'
headers = {
    'Authorization': 'Bearer YOUR_OPENROUTER_API_KEY',
    'Content-Type': 'application/json'
}
payload = {
    'model': 'openrouter/free',
    'messages': [{'role': 'user', 'content': 'Hello'}]
}

try:
    print("Sending request directly to OpenRouter...")
    r = requests.post(url, headers=headers, json=payload, timeout=20)
    print(f"Status Code: {r.status_code}")
    print("Response JSON:")
    print(r.json())
except Exception as e:
    print(f"Error: {e}")
