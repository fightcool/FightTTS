"""
WebSocket Connection Manager
WebSocket连接管理器
"""

import asyncio
import logging
from typing import Dict, Optional, Callable, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 存储活动连接: client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # 存储任务映射: task_id -> client_id
        self.task_to_client: Dict[str, str] = {}
        # 心跳任务
        self.heartbeat_tasks: Dict[str, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """接受新的WebSocket连接"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket连接已建立: {client_id}")
        
        # 启动心跳任务
        heartbeat_task = asyncio.create_task(self._heartbeat(client_id))
        self.heartbeat_tasks[client_id] = heartbeat_task
    
    def disconnect(self, client_id: str) -> None:
        """断开WebSocket连接"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"WebSocket连接已断开: {client_id}")
        
        # 取消心跳任务
        if client_id in self.heartbeat_tasks:
            self.heartbeat_tasks[client_id].cancel()
            del self.heartbeat_tasks[client_id]
        
        # 清理任务映射
        tasks_to_remove = [
            task_id for task_id, cid in self.task_to_client.items() 
            if cid == client_id
        ]
        for task_id in tasks_to_remove:
            del self.task_to_client[task_id]
    
    def register_task(self, task_id: str, client_id: str) -> None:
        """注册任务与客户端的映射关系"""
        self.task_to_client[task_id] = client_id
        logger.debug(f"任务已注册: {task_id} -> {client_id}")
    
    def unregister_task(self, task_id: str) -> None:
        """注销任务"""
        if task_id in self.task_to_client:
            del self.task_to_client[task_id]
            logger.debug(f"任务已注销: {task_id}")
    
    async def send_message(self, client_id: str, message: dict) -> bool:
        """向指定客户端发送消息"""
        if client_id not in self.active_connections:
            logger.warning(f"客户端不在线: {client_id}")
            return False
        
        try:
            websocket = self.active_connections[client_id]
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"发送消息失败: {client_id}, 错误: {e}")
            self.disconnect(client_id)
            return False
    
    async def send_to_task(self, task_id: str, message: dict) -> bool:
        """向任务关联的客户端发送消息"""
        client_id = self.task_to_client.get(task_id)
        if not client_id:
            logger.warning(f"任务未关联客户端: {task_id}")
            return False
        
        return await self.send_message(client_id, message)
    
    async def broadcast(self, message: dict) -> None:
        """广播消息到所有连接的客户端"""
        disconnected = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"广播消息失败: {client_id}, 错误: {e}")
                disconnected.append(client_id)
        
        # 清理断开的连接
        for client_id in disconnected:
            self.disconnect(client_id)
    
    async def _heartbeat(self, client_id: str) -> None:
        """心跳任务，定期发送ping消息"""
        try:
            while client_id in self.active_connections:
                await asyncio.sleep(30)  # 每30秒发送一次心跳
                
                if client_id in self.active_connections:
                    success = await self.send_message(client_id, {
                        "type": "ping",
                        "timestamp": asyncio.get_event_loop().time()
                    })
                    
                    if not success:
                        break
        except asyncio.CancelledError:
            logger.debug(f"心跳任务已取消: {client_id}")
        except Exception as e:
            logger.error(f"心跳任务异常: {client_id}, 错误: {e}")
            self.disconnect(client_id)
    
    def get_connection_count(self) -> int:
        """获取当前连接数"""
        return len(self.active_connections)
    
    def is_connected(self, client_id: str) -> bool:
        """检查客户端是否在线"""
        return client_id in self.active_connections
    
    def create_progress_callback(self, task_id: str) -> Callable[[float, str], None]:
        """创建进度回调函数"""
        def callback(progress: float, message: str) -> None:
            """进度回调"""
            try:
                # 使用asyncio在事件循环中发送消息
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.send_to_task(task_id, {
                        "type": "progress",
                        "task_id": task_id,
                        "progress": progress,
                        "message": message,
                        "status": "processing"
                    }))
                else:
                    logger.warning("事件循环未运行，无法发送进度消息")
            except Exception as e:
                logger.error(f"进度回调失败: {task_id}, 错误: {e}")
        
        return callback
    
    async def send_start_message(self, task_id: str) -> bool:
        """发送任务开始消息"""
        return await self.send_to_task(task_id, {
            "type": "start",
            "task_id": task_id,
            "status": "processing",
            "message": "任务已开始"
        })
    
    async def send_progress_message(
        self, 
        task_id: str, 
        progress: float, 
        message: str
    ) -> bool:
        """发送进度消息"""
        return await self.send_to_task(task_id, {
            "type": "progress",
            "task_id": task_id,
            "progress": progress,
            "status": "processing",
            "message": message
        })
    
    async def send_complete_message(
        self, 
        task_id: str, 
        result: str
    ) -> bool:
        """发送任务完成消息"""
        success = await self.send_to_task(task_id, {
            "type": "complete",
            "task_id": task_id,
            "status": "completed",
            "message": "任务已完成",
            "result": result
        })
        
        # 注销任务
        self.unregister_task(task_id)
        return success
    
    async def send_error_message(
        self, 
        task_id: str, 
        error: str
    ) -> bool:
        """发送错误消息"""
        success = await self.send_to_task(task_id, {
            "type": "error",
            "task_id": task_id,
            "status": "error",
            "message": "任务失败",
            "error": error
        })
        
        # 注销任务
        self.unregister_task(task_id)
        return success

