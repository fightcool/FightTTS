import asyncio
import json
import os
import sys
import time
import uuid
import logging
from logging.handlers import RotatingFileHandler
from typing import Dict, List, Optional
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# 配置结构化日志系统
def setup_logging():
    """配置结构化日志系统，提供更好的错误追踪"""
    import logging.config

    LOGGING_CONFIG = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'detailed': {
                'format': '%(asctime)s | %(levelname)8s | %(name)s:%(lineno)d | %(message)s'
            },
            'simple': {
                'format': '%(asctime)s | %(levelname)s | %(message)s'
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': 'INFO',
                'formatter': 'simple',
                'stream': 'ext://sys.stdout'
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'DEBUG',
                'formatter': 'detailed',
                'filename': 'tts_service.log',
                'maxBytes': 10485760,  # 10MB
                'backupCount': 5,
                'encoding': 'utf-8'
            },
            'error_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'ERROR',
                'formatter': 'detailed',
                'filename': 'tts_errors.log',
                'maxBytes': 5242880,  # 5MB
                'backupCount': 3,
                'encoding': 'utf-8'
            },
        },
        'loggers': {
            '': {  # root logger
                'level': 'INFO',
                'handlers': ['console', 'file', 'error_file']
            },
            'uvicorn': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'fastapi': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            }
        }
    }

    try:
        logging.config.dictConfig(LOGGING_CONFIG)
        logger = logging.getLogger(__name__)
        logger.info("结构化日志系统初始化成功")
        return logger
    except Exception as e:
        # 回退到基本日志配置
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s | %(levelname)s | %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler('tts_service.log', encoding='utf-8')
            ]
        )
        logger = logging.getLogger(__name__)
        logger.error(f"结构化日志配置失败，使用基本配置: {e}")
        return logger

# 初始化日志配置
logger = setup_logging()

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
sys.path.append(os.path.join(current_dir, "indextts"))

from indextts.infer_v2 import IndexTTS2
from tools.i18n.i18n import I18nAuto

# 数据模型
class TTSRequest(BaseModel):
    text: str
    emo_control_method: int = 0
    emo_weight: float = 0.65
    emo_text: Optional[str] = None
    emo_random: bool = False
    max_text_tokens_per_segment: int = 120
    # GPT2 采样参数
    do_sample: bool = True
    top_p: float = 0.8
    top_k: int = 30
    temperature: float = 0.8
    length_penalty: float = 0.0
    num_beams: int = 3
    repetition_penalty: float = 10.0
    max_mel_tokens: int = 1500
    # 情感向量参数
    emo_vec: Optional[List[float]] = None

class ProgressMessage(BaseModel):
    task_id: str
    progress: float
    status: str
    message: str
    result: Optional[str] = None

