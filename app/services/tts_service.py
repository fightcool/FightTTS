"""
TTS Service
TTS生成服务
"""

import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Callable

from indextts.infer_v2 import IndexTTS2
from ..models.tts import TTSRequest

logger = logging.getLogger(__name__)


class TTSService:
    """TTS生成服务"""
    
    def __init__(
        self,
        model_dir: str = "checkpoints",
        output_dir: str = "outputs",
        use_fp16: bool = False,
        use_cuda_kernel: bool = False,
        use_deepspeed: bool = False
    ):
        self.model_dir = model_dir
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化TTS模型
        logger.info("正在初始化IndexTTS2模型...")
        try:
            self.tts_engine = IndexTTS2(
                cfg_path=os.path.join(model_dir, "config.yaml"),
                model_dir=model_dir,
                use_fp16=use_fp16,
                use_cuda_kernel=use_cuda_kernel,
                use_deepspeed=use_deepspeed
            )
            logger.info("IndexTTS2模型初始化成功")
        except Exception as e:
            logger.error(f"IndexTTS2模型初始化失败: {e}")
            raise
    
    async def generate_speech(
        self,
        request: TTSRequest,
        prompt_audio_path: str,
        emo_audio_path: Optional[str] = None,
        output_filename: Optional[str] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> str:
        """
        生成语音
        
        Args:
            request: TTS请求参数
            prompt_audio_path: 音色参考音频路径
            emo_audio_path: 情绪参考音频路径（可选）
            output_filename: 输出文件名（可选）
            progress_callback: 进度回调函数
        
        Returns:
            生成的音频文件路径
        """
        try:
            # 生成输出文件名
            if not output_filename:
                output_filename = f"{uuid.uuid4()}.wav"
            
            output_path = self.output_dir / output_filename
            
            # 发送开始消息
            if progress_callback:
                progress_callback(0, "开始生成语音...")
            
            # 准备TTS参数 - 注意参数名必须与IndexTTS2.infer()匹配
            tts_params = {
                "spk_audio_prompt": prompt_audio_path,  # 音色参考音频（必需）
                "text": request.text,
                "output_path": str(output_path),
                "emo_audio_prompt": emo_audio_path,  # 情感参考音频（可选）
                "emo_alpha": request.emo_weight,  # 情感权重
                "emo_vector": request.emo_vec,  # 情感向量（可选）
                "use_emo_text": bool(request.emo_text),  # 是否使用文本情感
                "emo_text": request.emo_text,  # 情感文本（可选）
                "use_random": request.emo_random,  # 随机采样
                "max_text_tokens_per_segment": request.max_text_tokens_per_segment,
                "verbose": True,
                # GPT生成参数
                "do_sample": request.do_sample,
                "top_p": request.top_p,
                "top_k": request.top_k,
                "temperature": request.temperature,
                "length_penalty": request.length_penalty,
                "num_beams": request.num_beams,
                "repetition_penalty": request.repetition_penalty,
                "max_mel_tokens": request.max_mel_tokens
            }
            
            # 设置进度回调到TTS引擎
            # IndexTTS2使用gr_progress属性而不是参数
            if progress_callback:
                def wrapped_progress_callback(progress: float, desc: str):
                    # 将0-1的进度转换为0-100
                    progress_callback(progress * 100, desc)
                self.tts_engine.gr_progress = wrapped_progress_callback
            else:
                self.tts_engine.gr_progress = None

            # 调用TTS引擎生成语音
            logger.info(f"开始生成TTS: {request.text[:50]}...")

            result = self.tts_engine.infer(**tts_params)
            
            # 检查生成结果
            if not output_path.exists():
                raise RuntimeError("TTS生成失败：输出文件不存在")
            
            logger.info(f"TTS生成成功: {output_path}")
            
            # 发送完成消息
            if progress_callback:
                progress_callback(100, "语音生成完成")
            
            return str(output_path)
            
        except Exception as e:
            logger.error(f"TTS生成失败: {e}", exc_info=True)
            if progress_callback:
                progress_callback(0, f"生成失败: {str(e)}")
            raise
    
    def get_output_url(self, file_path: str) -> str:
        """
        将文件路径转换为Web访问URL
        
        Args:
            file_path: 文件路径
        
        Returns:
            Web访问URL
        """
        file_path = Path(file_path)
        if file_path.is_absolute():
            # 转换为相对于output_dir的路径
            try:
                relative_path = file_path.relative_to(self.output_dir.parent)
                return f"/{relative_path.as_posix()}"
            except ValueError:
                # 如果不在output_dir下，返回文件名
                return f"/outputs/{file_path.name}"
        else:
            return f"/outputs/{file_path.name}"
    
    def cleanup_old_files(self, max_age_hours: int = 24) -> int:
        """
        清理旧的输出文件
        
        Args:
            max_age_hours: 最大保留时间（小时）
        
        Returns:
            删除的文件数量
        """
        import time
        
        deleted_count = 0
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        try:
            for file_path in self.output_dir.glob("*.wav"):
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        file_path.unlink()
                        deleted_count += 1
                        logger.debug(f"删除旧文件: {file_path}")
            
            if deleted_count > 0:
                logger.info(f"清理完成，删除了 {deleted_count} 个旧文件")
            
            return deleted_count
        except Exception as e:
            logger.error(f"清理旧文件失败: {e}")
            return deleted_count

