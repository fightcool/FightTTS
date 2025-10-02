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
os.makedirs("audio_samples", exist_ok=True)
os.makedirs("audio_samples/voice_samples", exist_ok=True)
os.makedirs("audio_samples/emotion_samples", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/audio-samples", StaticFiles(directory="audio_samples"), name="audio_samples")

def resolve_sample_path(sample_id: str) -> Optional[str]:
    """
    根据样本ID解析实际的文件路径
    sample_id格式: category_filename (例如: voice_male_01)
    """
    try:
        parts = sample_id.split('_', 1)
        if len(parts) != 2:
            return None

        category, filename_stem = parts

        if category == "voice":
            search_dir = Path("audio_samples/voice_samples")
        elif category == "emotion":
            search_dir = Path("audio_samples/emotion_samples")
        else:
            return None

        # 查找匹配的文件
        for audio_file in search_dir.glob(f"{filename_stem}.*"):
            if audio_file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
                return str(audio_file)

        return None
    except Exception as e:
        logger.error(f"解析样本路径失败: {sample_id}, 错误: {e}")
        return None

class ProgressCallback:
    def __init__(self, client_id: str, task_id: str, manager: ConnectionManager):
        self.client_id = client_id
        self.task_id = task_id
        self.manager = manager
        self.last_progress = 0
        self.start_time = time.time()
        
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
            "error": error_message,
            "timestamp": time.time()
        }
        
        success = await self.manager.send_message(self.client_id, error_msg)
        if success:
            print(f"错误消息发送: {self.task_id} -> {error_message}")
        return success

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
            logger.warning(f"WebSocket 连接失败，clientID: {client_id}")
            return
    except Exception as e:
        logger.error(f"WebSocket connection exception for client {client_id}: {e}")
        return

    try:
        while True:
            try:
                # 设置接收超时，避免长时间阻塞 - 调整为45秒以匹配前端心跳间隔
                data = await asyncio.wait_for(websocket.receive_text(), timeout=45.0)
                message = json.loads(data)

                logger.info(f"Received WebSocket message from {client_id}: type={message.get('type', 'unknown')}")

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
    task_id: str,
    prompt_audio: Optional[UploadFile] = None,
    emo_audio: Optional[UploadFile] = None,
    voice_sample_id: Optional[str] = Form(None),
    emotion_sample_id: Optional[str] = Form(None),
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

        # 处理音频文件 - 支持上传文件或样本ID
        prompt_audio_path = None
        emo_audio_path = None

        # 处理音色音频
        if voice_sample_id:
            # 使用样本ID
            await progress_callback.send_progress(5, "加载音色样本")
            prompt_audio_path = resolve_sample_path(voice_sample_id)
            if not prompt_audio_path or not os.path.exists(prompt_audio_path):
                raise HTTPException(status_code=404, detail=f"音色样本不存在: {voice_sample_id}")
            print(f"使用音色样本: {prompt_audio_path}")
        elif prompt_audio:
            # 上传的文件
            await progress_callback.send_progress(5, "处理提示音频文件")
            prompt_audio_path = f"./uploads/{task_id}_prompt.wav"
            with open(prompt_audio_path, "wb") as f:
                content = await prompt_audio.read()
                f.write(content)
            print(f"提示音频保存到: {prompt_audio_path}")

        # 处理情绪音频
        if emotion_sample_id:
            # 使用样本ID
            await progress_callback.send_progress(10, "加载情绪样本")
            emo_audio_path = resolve_sample_path(emotion_sample_id)
            if not emo_audio_path or not os.path.exists(emo_audio_path):
                raise HTTPException(status_code=404, detail=f"情绪样本不存在: {emotion_sample_id}")
            print(f"使用情绪样本: {emo_audio_path}")
        elif emo_audio:
            # 上传的文件
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
            # 使用asyncio.create_task异步发送进度
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(progress_callback.send_progress(progress_percent, desc))
            except Exception as e:
                print(f"进度回调错误: {e}")
        
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
    # 新增的生成参数
    do_sample: bool = True,
    length_penalty: float = 0.0,
    num_beams: int = 3,
    repetition_penalty: float = 10.0,
    max_mel_tokens: int = 1500,
    max_text_tokens_per_segment: int = 120,
    emo_weight: float = 1.0,
    emo_random: bool = False,
    emo_control_method: str = "audio",
    emo_text: str = None,
    emo_vector: list = None,
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