class ConnectionManager:
    def __init__(self, max_connections: int = 100, heartbeat_timeout: int = 120):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_timestamps: Dict[str, float] = {}  # 记录连接时间
        self.heartbeat_timestamps: Dict[str, float] = {}   # 记录最后心跳时间
        self.max_connections = max_connections  # 最大连接数限制
        self.heartbeat_timeout = heartbeat_timeout  # 心跳超时时间（秒）- 增加到120秒
        self._cleanup_task = None  # 清理任务

    async def start_cleanup_task(self):
        """启动定期清理任务"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def stop_cleanup_task(self):
        """停止清理任务"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    async def _periodic_cleanup(self):
        """定期清理过期连接"""
        while True:
            try:
                await asyncio.sleep(60)  # 每分钟清理一次
                await self.cleanup_stale_connections()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"清理任务异常: {e}")

    async def connect(self, websocket: WebSocket, client_id: str):
        logger.info(f"[CONNECT] Starting connection process for client: {client_id}")
        
        # 检查连接数限制
        if len(self.active_connections) >= self.max_connections:
            logger.warning(f"[CONNECT] Connection rejected for {client_id}: max connections ({self.max_connections}) reached")
            await websocket.close(code=1008, reason="服务器连接已满")
            return False

        # 临时存储旧连接（如果存在），先不立即断开
        old_websocket = self.active_connections.get(client_id)
        
        # 先接受新连接，确保新连接建立成功
        try:
            logger.info(f"[CONNECT] Accepting WebSocket connection for {client_id}")
            await websocket.accept()
            logger.info(f"[CONNECT] WebSocket accepted for {client_id}")
        except Exception as e:
            logger.error(f"[CONNECT] Error accepting WebSocket connection for {client_id}: {e}")
            return False
        
        # 再断开旧连接（如果存在），避免新连接被影响
        if old_websocket:
            logger.info(f"[CONNECT] Client {client_id} reconnecting, disconnecting old connection")
            try:
                if hasattr(old_websocket, 'client_state') and old_websocket.client_state.name == 'CONNECTED':
                    await old_websocket.close(code=1001, reason="客户端重连")
                logger.info(f"[CONNECT] Old connection for {client_id} disconnected successfully")
            except Exception as e:
                logger.error(f"[CONNECT] Error closing old WebSocket for {client_id}: {e}")
        
        # 注册新连接
        self.active_connections[client_id] = websocket
        self.connection_timestamps[client_id] = time.time()
        self.heartbeat_timestamps[client_id] = time.time()

        logger.info(f"[CONNECT] WebSocket connection established for {client_id}, active connections: {len(self.active_connections)}/{self.max_connections}")

        # 确保清理任务已启动
        await self.start_cleanup_task()
        return True

    async def disconnect(self, client_id: str):
        if client_id not in self.active_connections:
            logger.debug(f"Client {client_id} not found, skipping disconnect")
            return

        connection_duration = time.time() - self.connection_timestamps.get(client_id, 0)
        logger.info(f"Disconnecting client {client_id}, duration: {connection_duration:.2f}s")

        try:
            websocket = self.active_connections[client_id]
            # 正确判断：仅当连接处于"已连接"状态时才关闭
            if hasattr(websocket, 'client_state'):
                # 用枚举属性判断（避免字符串大小写问题）
                try:
                    # 检查是否为CONNECTED状态
                    from starlette.websockets import WebSocketState
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.close(code=1000, reason="正常关闭")
                except ImportError:
                    # 如果无法导入WebSocketState，使用字符串比较作为后备
                    if hasattr(websocket.client_state, 'name') and websocket.client_state.name == 'CONNECTED':
                        await websocket.close(code=1000, reason="正常关闭")
            else:
                # 如果没有client_state属性，直接尝试关闭
                await websocket.close(code=1000)
        except Exception as e:
            logger.error(f"Error closing WebSocket for {client_id}: {str(e)}")
        finally:
            # 无论关闭是否成功，都清理资源
            self.active_connections.pop(client_id, None)
            self.connection_timestamps.pop(client_id, None)
            self.heartbeat_timestamps.pop(client_id, None)
            logger.info(f"Remaining active connections: {len(self.active_connections)}")

    async def send_message(self, client_id: str, message: dict):
        if client_id not in self.active_connections:
            logger.warning(f"Client {client_id} connection not found")
            return False

        try:
            websocket = self.active_connections[client_id]

            # 检查连接状态
            if websocket.client_state.name != 'CONNECTED':
                logger.warning(f"Client {client_id} connection state abnormal: {websocket.client_state.name}")
                await self.disconnect(client_id)
                return False

            message_text = json.dumps(message, ensure_ascii=False)
            await websocket.send_text(message_text)
            logger.debug(f"Message sent successfully -> {client_id}: {message.get('type', 'unknown')}")
            return True

        except Exception as e:
            logger.error(f"Failed to send message -> {client_id}: {type(e).__name__}: {e}")
            # 不要立即断开连接，让WebSocket自然处理错误
            return False

    def update_heartbeat(self, client_id: str):
        """更新客户端心跳时间"""
        if client_id in self.active_connections:
            self.heartbeat_timestamps[client_id] = time.time()
            print(f"更新心跳: {client_id}")
            return True
        return False

    def get_connection_info(self, client_id: str) -> dict:
        """获取连接信息"""
        if client_id not in self.active_connections:
            return {"connected": False}

        now = time.time()
        connection_time = self.connection_timestamps.get(client_id, 0)
        last_heartbeat = self.heartbeat_timestamps.get(client_id, 0)

        return {
            "connected": True,
            "connection_duration": now - connection_time,
            "last_heartbeat_ago": now - last_heartbeat,
            "websocket_state": self.active_connections[client_id].client_state.name
        }

    async def cleanup_stale_connections(self):
        """清理过期连接"""
        now = time.time()
        stale_clients = []

        for client_id, last_heartbeat in self.heartbeat_timestamps.items():
            if now - last_heartbeat > self.heartbeat_timeout:
                stale_clients.append(client_id)

        if stale_clients:
            print(f"清理 {len(stale_clients)} 个过期连接")
            for client_id in stale_clients:
                print(f"   - 清理过期连接: {client_id}")
                await self.disconnect(client_id)

    def get_stats(self) -> dict:
        """获取连接统计信息"""
        now = time.time()
        return {
            "active_connections": len(self.active_connections),
            "max_connections": self.max_connections,
            "connection_ids": list(self.active_connections.keys()),
            "oldest_connection_age": min(
                [now - timestamp for timestamp in self.connection_timestamps.values()],
                default=0
            )
        }

