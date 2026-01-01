import websocket
import json
import requests
import ast
import threading
import time

# 获取当前活跃的市场
print("🔍 获取活跃市场...")
proxies = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890'
}

response = requests.get(
    "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume&ascending=false&limit=10",
    proxies=proxies,
    timeout=10
)
events = response.json()

active_tokens = []
if events:
    print(f"✅ 找到 {len(events)} 个活跃 events\n")
    for event in events[:5]:
        markets = event.get('markets', [])
        for m in markets:
            token_ids = m.get('clobTokenIds', [])
            if token_ids:
                # clobTokenIds 是 JSON 字符串，需要解析
                try:
                    tokens = ast.literal_eval(token_ids) if isinstance(token_ids, str) else token_ids
                except:
                    tokens = token_ids
                active_tokens.extend(tokens)
                print(f"市场: {m.get('question')}")
                print(f"Token IDs: {tokens}\n")

print(f"✅ 总共找到 {len(active_tokens)} 个活跃 Token\n")

def on_message(ws, message):
    print(f"📨 收到消息:")
    try:
        data = json.loads(message)
        print(json.dumps(data, indent=2))
    except:
        print(message)

def on_error(ws, error):
    print("❌ 错误:", error)

def on_close(ws, close_status_code, close_msg):
    print(f"⚠️ 连接已关闭 - Code: {close_status_code}, Msg: {close_msg}")

def heartbeat(ws):
    """心跳线程：每15秒发送一次ping保持连接（CLOB建议10-20秒）"""
    while True:
        time.sleep(15)
        try:
            if ws.sock and ws.sock.connected:
                ws.send(json.dumps({"type": "ping"}))
                print("💓 发送心跳 Ping")
        except Exception as e:
            print(f"❌ 心跳发送失败: {e}")
            break

def on_open(ws):
    print("✅ 已连接到 WebSocket！")
    
    # 启动心跳线程（每15秒一次，CLOB建议10-20秒）
    heartbeat_thread = threading.Thread(target=heartbeat, args=(ws,), daemon=True)
    heartbeat_thread.start()
    print("💓 心跳线程已启动（每15秒）")
    
    # 使用活跃市场的 token（取前5个）
    tokens_to_subscribe = active_tokens[:5] if active_tokens else []
    
    if not tokens_to_subscribe:
        print("⚠️ 没有找到活跃市场")
        return
    
    subscribe_data = {
        "type": "market",
        "assets_ids": tokens_to_subscribe,
        "initial_dump": True  # 请求初始数据快照
    }
    ws.send(json.dumps(subscribe_data))
    print(f"📡 已订阅 {len(tokens_to_subscribe)} 个活跃资产")
    for i, token in enumerate(tokens_to_subscribe, 1):
        print(f"   Token {i}: {token[:16]}...")

ws = websocket.WebSocketApp(
    "wss://ws-subscriptions-clob.polymarket.com/ws/market",
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

ws.run_forever(
    http_proxy_host="127.0.0.1", 
    http_proxy_port=7890,
    proxy_type="http"  # 明确指定代理类型
)