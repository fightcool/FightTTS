#!/usr/bin/env python3
"""
调试WebSocket连接问题
"""

import asyncio
import json
import websockets
import time

async def debug_websocket():
    """调试WebSocket连接"""
    client_id = f"debug_client_{int(time.time())}"
    ws_url = f"ws://127.0.0.1:8000/ws/{client_id}"
    
    print(f"连接到: {ws_url}")
    
    try:
        # 使用最基本的连接配置
        websocket = await websockets.connect(ws_url)
        print("✅ 连接成功")
        
        # 等待一下确保连接稳定
        await asyncio.sleep(1)
        
        # 发送ping消息
        ping_msg = {"type": "ping", "timestamp": time.time()}
        message_str = json.dumps(ping_msg)
        print(f"📤 发送ping消息: {message_str}")
        await websocket.send(message_str)
        
        # 等待响应，设置较短超时
        try:
            print("⏳ 等待响应...")
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            data = json.loads(response)
            print(f"📥 收到响应: {data}")
            
            if data.get("type") == "pong":
                print("✅ ping-pong测试成功")
            else:
                print(f"❓ 收到意外响应类型: {data.get('type')}")
            
        except asyncio.TimeoutError:
            print("❌ 等待响应超时")
        
        # 等待一下再关闭
        await asyncio.sleep(1)
        
        # 正常关闭连接
        print("🔄 正常关闭连接...")
        await websocket.close()
        print("✅ 连接正常关闭")
        
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"❌ 连接被关闭: {e}")
        print(f"关闭代码: {e.code}")
        print(f"关闭原因: {e.reason}")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        print(f"错误类型: {type(e).__name__}")

if __name__ == "__main__":
    asyncio.run(debug_websocket())