import requests

url = 'http://127.0.0.1:8095/api/chat'
payload = {
    'message': 'Bhai kya progress hai?',
    'free_mode': True,
    'api': {
        'llm_provider': 'openrouter',
        'llm_api_key': 'YOUR_OPENROUTER_API_KEY'
    }
}

try:
    print("Sending request to chatbot API...")
    r = requests.post(url, json=payload, timeout=20)
    print(f"Status Code: {r.status_code}")
    print("Response JSON:")
    print(r.json())
except Exception as e:
    print(f"Error: {e}")
