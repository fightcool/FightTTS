"""
WebSocket Router
WebSocket连接路由
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from ..core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# 全局WebSocket管理器（将在应用启动时注入）
ws_manager: Optional[WebSocketManager] = None


def set_ws_manager(manager: WebSocketManager):
    """设置WebSocket管理器"""
    global ws_manager
    ws_manager = manager


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket连接端点
    
    Args:
        websocket: WebSocket连接
        client_id: 客户端ID
    """
    if not ws_manager:
        logger.error("WebSocket管理器未初始化")
        await websocket.close(code=1011, reason="服务器内部错误")
        return
    
    logger.info(f"[WebSocket] 新连接请求: {client_id}")
    
    try:
        # 建立连接
        await ws_manager.connect(websocket, client_id)
        logger.info(f"[WebSocket] 连接已建立: {client_id}")
        
        # 发送欢迎消息
        await ws_manager.send_message(client_id, {
            "type": "connected",
            "client_id": client_id,
            "message": "WebSocket连接已建立"
        })
        
        # 消息循环
        while True:
            try:
                # 接收消息
                data = await websocket.receive_text()
                
                try:
                    message = json.loads(data)
                    message_type = message.get("type", "unknown")
                    
                    logger.debug(f"[WebSocket] 收到消息: {client_id}, 类型: {message_type}")
                    
                    # 处理不同类型的消息
                    if message_type == "ping":
                        # 心跳消息
                        await ws_manager.send_message(client_id, {
                            "type": "pong",
                            "timestamp": message.get("timestamp")
                        })
                    
                    elif message_type == "status":
                        # 状态查询
                        connection_count = ws_manager.get_connection_count()
                        is_connected = ws_manager.is_connected(client_id)
                        
                        await ws_manager.send_message(client_id, {
                            "type": "status",
                            "connected": is_connected,
                            "total_connections": connection_count
                        })
                    
                    else:
                        logger.warning(f"[WebSocket] 未知消息类型: {message_type}")
                
                except json.JSONDecodeError:
                    logger.warning(f"[WebSocket] 无效的JSON消息: {client_id}")
                    await ws_manager.send_message(client_id, {
                        "type": "error",
                        "message": "无效的JSON格式"
                    })
            
            except WebSocketDisconnect:
                logger.info(f"[WebSocket] 客户端主动断开: {client_id}")
                break
            
            except Exception as e:
                logger.error(f"[WebSocket] 消息处理错误: {client_id}, 错误: {e}")
                break
    
    except Exception as e:
        logger.error(f"[WebSocket] 连接错误: {client_id}, 错误: {e}", exc_info=True)
    
    finally:
        # 断开连接
        ws_manager.disconnect(client_id)
        logger.info(f"[WebSocket] 连接已关闭: {client_id}")

