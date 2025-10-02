"""
Audio Samples Router
音频样本管理路由
"""

import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from ..models.audio_samples import AudioSampleInfo, AudioScanResult, AudioSampleUpdate
from ..services.audio_samples_service import AudioSamplesService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio-samples", tags=["audio-samples"])

# 创建服务实例
audio_service = AudioSamplesService()


@router.get("/scan", response_model=AudioScanResult)
async def scan_audio_samples():
    """
    扫描所有音频样本
    
    Returns:
        AudioScanResult: 扫描结果，包含音色和情绪样本列表
    """
    try:
        logger.info("开始扫描音频样本")
        result = audio_service.scan_all_samples()
        logger.info(f"扫描完成: 共 {result.total} 个样本")
        return result
    except Exception as e:
        logger.error(f"扫描音频样本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"扫描失败: {str(e)}")


@router.post("/upload", response_model=AudioSampleInfo)
async def upload_audio_sample(
    file: UploadFile = File(...),
    category: str = Form(...),
    name: Optional[str] = Form(None)
):
    """
    上传新的音频样本
    
    Args:
        file: 音频文件
        category: 分类 (voice 或 emotion)
        name: 自定义名称（可选）
    
    Returns:
        AudioSampleInfo: 上传后的样本信息
    """
    try:
        # 验证分类
        if category not in ["voice", "emotion"]:
            raise HTTPException(status_code=400, detail="分类必须是 'voice' 或 'emotion'")
        
        # 读取文件内容
        file_content = await file.read()
        
        if not file_content:
            raise HTTPException(status_code=400, detail="文件内容为空")
        
        logger.info(f"上传音频样本: {file.filename}, 分类: {category}, 大小: {len(file_content)} bytes")
        
        # 保存文件
        sample_info = audio_service.save_uploaded_file(
            file_content=file_content,
            filename=file.filename or "unknown.wav",
            category=category,
            custom_name=name
        )
        
        logger.info(f"音频样本上传成功: {sample_info.id}")
        return sample_info
        
    except ValueError as e:
        logger.warning(f"上传参数错误: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"上传音频样本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.delete("/{sample_id}")
async def delete_audio_sample(sample_id: str):
    """
    删除音频样本
    
    Args:
        sample_id: 样本ID
    
    Returns:
        dict: 删除结果
    """
    try:
        logger.info(f"删除音频样本: {sample_id}")
        audio_service.delete_sample(sample_id)
        logger.info(f"音频样本删除成功: {sample_id}")
        return {"success": True, "message": "删除成功"}
    except FileNotFoundError as e:
        logger.warning(f"样本不存在: {sample_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(f"删除参数错误: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"删除音频样本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.put("/{sample_id}", response_model=AudioSampleInfo)
async def update_audio_sample(sample_id: str, update_data: AudioSampleUpdate):
    """
    更新音频样本（重命名）
    
    Args:
        sample_id: 样本ID
        update_data: 更新数据
    
    Returns:
        AudioSampleInfo: 更新后的样本信息
    """
    try:
        logger.info(f"重命名音频样本: {sample_id} -> {update_data.new_name}")
        sample_info = audio_service.rename_sample(sample_id, update_data.new_name)
        logger.info(f"音频样本重命名成功: {sample_info.id}")
        return sample_info
    except FileNotFoundError as e:
        logger.warning(f"样本不存在: {sample_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(f"重命名参数错误: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"重命名音频样本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"重命名失败: {str(e)}")

