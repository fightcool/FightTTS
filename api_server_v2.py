"""
IndexTTS API Server v2
重构后的模块化API服务器
"""

import os
import sys
import logging
import logging.config
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)
sys.path.insert(0, os.path.join(current_dir, "indextts"))

# 导入应用模块
from app.core.websocket_manager import WebSocketManager
from app.services.tts_service import TTSService
from app.services.audio_samples_service import AudioSamplesService
from app.routers import audio_samples_router, tts_router, websocket_router
from app.routers.tts import set_services as set_tts_services
from app.routers.websocket import set_ws_manager


# ==================== 日志配置 ====================

def setup_logging():
    """配置结构化日志系统"""
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


# 初始化日志
logger = setup_logging()


# ==================== 应用初始化 ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    logger.info("=" * 60)
    logger.info("FightCoolTTS API Server v2 正在启动...")
    logger.info("=" * 60)

    try:
        # 初始化WebSocket管理器
        logger.info("初始化WebSocket管理器...")
        ws_manager = WebSocketManager()
        set_ws_manager(ws_manager)
        logger.info("✓ WebSocket管理器初始化成功")

        # 初始化音频样本服务
        logger.info("初始化音频样本服务...")
        audio_service = AudioSamplesService()
        logger.info("✓ 音频样本服务初始化成功")

        # 初始化TTS服务
        logger.info("初始化TTS服务...")
        tts_service = TTSService(
            model_dir="checkpoints",
            output_dir="outputs",
            use_fp16=False,
            use_cuda_kernel=False,
            use_deepspeed=False
        )
        logger.info("✓ TTS服务初始化成功")

        # 注入服务到路由
        set_tts_services(tts_service, audio_service, ws_manager)

        # 存储到应用状态
        app.state.ws_manager = ws_manager
        app.state.tts_service = tts_service
        app.state.audio_service = audio_service

        logger.info("=" * 60)
        logger.info("✓ 所有服务初始化完成")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"✗ 服务初始化失败: {e}", exc_info=True)
        raise

    yield

    # 关闭
    logger.info("IndexTTS API Server 正在关闭...")

    # 清理资源
    if hasattr(app.state, "ws_manager"):
        # 断开所有WebSocket连接
        for client_id in list(app.state.ws_manager.active_connections.keys()):
            app.state.ws_manager.disconnect(client_id)

    logger.info("✓ 服务已关闭")


def create_app() -> FastAPI:
    """创建FastAPI应用"""

    app = FastAPI(
        title="IndexTTS API",
        description="IndexTTS 文本转语音API服务",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )
    
    # ==================== CORS配置 ====================
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # ==================== 静态文件服务 ====================
    
    # 创建必要的目录
    os.makedirs("outputs", exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("audio_samples/voice_samples", exist_ok=True)
    os.makedirs("audio_samples/emotion_samples", exist_ok=True)
    
    # 挂载静态文件目录
    app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    app.mount("/audio-samples", StaticFiles(directory="audio_samples"), name="audio_samples")
    
    # ==================== 路由注册 ====================
    
    # 注册路由
    app.include_router(websocket_router)
    app.include_router(audio_samples_router)
    app.include_router(tts_router)
    
    # ==================== 基础路由 ====================
    
    @app.get("/")
    async def root():
        """根路径"""
        return {
            "name": "IndexTTS API",
            "version": "2.0.0",
            "status": "running",
            "docs": "/docs"
        }
    
    @app.get("/health")
    async def health_check():
        """健康检查"""
        return {
            "status": "healthy",
            "services": {
                "tts": hasattr(app.state, "tts_service"),
                "audio": hasattr(app.state, "audio_service"),
                "websocket": hasattr(app.state, "ws_manager")
            }
        }

    @app.get("/api/stats")
    async def get_stats():
        """获取系统统计信息（兼容旧API）"""
        return {
            "message": "IndexTTS API Server",
            "version": "2.0.0"
        }

    @app.get("/api/config")
    async def get_config():
        """获取TTS配置信息"""
        tts_service = app.state.tts_service if hasattr(app.state, "tts_service") else None

        # 获取设备信息
        device = "cpu"
        if tts_service and hasattr(tts_service, "tts_engine"):
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except:
                device = "cpu"

        return {
            "model_name": "IndexTTS2",
            "model_version": "2.0.0",
            "device": device,
            "max_mel_tokens": 1500,
            "max_text_tokens": 500,
            "languages": ["zh", "en"],
            "emotion_choices": ["neutral", "happy", "sad", "angry", "peaceful"]
        }

    @app.get("/api/examples")
    async def get_examples():
        """获取示例案例"""
        examples = [
            {
                "id": "example_1",
                "title": "基础语音合成",
                "text": "这是一个基础的语音合成示例。",
                "description": "使用默认参数进行语音合成",
                "tags": ["基础", "中文"]
            },
            {
                "id": "example_2",
                "title": "情感控制示例",
                "text": "今天天气真好，心情也很愉快！",
                "description": "展示情感控制功能",
                "tags": ["情感", "快乐"]
            },
            {
                "id": "example_3",
                "title": "英文合成示例",
                "text": "Hello, this is a text-to-speech example.",
                "description": "英文语音合成",
                "tags": ["英文", "基础"]
            }
        ]
        return {"examples": examples}

    return app


# ==================== 应用实例 ====================

app = create_app()


# ==================== 主函数 ====================

if __name__ == "__main__":
    # 配置Uvicorn启动参数
    uvicorn.run(
        "api_server_v2:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        access_log=False,  # 禁用Uvicorn自带访问日志，避免与自定义日志冲突
        workers=1  # 使用单进程模式，避免多进程日志流冲突
    )

