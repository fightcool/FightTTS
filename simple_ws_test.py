#!/usr/bin/env python3
"""
简单的WebSocket连接测试
"""

import asyncio
import websockets
import json
import time

async def test_websocket():
    client_id = f"test_{int(time.time())}"
    uri = f"ws://127.0.0.1:8000/ws/{client_id}"

    print(f"连接到: {uri}")

    try:
        async with websockets.connect(uri) as ws:
            print("连接成功!")

            # 发送心跳
            heartbeat = {"type": "heartbeat", "timestamp": time.time()}
            await ws.send(json.dumps(heartbeat))
            print("心跳已发送")

            # 等待响应
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(response)
            print(f"收到响应: {data['type']}")

            print("WebSocket测试通过!")
            return True

    except Exception as e:
        print(f"连接失败: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_websocket())