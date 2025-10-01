#!/usr/bin/env python3
"""
简单的WebSocket连接测试
"""

import asyncio
import json
import websockets
import time

async def simple_test():
    """简单的WebSocket连接测试"""
    client_id = f"test_client_{int(time.time())}"
    ws_url = f"ws://127.0.0.1:8000/ws/{client_id}"
    
    print(f"连接到: {ws_url}")
    
    try:
        websocket = await websockets.connect(ws_url)
        print("✅ 连接成功")
        
        # 发送ping消息
        ping_msg = {"type": "ping", "timestamp": time.time()}
        await websocket.send(json.dumps(ping_msg))
        print("📤 发送ping消息")
        
        # 接收响应
        response = await websocket.recv()
        data = json.loads(response)
        print(f"📥 收到响应: {data}")
        
        if data.get("type") == "pong":
            print("✅ 心跳测试成功")
        
        # 手动关闭连接
        await websocket.close()
        print("✅ 连接已关闭")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    asyncio.run(simple_test())