# ==================== 音频样本管理API ====================

class AudioSampleInfo(BaseModel):
    id: str
    name: str
    category: str
    subcategory: str
    fileName: str
    filePath: str
    duration: float = 0.0
    description: Optional[str] = None
    tags: List[str] = []
    metadata: Optional[dict] = None

@app.get("/api/audio-samples/scan")
async def scan_audio_samples():
    """扫描并返回所有音频样本"""
    try:
        voice_samples = []
        emotion_samples = []

        # 扫描音色样本目录
        voice_dir = Path("audio_samples/voice_samples")
        if voice_dir.exists():
            for audio_file in voice_dir.glob("*"):
                if audio_file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
                    sample = {
                        "id": f"voice_{audio_file.stem}",
                        "name": audio_file.stem.replace('_', ' ').title(),
                        "category": "voice",
                        "subcategory": infer_subcategory(audio_file.stem, "voice"),
                        "fileName": audio_file.name,
                        "filePath": f"/audio-samples/voice_samples/{audio_file.name}",
                        "duration": 0.0,
                        "description": f"音色样本 - {audio_file.stem}",
                        "tags": ["voice", infer_subcategory(audio_file.stem, "voice")],
                        "metadata": {
                            "size": audio_file.stat().st_size,
                            "created": audio_file.stat().st_ctime
                        }
                    }
                    voice_samples.append(sample)

        # 扫描情绪样本目录
        emotion_dir = Path("audio_samples/emotion_samples")
        if emotion_dir.exists():
            for audio_file in emotion_dir.glob("*"):
                if audio_file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
                    sample = {
                        "id": f"emotion_{audio_file.stem}",
                        "name": audio_file.stem.replace('_', ' ').title(),
                        "category": "emotion",
                        "subcategory": infer_subcategory(audio_file.stem, "emotion"),
                        "fileName": audio_file.name,
                        "filePath": f"/audio-samples/emotion_samples/{audio_file.name}",
                        "duration": 0.0,
                        "description": f"情绪样本 - {audio_file.stem}",
                        "tags": ["emotion", infer_subcategory(audio_file.stem, "emotion")],
                        "metadata": {
                            "size": audio_file.stat().st_size,
                            "created": audio_file.stat().st_ctime
                        }
                    }
                    emotion_samples.append(sample)

        logger.info(f"扫描完成: {len(voice_samples)} 个音色样本, {len(emotion_samples)} 个情绪样本")

        return {
            "voice_samples": voice_samples,
            "emotion_samples": emotion_samples,
            "total": len(voice_samples) + len(emotion_samples)
        }
    except Exception as e:
        logger.error(f"扫描音频样本失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def infer_subcategory(filename: str, category: str) -> str:
    """从文件名推断子分类"""
    name = filename.lower()

    if category == "voice":
        if "male" in name and "female" not in name:
            return "male"
        elif "female" in name:
            return "female"
        elif "child" in name or "kid" in name:
            return "child"
        elif "old" in name or "elder" in name:
            return "old"
        return "neutral"

    elif category == "emotion":
        if "happy" in name or "excited" in name or "cheerful" in name:
            return "happy"
        elif "sad" in name or "cry" in name or "grief" in name:
            return "sad"
        elif "angry" in name or "irritated" in name or "furious" in name:
            return "angry"
        elif "peaceful" in name or "calm" in name or "relax" in name:
            return "peaceful"
        return "neutral"

    return "neutral"

@app.post("/api/audio-samples/upload")
async def upload_audio_sample(
    file: UploadFile = File(...),
    category: str = Form(...),
    name: Optional[str] = Form(None)
):
    """上传新的音频样本"""
    try:
        # 验证分类
        if category not in ["voice", "emotion"]:
            raise HTTPException(status_code=400, detail="分类必须是 'voice' 或 'emotion'")

        # 验证文件格式
        if not file.filename:
            raise HTTPException(status_code=400, detail="文件名不能为空")

        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
            raise HTTPException(status_code=400, detail="不支持的音频格式")

        # 生成文件名
        if name:
            # 使用用户提供的名称
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')
            filename = f"{safe_name}{file_ext}"
        else:
            # 使用原始文件名
            filename = file.filename

        # 确定保存路径
        if category == "voice":
            save_dir = Path("audio_samples/voice_samples")
        else:
            save_dir = Path("audio_samples/emotion_samples")

        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / filename

        # 检查文件是否已存在
        if save_path.exists():
            # 添加时间戳避免冲突
            timestamp = int(time.time())
            stem = save_path.stem
            filename = f"{stem}_{timestamp}{file_ext}"
            save_path = save_dir / filename

        # 保存文件
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)

        logger.info(f"音频样本上传成功: {save_path}")

        # 返回样本信息
        sample = {
            "id": f"{category}_{save_path.stem}",
            "name": save_path.stem.replace('_', ' ').title(),
            "category": category,
            "subcategory": infer_subcategory(save_path.stem, category),
            "fileName": filename,
            "filePath": f"/audio-samples/{category}_samples/{filename}",
            "duration": 0.0,
            "description": f"{category} 样本 - {save_path.stem}",
            "tags": [category, infer_subcategory(save_path.stem, category)],
            "metadata": {
                "size": save_path.stat().st_size,
                "created": save_path.stat().st_ctime
            }
        }

        return sample

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传音频样本失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/audio-samples/{sample_id}")
async def delete_audio_sample(sample_id: str):
    """删除音频样本"""
    try:
        # 解析sample_id (格式: category_filename)
        parts = sample_id.split('_', 1)
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="无效的样本ID")

        category, filename_stem = parts

        if category not in ["voice", "emotion"]:
            raise HTTPException(status_code=400, detail="无效的分类")

        # 查找文件
        if category == "voice":
            search_dir = Path("audio_samples/voice_samples")
        else:
            search_dir = Path("audio_samples/emotion_samples")

        # 查找匹配的文件
        found_file = None
        for audio_file in search_dir.glob(f"{filename_stem}.*"):
            if audio_file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
                found_file = audio_file
                break

        if not found_file or not found_file.exists():
            raise HTTPException(status_code=404, detail="音频样本不存在")

        # 删除文件
        found_file.unlink()
        logger.info(f"音频样本已删除: {found_file}")

        return {"message": "音频样本已删除", "id": sample_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除音频样本失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/audio-samples/{sample_id}")
async def update_audio_sample(sample_id: str, new_name: str = Form(...)):
    """更新音频样本信息（重命名）"""
    try:
        # 解析sample_id
        parts = sample_id.split('_', 1)
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="无效的样本ID")

        category, filename_stem = parts

        if category not in ["voice", "emotion"]:
            raise HTTPException(status_code=400, detail="无效的分类")

        # 查找文件
        if category == "voice":
            search_dir = Path("audio_samples/voice_samples")
        else:
            search_dir = Path("audio_samples/emotion_samples")

        # 查找匹配的文件
        found_file = None
        for audio_file in search_dir.glob(f"{filename_stem}.*"):
            if audio_file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
                found_file = audio_file
                break

        if not found_file or not found_file.exists():
            raise HTTPException(status_code=404, detail="音频样本不存在")

        # 生成新文件名
        safe_name = "".join(c for c in new_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        new_filename = f"{safe_name}{found_file.suffix}"
        new_path = search_dir / new_filename

        # 检查新文件名是否已存在
        if new_path.exists() and new_path != found_file:
            raise HTTPException(status_code=400, detail="该名称已被使用")

        # 重命名文件
        found_file.rename(new_path)
        logger.info(f"音频样本已重命名: {found_file} -> {new_path}")

        # 返回更新后的样本信息
        sample = {
            "id": f"{category}_{new_path.stem}",
            "name": new_path.stem.replace('_', ' ').title(),
            "category": category,
            "subcategory": infer_subcategory(new_path.stem, category),
            "fileName": new_filename,
            "filePath": f"/audio-samples/{category}_samples/{new_filename}",
            "duration": 0.0,
            "description": f"{category} 样本 - {new_path.stem}",
            "tags": [category, infer_subcategory(new_path.stem, category)],
            "metadata": {
                "size": new_path.stat().st_size,
                "created": new_path.stat().st_ctime
            }
        }

        return sample

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新音频样本失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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