# 全局变量
app = FastAPI(title="IndexTTS API Server", version="2.0.0")
manager = ConnectionManager()
tts_engine: Optional[IndexTTS2] = None
i18n = I18nAuto(language="Auto")
active_tasks: Dict[str, dict] = {}

# 添加全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    import traceback

    # 记录详细错误信息
    logger.error(f"未处理异常: {type(exc).__name__}: {str(exc)}")
    logger.error(f"请求路径: {request.url}")
    logger.error(f"堆栈跟踪:\n{traceback.format_exc()}")

    # 返回用户友好的错误信息
    return HTTPException(
        status_code=500,
        detail={
            "error": "服务器内部错误",
            "type": type(exc).__name__,
            "timestamp": time.time()
        }
    )

# 添加HTTP异常处理器
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    logger.warning(f"HTTP异常: {exc.status_code} - {exc.detail}")
    logger.info(f"请求路径: {request.url}")
    return exc

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务
os.makedirs("outputs", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

class ProgressCallback:
    def __init__(self, client_id: str, task_id: str, manager: ConnectionManager):
        self.client_id = client_id
        self.task_id = task_id
        self.manager = manager
        self.last_progress = 0
        self.start_time = time.time()
        # 必须在主线程中创建，确保能获取到事件循环
        try:
            self.main_loop = asyncio.get_running_loop()
            if not self.main_loop.is_running():
                raise RuntimeError("事件循环未运行")
            print(f"ProgressCallback初始化成功，主事件循环: {self.main_loop}")
        except RuntimeError as e:
            # 如果没有运行的事件循环，这是一个严重错误
            print(f"错误: ProgressCallback必须在有运行事件循环的线程中创建: {e}")
            self.main_loop = None
            raise
        
    async def send_progress(self, progress: int, message: str = ""):
        """发送进度更新，包含连接状态检查"""
        if progress < self.last_progress:
            # 防止进度倒退
            return
            
        self.last_progress = progress
        elapsed_time = time.time() - self.start_time
        
        progress_message = {
            "type": "progress",
            "task_id": self.task_id,
            "client_id": self.client_id,
            "progress": progress,
            "message": message,
            "elapsed_time": elapsed_time
        }
        
        # 检查连接状态
        connection_info = self.manager.get_connection_info(self.client_id)
        if not connection_info.get("connected"):
            print(f"=== 连接已断开，无法发送进度 ===")
            print(f"任务ID: {self.task_id}")
            print(f"客户端ID: {self.client_id}")
            print(f"进度: {progress}%")
            return False
            
        success = await self.manager.send_message(self.client_id, progress_message)
        if not success:
            print(f"进度发送失败: 任务 {self.task_id}, 进度 {progress}%")
            return False
            
        print(f"进度更新: 任务 {self.task_id} -> {progress}% ({message})")
        return True
        
    async def send_start(self):
        """发送任务开始消息"""
        start_message = {
            "type": "start",
            "task_id": self.task_id,
            "client_id": self.client_id,
            "timestamp": time.time()
        }
        
        success = await self.manager.send_message(self.client_id, start_message)
        if success:
            print(f"任务开始: {self.task_id}")
        return success
        
    async def send_complete(self, result: str):
        """发送任务完成消息，包含额外的连接验证"""
        # 确保文件已完全写入
        if result.startswith('/outputs/'):
            file_path = f"./outputs/{result.split('/')[-1]}"
            # 等待文件写入完成
            for i in range(10):  # 最多等待5秒
                if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                    break
                await asyncio.sleep(0.5)
            
            if not os.path.exists(file_path):
                print(f"警告: 音频文件不存在 {file_path}")
        
        complete_message = {
            "type": "complete",
            "task_id": self.task_id,
            "client_id": self.client_id,
            "result": result,
            "timestamp": time.time(),
            "total_time": time.time() - self.start_time
        }
        
        # 多次尝试发送完成消息
        for attempt in range(3):
            connection_info = self.manager.get_connection_info(self.client_id)
            if not connection_info.get("connected"):
                print(f"尝试 {attempt + 1}: 连接已断开，无法发送完成消息")
                await asyncio.sleep(1)
                continue
                
            success = await self.manager.send_message(self.client_id, complete_message)
            if success:
                print(f"任务完成: {self.task_id} -> {result}")
                return True
            else:
                print(f"尝试 {attempt + 1}: 完成消息发送失败")
                await asyncio.sleep(1)
        
        print(f"=== 任务完成消息发送失败 ===")
        print(f"任务ID: {self.task_id}")
        print(f"客户端ID: {self.client_id}")
        print(f"结果: {result}")
        return False
        
    async def send_error(self, error_message: str):
        """发送错误消息"""
        error_msg = {
            "type": "error",
            "task_id": self.task_id,
            "client_id": self.client_id,
            "error": error_message,
            "timestamp": time.time()
        }
        
        success = await self.manager.send_message(self.client_id, error_msg)
        if success:
            print(f"错误消息发送: {self.task_id} -> {error_message}")
        return success

    def send_progress_sync(self, progress: int, message: str = ""):
        """线程安全的同步进度发送方法"""
        if self.main_loop is None:
            print(f"错误: 没有主事件循环引用，无法发送进度: {progress}% - {message}")
            return False

        try:
            # 使用线程安全的方式调用异步方法
            future = asyncio.run_coroutine_threadsafe(
                self.send_progress(progress, message),
                self.main_loop
            )

            # 等待结果，但设置超时避免阻塞
            try:
                result = future.result(timeout=2.0)  # 2秒超时
                print(f"进度发送成功: {progress}% - {message}")
                return result
            except asyncio.TimeoutError:
                print(f"进度更新超时: {progress}% - {message}")
                return False

        except Exception as e:
            print(f"线程安全进度发送失败: {type(e).__name__}: {e}")
            return False

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理工作"""
    print("📴 应用正在关闭...")

    # 停止连接清理任务
    await manager.stop_cleanup_task()

    # 关闭所有活跃连接
    if manager.active_connections:
        print(f"🔌 关闭 {len(manager.active_connections)} 个活跃连接")
        for client_id in list(manager.active_connections.keys()):
            await manager.disconnect(client_id)

    print("✅ 应用关闭完成")

@app.get("/api/stats")
async def get_stats():
    """获取服务器统计信息"""
    stats = manager.get_stats()
    stats.update({
        "tts_engine_status": "initialized" if tts_engine else "not_initialized",
        "server_version": "2.0.0"
    })
    return stats

@app.on_event("startup")
async def startup_event():
    global tts_engine
    try:
        # 初始化TTS引擎
        model_dir = "./checkpoints"
        config_path = os.path.join(model_dir, "config.yaml")
        
        if not os.path.exists(model_dir):
            raise Exception(f"Model directory {model_dir} does not exist")
            
        tts_engine = IndexTTS2(
            model_dir=model_dir,
            cfg_path=config_path,
            use_fp16=False,
            use_deepspeed=False,
            use_cuda_kernel=False,
        )
        print("✅ TTS Engine initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize TTS Engine: {e}")
        raise

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    logger.info(f"WebSocket connection request from client: {client_id}")
    
    # 首先尝试连接
    try:
        connection_success = await manager.connect(websocket, client_id)
        if not connection_success:
            logger.warning(f"WebSocket connection failed for client: {client_id}")
            return
    except Exception as e:
        logger.error(f"WebSocket connection exception for client {client_id}: {e}")
        return

    try:
        while True:
            try:
                # 设置接收超时，避免长时间阻塞 - 设置为90秒，更宽容
                data = await asyncio.wait_for(websocket.receive_text(), timeout=90.0)
                message = json.loads(data)

                # 减少心跳日志的噪音
                message_type = message.get('type', 'unknown')
                if message_type not in ['heartbeat', 'heartbeat_response', 'heartbeat_check', 'ping', 'pong']:
                    logger.info(f"Received WebSocket message from {client_id}: type={message_type}")

                if message.get("type") == "heartbeat":
                    # 更新心跳时间
                    manager.update_heartbeat(client_id)
                    # 发送心跳响应
                    success = await manager.send_message(client_id, {
                        "type": "heartbeat_response",
                        "timestamp": time.time(),
                        "connection_info": manager.get_connection_info(client_id)
                    })
                    logger.debug(f"Heartbeat response sent to {client_id}: {success}")
                elif message.get("type") == "ping":
                    # 处理ping消息
                    logger.debug(f"Processing ping message from {client_id}")
                    success = await manager.send_message(client_id, {
                        "type": "pong",
                        "timestamp": time.time()
                    })
                    logger.debug(f"Pong response sent to {client_id}: {success}")
                else:
                    # 处理其他消息类型
                    logger.info(f"Processing other message from {client_id}: {message.get('type', 'unknown')}")

            except asyncio.TimeoutError:
                # 超时时发送心跳检查
                logger.debug(f"WebSocket receive timeout, sending heartbeat check to {client_id}")
                success = await manager.send_message(client_id, {
                    "type": "heartbeat_check",
                    "timestamp": time.time()
                })
                if not success:
                    logger.warning(f"Heartbeat check failed, disconnecting {client_id}")
                    break

            except WebSocketDisconnect as e:
                logger.info(f"WebSocket disconnected for {client_id}: code={e.code}, reason={e.reason}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error from {client_id}: {e}")
                try:
                    await manager.send_message(client_id, {
                        "type": "error",
                        "message": "Invalid JSON format"
                    })
                except Exception as send_error:
                    logger.error(f"Failed to send error message to {client_id}: {send_error}")
                    break
            except Exception as e:
                logger.error(f"WebSocket processing exception for {client_id}: {type(e).__name__}: {e}")
                break

    except Exception as e:
        logger.error(f"WebSocket connection exception for {client_id}: {type(e).__name__}: {e}")
    finally:
        logger.info(f"Cleaning up WebSocket connection for {client_id}")
        await manager.disconnect(client_id)

@app.post("/api/tts/generate")
async def generate_tts(
    text: str,
    voice_name: str,
    client_id: str,
    prompt_audio: Optional[UploadFile] = None,
    emo_audio: Optional[UploadFile] = None,
    speed: float = 1.0,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 20,
    spk_id: int = 0,
    infer_seed: int = -1,
    use_decoder: bool = True,
    prompt_text: str = "",
    prompt_lang: str = "zh",
    text_lang: str = "zh",
    cut_method: str = "cut5"
):
    """生成TTS音频的异步函数"""

    # 生成唯一任务ID
    task_id = f"task_{int(time.time() * 1000000)}_{uuid.uuid4().hex[:8]}"
    print(f"生成唯一TaskID: {task_id}")

    # 创建进度回调对象
    progress_callback = ProgressCallback(client_id, task_id, manager)
    
    try:
        # 发送任务开始消息
        await progress_callback.send_start()
        
        # 检查连接状态
        connection_info = manager.get_connection_info(client_id)
        if not connection_info.get("connected"):
            print(f"=== 任务开始时连接已断开 ===")
            print(f"任务ID: {task_id}")
            print(f"客户端ID: {client_id}")
            return
        
        print(f"=== 开始TTS生成任务 ===")
        print(f"任务ID: {task_id}")
        print(f"客户端ID: {client_id}")
        print(f"文本: {text[:50]}...")
        print(f"声音: {voice_name}")
        
        # 处理上传的音频文件
        prompt_audio_path = None
        emo_audio_path = None
        
        if prompt_audio:
            await progress_callback.send_progress(5, "处理提示音频文件")
            prompt_audio_path = f"./uploads/{task_id}_prompt.wav"
            with open(prompt_audio_path, "wb") as f:
                content = await prompt_audio.read()
                f.write(content)
            print(f"提示音频保存到: {prompt_audio_path}")
        
        if emo_audio:
            await progress_callback.send_progress(10, "处理情感音频文件")
            emo_audio_path = f"./uploads/{task_id}_emo.wav"
            with open(emo_audio_path, "wb") as f:
                content = await emo_audio.read()
                f.write(content)
            print(f"情感音频保存到: {emo_audio_path}")
        
        # 检查连接状态
        if not manager.get_connection_info(client_id).get("connected"):
            print(f"文件处理后连接断开，终止任务: {task_id}")
            return
            
        await progress_callback.send_progress(15, "初始化TTS模型")

        # 创建一个简单的进度回调函数，用于兼容现有的TTS接口
        def sync_progress_callback(progress: float, desc: str = ""):
            progress_percent = int(progress * 100)
            # 使用新的线程安全方法
            success = progress_callback.send_progress_sync(progress_percent, desc)
            if not success:
                print(f"进度发送失败: {progress_percent}% - {desc}")
            return success
        
        # 调用TTS生成函数
        output_path = f"./outputs/{task_id}.wav"
        
        await progress_callback.send_progress(20, "开始语音合成")
        
        # 这里调用实际的TTS生成函数
        # 注意：需要根据实际的TTS函数接口进行调整
        success = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tts_generate_with_callback(
                text=text,
                voice_name=voice_name,
                output_path=output_path,
                prompt_audio_path=prompt_audio_path,
                emo_audio_path=emo_audio_path,
                speed=speed,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                spk_id=spk_id,
                infer_seed=infer_seed,
                use_decoder=use_decoder,
                prompt_text=prompt_text,
                prompt_lang=prompt_lang,
                text_lang=text_lang,
                cut_method=cut_method,
                progress_callback=sync_progress_callback
            )
        )
        
        # 检查生成是否成功
        if not success or not os.path.exists(output_path):
            error_msg = "TTS生成失败或输出文件不存在"
            print(f"=== TTS生成失败 ===")
            print(f"任务ID: {task_id}")
            print(f"输出路径: {output_path}")
            print(f"文件存在: {os.path.exists(output_path)}")
            await progress_callback.send_error(error_msg)
            return
        
        # 最终检查连接状态
        connection_info = manager.get_connection_info(client_id)
        if not connection_info.get("connected"):
            print(f"=== 生成完成但连接已断开 ===")
            print(f"任务ID: {task_id}")
            print(f"客户端ID: {client_id}")
            print(f"输出文件: {output_path}")
            return
        
        # 发送100%进度
        await progress_callback.send_progress(100, "语音合成完成")
        
        # 等待文件完全写入
        await asyncio.sleep(0.5)
        
        # 发送完成消息
        audio_url = f"/outputs/{task_id}.wav"
        success = await progress_callback.send_complete(audio_url)
        
        if success:
            print(f"=== TTS任务完成 ===")
            print(f"任务ID: {task_id}")
            print(f"输出文件: {output_path}")
            print(f"音频URL: {audio_url}")
            print(f"文件大小: {os.path.getsize(output_path)} bytes")
        else:
            print(f"=== 完成消息发送失败 ===")
            print(f"任务ID: {task_id}")
            
    except Exception as e:
        error_msg = f"TTS生成异常: {str(e)}"
        print(f"=== TTS生成异常 ===")
        print(f"任务ID: {task_id}")
        print(f"错误: {e}")
        print(f"错误类型: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        # 尝试发送错误消息
        try:
            await progress_callback.send_error(error_msg)
        except Exception as send_error:
            print(f"发送错误消息失败: {send_error}")
    
    finally:
        # 清理临时文件
        try:
            if prompt_audio_path and os.path.exists(prompt_audio_path):
                os.remove(prompt_audio_path)
            if emo_audio_path and os.path.exists(emo_audio_path):
                os.remove(emo_audio_path)
        except Exception as cleanup_error:
            print(f"清理临时文件失败: {cleanup_error}")


def tts_generate_with_callback(
    text: str,
    voice_name: str,
    output_path: str,
    prompt_audio_path: Optional[str] = None,
    emo_audio_path: Optional[str] = None,
    speed: float = 1.0,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 20,
    spk_id: int = 0,
    infer_seed: int = -1,
    use_decoder: bool = True,
    prompt_text: str = "",
    prompt_lang: str = "zh",
    text_lang: str = "zh",
    cut_method: str = "cut5",
    progress_callback=None
) -> bool:
    """
    实际的TTS生成函数，调用IndexTTS2引擎
    """
    global tts_engine

    try:
        if not tts_engine:
            raise Exception("TTS引擎未初始化")

        if progress_callback:
            progress_callback(0.1, "验证输入参数")

        # 验证必要参数
        if not text or not text.strip():
            raise Exception("文本内容不能为空")

        if not prompt_audio_path or not os.path.exists(prompt_audio_path):
            raise Exception(f"音色参考音频文件不存在: {prompt_audio_path}")

        if progress_callback:
            progress_callback(0.2, "准备TTS参数")

        # 构建IndexTTS2的推理参数
        infer_kwargs = {
            'spk_audio_prompt': prompt_audio_path,
            'text': text.strip(),
            'output_path': output_path,
            'verbose': True
        }

        # 添加情感控制参数
        if emo_audio_path and os.path.exists(emo_audio_path):
            infer_kwargs['emo_audio_prompt'] = emo_audio_path
            if progress_callback:
                progress_callback(0.3, "使用情感参考音频")

        # 添加其他参数
        if hasattr(tts_engine, 'infer'):
            if progress_callback:
                progress_callback(0.4, "开始语音合成")

            # 调用IndexTTS2的infer方法
            tts_engine.infer(**infer_kwargs)

            if progress_callback:
                progress_callback(0.9, "语音合成完成")

            # 验证输出文件
            if not os.path.exists(output_path):
                raise Exception(f"TTS生成失败，输出文件不存在: {output_path}")

            file_size = os.path.getsize(output_path)
            if file_size < 1000:  # 小于1KB可能是无效文件
                raise Exception(f"TTS生成的文件过小，可能无效: {file_size} bytes")

            if progress_callback:
                progress_callback(1.0, f"完成，文件大小: {file_size} bytes")

            print(f"✅ TTS生成成功: {output_path} ({file_size} bytes)")
            return True
        else:
            raise Exception("TTS引擎没有infer方法")

    except Exception as e:
        error_msg = f"TTS生成失败: {str(e)}"
        print(f"❌ {error_msg}")

        # 清理可能生成的不完整文件
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except:
            pass

        return False
@app.post("/api/text/segment")
async def segment_text(text: str = Form(...), max_tokens: int = Form(120)):
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS Engine not initialized")
    
    try:
        text_tokens_list = tts_engine.tokenizer.tokenize(text)
        segments = tts_engine.tokenizer.split_segments(
            text_tokens_list, 
            max_text_tokens_per_segment=max_tokens
        )
        
        result = []
        for i, segment in enumerate(segments):
            segment_str = ''.join(segment)
            tokens_count = len(segment)
            result.append({
                "index": i,
                "content": segment_str,
                "tokens": tokens_count
            })
        
        return {"segments": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/examples")
async def get_examples():
    try:
        examples = []
        with open("examples/cases.jsonl", "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                example = json.loads(line)
                # 为每个示例添加唯一的id
                example["id"] = f"example_{idx + 1}"
                # 添加标题和描述
                if "title" not in example:
                    example["title"] = f"示例 {idx + 1}"
                if "description" not in example:
                    example["description"] = "语音合成示例"
                # 添加标签
                if "tags" not in example:
                    tags = []
                    if example.get("emo_mode") == 0:
                        tags.append("基础")
                    elif example.get("emo_mode") == 1:
                        tags.append("情感音频")
                    elif example.get("emo_mode") == 2:
                        tags.append("情感向量")
                    elif example.get("emo_mode") == 3:
                        tags.append("情感文本")
                    example["tags"] = tags
                examples.append(example)
        return {"examples": examples}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config")
async def get_config():
    if not tts_engine:
        raise HTTPException(status_code=500, detail="TTS Engine not initialized")
    
    return {
        "model_version": getattr(tts_engine, 'model_version', '2.0'),
        "max_mel_tokens": tts_engine.cfg.gpt.max_mel_tokens,
        "max_text_tokens": tts_engine.cfg.gpt.max_text_tokens,
        "languages": ["中文", "English"],
        "emotion_choices": [
            i18n("与音色参考音频相同"),
            i18n("使用情感参考音频"),
            i18n("使用情感向量控制"),
            i18n("使用情感描述文本控制")
        ]
    }

@app.get("/")
async def root():
    return {"message": "IndexTTS API Server is running", "version": "2.0.0"}

if __name__ == "__main__":
    # 配置Uvicorn启动参数，避免多进程日志冲突
    uvicorn.run(
        "api_server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        access_log=False,  # 禁用Uvicorn自带访问日志，避免与自定义日志冲突
        workers=1  # 使用单进程模式，避免多进程日志流冲突
    )