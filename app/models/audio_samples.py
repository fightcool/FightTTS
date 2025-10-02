"""
Audio Samples Data Models
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class AudioSampleInfo(BaseModel):
    """音频样本信息"""
    id: str = Field(..., description="样本唯一ID")
    name: str = Field(..., description="样本名称")
    category: str = Field(..., description="分类: voice 或 emotion")
    subcategory: str = Field(..., description="子分类")
    fileName: str = Field(..., description="文件名")
    filePath: str = Field(..., description="文件路径")
    duration: float = Field(default=0.0, description="时长(秒)")
    description: Optional[str] = Field(None, description="描述")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    metadata: Optional[dict] = Field(None, description="元数据")


class AudioSampleUpload(BaseModel):
    """音频样本上传请求"""
    category: str = Field(..., description="分类: voice 或 emotion")
    name: Optional[str] = Field(None, description="自定义名称")


class AudioSampleUpdate(BaseModel):
    """音频样本更新请求"""
    new_name: str = Field(..., description="新名称")


class AudioScanResult(BaseModel):
    """音频扫描结果"""
    voice_samples: List[AudioSampleInfo] = Field(default_factory=list)
    emotion_samples: List[AudioSampleInfo] = Field(default_factory=list)
    total: int = Field(default=0)

