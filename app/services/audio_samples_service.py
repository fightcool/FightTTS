"""
Audio Samples Service
音频样本管理服务
"""

import os
import time
import logging
from pathlib import Path
from typing import List, Optional

from ..models.audio_samples import AudioSampleInfo, AudioScanResult

logger = logging.getLogger(__name__)


class AudioSamplesService:
    """音频样本管理服务"""
    
    def __init__(self, base_dir: str = "audio_samples"):
        self.base_dir = Path(base_dir)
        self.voice_dir = self.base_dir / "voice_samples"
        self.emotion_dir = self.base_dir / "emotion_samples"
        
        # 确保目录存在
        self.voice_dir.mkdir(parents=True, exist_ok=True)
        self.emotion_dir.mkdir(parents=True, exist_ok=True)
        
        # 支持的音频格式
        self.supported_formats = ['.wav', '.mp3', '.m4a', '.flac', '.ogg']
    
    def scan_all_samples(self) -> AudioScanResult:
        """扫描所有音频样本"""
        try:
            voice_samples = self._scan_directory(self.voice_dir, "voice")
            emotion_samples = self._scan_directory(self.emotion_dir, "emotion")
            
            total = len(voice_samples) + len(emotion_samples)
            logger.info(f"扫描完成: {len(voice_samples)} 个音色样本, {len(emotion_samples)} 个情绪样本")
            
            return AudioScanResult(
                voice_samples=voice_samples,
                emotion_samples=emotion_samples,
                total=total
            )
        except Exception as e:
            logger.error(f"扫描音频样本失败: {e}")
            raise
    
    def _scan_directory(self, directory: Path, category: str) -> List[AudioSampleInfo]:
        """扫描指定目录"""
        samples = []
        
        if not directory.exists():
            return samples
        
        for audio_file in directory.iterdir():
            if audio_file.is_file() and audio_file.suffix.lower() in self.supported_formats:
                try:
                    sample = self._create_sample_info(audio_file, category)
                    samples.append(sample)
                except Exception as e:
                    logger.warning(f"处理文件 {audio_file} 失败: {e}")
                    continue
        
        return samples
    
    def _create_sample_info(self, file_path: Path, category: str) -> AudioSampleInfo:
        """创建样本信息"""
        file_stem = file_path.stem
        subcategory = self._infer_subcategory(file_stem, category)
        
        # 构建相对路径用于Web访问
        relative_path = f"/audio-samples/{category}_samples/{file_path.name}"
        
        return AudioSampleInfo(
            id=f"{category}_{file_stem}",
            name=file_stem.replace('_', ' ').title(),
            category=category,
            subcategory=subcategory,
            fileName=file_path.name,
            filePath=relative_path,
            duration=0.0,  # 可以后续添加音频时长检测
            description=f"{category} 样本 - {file_stem}",
            tags=[category, subcategory],
            metadata={
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime
            }
        )
    
    def _infer_subcategory(self, filename: str, category: str) -> str:
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
    
    def save_uploaded_file(
        self, 
        file_content: bytes, 
        filename: str, 
        category: str,
        custom_name: Optional[str] = None
    ) -> AudioSampleInfo:
        """保存上传的文件"""
        # 验证分类
        if category not in ["voice", "emotion"]:
            raise ValueError("分类必须是 'voice' 或 'emotion'")
        
        # 验证文件格式
        file_ext = Path(filename).suffix.lower()
        if file_ext not in self.supported_formats:
            raise ValueError(f"不支持的音频格式: {file_ext}")
        
        # 确定保存目录
        save_dir = self.voice_dir if category == "voice" else self.emotion_dir
        
        # 生成文件名
        if custom_name:
            safe_name = "".join(c for c in custom_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')
            final_filename = f"{safe_name}{file_ext}"
        else:
            final_filename = filename
        
        save_path = save_dir / final_filename
        
        # 检查文件是否已存在
        if save_path.exists():
            timestamp = int(time.time())
            stem = save_path.stem
            final_filename = f"{stem}_{timestamp}{file_ext}"
            save_path = save_dir / final_filename
        
        # 保存文件
        with open(save_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"音频样本上传成功: {save_path}")
        
        # 返回样本信息
        return self._create_sample_info(save_path, category)
    
    def delete_sample(self, sample_id: str) -> bool:
        """删除音频样本"""
        # 解析sample_id
        parts = sample_id.split('_', 1)
        if len(parts) != 2:
            raise ValueError("无效的样本ID")
        
        category, filename_stem = parts
        
        if category not in ["voice", "emotion"]:
            raise ValueError("无效的分类")
        
        # 查找文件
        search_dir = self.voice_dir if category == "voice" else self.emotion_dir
        
        for audio_file in search_dir.glob(f"{filename_stem}.*"):
            if audio_file.suffix.lower() in self.supported_formats:
                audio_file.unlink()
                logger.info(f"音频样本已删除: {audio_file}")
                return True
        
        raise FileNotFoundError(f"音频样本不存在: {sample_id}")
    
    def rename_sample(self, sample_id: str, new_name: str) -> AudioSampleInfo:
        """重命名音频样本"""
        # 解析sample_id
        parts = sample_id.split('_', 1)
        if len(parts) != 2:
            raise ValueError("无效的样本ID")
        
        category, filename_stem = parts
        
        if category not in ["voice", "emotion"]:
            raise ValueError("无效的分类")
        
        # 查找文件
        search_dir = self.voice_dir if category == "voice" else self.emotion_dir
        
        found_file = None
        for audio_file in search_dir.glob(f"{filename_stem}.*"):
            if audio_file.suffix.lower() in self.supported_formats:
                found_file = audio_file
                break
        
        if not found_file:
            raise FileNotFoundError(f"音频样本不存在: {sample_id}")
        
        # 生成新文件名
        safe_name = "".join(c for c in new_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        new_filename = f"{safe_name}{found_file.suffix}"
        new_path = search_dir / new_filename
        
        # 检查新文件名是否已存在
        if new_path.exists() and new_path != found_file:
            raise ValueError("该名称已被使用")
        
        # 重命名文件
        found_file.rename(new_path)
        logger.info(f"音频样本已重命名: {found_file} -> {new_path}")
        
        # 返回更新后的样本信息
        return self._create_sample_info(new_path, category)
    
    def resolve_sample_path(self, sample_id: str) -> Optional[str]:
        """根据样本ID解析实际的文件路径"""
        try:
            parts = sample_id.split('_', 1)
            if len(parts) != 2:
                return None
            
            category, filename_stem = parts
            
            if category == "voice":
                search_dir = self.voice_dir
            elif category == "emotion":
                search_dir = self.emotion_dir
            else:
                return None
            
            # 查找匹配的文件
            for audio_file in search_dir.glob(f"{filename_stem}.*"):
                if audio_file.suffix.lower() in self.supported_formats:
                    return str(audio_file)
            
            return None
        except Exception as e:
            logger.error(f"解析样本路径失败: {sample_id}, 错误: {e}")
            return None

