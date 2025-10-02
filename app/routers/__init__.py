"""
Routers Package
"""

from .audio_samples import router as audio_samples_router
from .tts import router as tts_router
from .websocket import router as websocket_router

__all__ = [
    "audio_samples_router",
    "tts_router",
    "websocket_router",
]

