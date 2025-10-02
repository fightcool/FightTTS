"""
TTS Router
TTS生成路由
"""

import os
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional

from ..models.tts import TTSRequest
from ..services.tts_service import TTSService
from ..services.audio_samples_service import AudioSamplesService
from ..core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

# 全局服务实例（将在应用启动时注入）
tts_service: Optional[TTSService] = None
audio_service: Optional[AudioSamplesService] = None
ws_manager: Optional[WebSocketManager] = None


def set_services(tts: TTSService, audio: AudioSamplesService, ws: WebSocketManager):
    """设置服务实例"""
    global tts_service, audio_service, ws_manager
    tts_service = tts
    audio_service = audio
    ws_manager = ws


@router.post("/generate")
async def generate_tts(
    text: str = Form(...),
    client_id: str = Form(...),
    task_id: Optional[str] = Form(None),
    
    # 音频文件上传（可选）
    prompt_audio: Optional[UploadFile] = File(None),
    emo_audio: Optional[UploadFile] = File(None),
    
    # 音频样本ID（可选）
    voice_sample_id: Optional[str] = Form(None),
    emotion_sample_id: Optional[str] = Form(None),
    
    # TTS参数
    emo_control_method: int = Form(0),
    emo_weight: float = Form(0.65),
    emo_text: Optional[str] = Form(None),
    emo_random: bool = Form(False),
    max_text_tokens_per_segment: int = Form(120),
    do_sample: bool = Form(True),
    top_p: float = Form(0.8),
    top_k: int = Form(30),
    temperature: float = Form(0.8),
    length_penalty: float = Form(0.0),
    num_beams: int = Form(3),
    repetition_penalty: float = Form(10.0),
    max_mel_tokens: int = Form(1500),
):
    """
    生成TTS语音
    
    支持两种方式提供音频：
    1. 直接上传文件（prompt_audio, emo_audio）
    2. 使用样本ID（voice_sample_id, emotion_sample_id）
    """
    if not tts_service or not audio_service or not ws_manager:
        raise HTTPException(status_code=500, detail="服务未初始化")
    
    try:
        # 生成任务ID
        if not task_id:
            task_id = f"task_{uuid.uuid4().hex[:16]}"
        
        logger.info(f"收到TTS生成请求: task_id={task_id}, client_id={client_id}")
        
        # 注册任务
        ws_manager.register_task(task_id, client_id)
        
        # 发送开始消息
        await ws_manager.send_start_message(task_id)
        
        # 处理音色音频
        prompt_audio_path = None
        temp_prompt_file = None
        
        if voice_sample_id:
            # 使用样本ID
            prompt_audio_path = audio_service.resolve_sample_path(voice_sample_id)
            if not prompt_audio_path:
                raise HTTPException(status_code=404, detail=f"音色样本不存在: {voice_sample_id}")
            logger.info(f"使用音色样本: {voice_sample_id}")
        elif prompt_audio:
            # 使用上传的文件
            temp_prompt_file = f"uploads/{uuid.uuid4()}_{prompt_audio.filename}"
            os.makedirs("uploads", exist_ok=True)
            
            with open(temp_prompt_file, "wb") as f:
                f.write(await prompt_audio.read())
            
            prompt_audio_path = temp_prompt_file
            logger.info(f"使用上传的音色文件: {prompt_audio.filename}")
        else:
            raise HTTPException(status_code=400, detail="必须提供音色音频（prompt_audio 或 voice_sample_id）")
        
        # 处理情绪音频
        emo_audio_path = None
        temp_emo_file = None
        
        if emotion_sample_id:
            # 使用样本ID
            emo_audio_path = audio_service.resolve_sample_path(emotion_sample_id)
            if not emo_audio_path:
                raise HTTPException(status_code=404, detail=f"情绪样本不存在: {emotion_sample_id}")
            logger.info(f"使用情绪样本: {emotion_sample_id}")
        elif emo_audio:
            # 使用上传的文件
            temp_emo_file = f"uploads/{uuid.uuid4()}_{emo_audio.filename}"
            os.makedirs("uploads", exist_ok=True)
            
            with open(temp_emo_file, "wb") as f:
                f.write(await emo_audio.read())
            
            emo_audio_path = temp_emo_file
            logger.info(f"使用上传的情绪文件: {emo_audio.filename}")
        
        # 创建TTS请求
        tts_request = TTSRequest(
            text=text,
            emo_control_method=emo_control_method,
            emo_weight=emo_weight,
            emo_text=emo_text,
            emo_random=emo_random,
            max_text_tokens_per_segment=max_text_tokens_per_segment,
            do_sample=do_sample,
            top_p=top_p,
            top_k=top_k,
            temperature=temperature,
            length_penalty=length_penalty,
            num_beams=num_beams,
            repetition_penalty=repetition_penalty,
            max_mel_tokens=max_mel_tokens
        )
        
        # 创建进度回调
        async def progress_callback(progress: float, message: str):
            await ws_manager.send_progress_message(task_id, progress, message)
        
        # 生成语音
        try:
            output_path = await tts_service.generate_speech(
                request=tts_request,
                prompt_audio_path=prompt_audio_path,
                emo_audio_path=emo_audio_path,
                output_filename=f"{task_id}.wav",
                progress_callback=progress_callback
            )
            
            # 获取输出URL
            output_url = tts_service.get_output_url(output_path)
            
            # 发送完成消息
            await ws_manager.send_complete_message(task_id, output_url)
            
            logger.info(f"TTS生成成功: {task_id}, 输出: {output_url}")
            
            return {
                "success": True,
                "task_id": task_id,
                "result": output_url,
                "message": "生成成功"
            }
            
        except Exception as e:
            logger.error(f"TTS生成失败: {task_id}, 错误: {e}", exc_info=True)
            await ws_manager.send_error_message(task_id, str(e))
            raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")
        
        finally:
            # 清理临时文件
            if temp_prompt_file and os.path.exists(temp_prompt_file):
                try:
                    os.remove(temp_prompt_file)
                except Exception as e:
                    logger.warning(f"清理临时文件失败: {temp_prompt_file}, 错误: {e}")
            
            if temp_emo_file and os.path.exists(temp_emo_file):
                try:
                    os.remove(temp_emo_file)
                except Exception as e:
                    logger.warning(f"清理临时文件失败: {temp_emo_file}, 错误: {e}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS请求处理失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    # 这里可以实现任务状态查询逻辑
    # 目前通过WebSocket实时推送，暂不需要轮询接口
    return {"task_id": task_id, "message": "请通过WebSocket获取实时状态"}

