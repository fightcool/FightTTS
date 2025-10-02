"""
TTS Data Models
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """TTS生成请求"""
    text: str = Field(..., description="要合成的文本")
    emo_control_method: int = Field(default=0, description="情感控制方法")
    emo_weight: float = Field(default=0.65, description="情感权重")
    emo_text: Optional[str] = Field(None, description="情感描述文本")
    emo_random: bool = Field(default=False, description="随机情感")
    max_text_tokens_per_segment: int = Field(default=120, description="每段最大文本token数")
    
    # GPT2 采样参数
    do_sample: bool = Field(default=True, description="是否采样")
    top_p: float = Field(default=0.8, description="Top-p采样")
    top_k: int = Field(default=30, description="Top-k采样")
    temperature: float = Field(default=0.8, description="温度")
    length_penalty: float = Field(default=0.0, description="长度惩罚")
    num_beams: int = Field(default=3, description="束搜索数量")
    repetition_penalty: float = Field(default=10.0, description="重复惩罚")
    max_mel_tokens: int = Field(default=1500, description="最大mel token数")
    
    # 情感向量参数
    emo_vec: Optional[List[float]] = Field(None, description="情感向量")


class TTSTask(BaseModel):
    """TTS任务"""
    id: str = Field(..., description="任务ID")
    status: str = Field(..., description="任务状态: pending, processing, completed, error")
    progress: float = Field(default=0.0, description="进度 0-100")
    message: str = Field(default="", description="状态消息")
    result: Optional[str] = Field(None, description="结果URL")
    error: Optional[str] = Field(None, description="错误信息")
    start_time: float = Field(..., description="开始时间戳")
    created_at: float = Field(..., description="创建时间戳")


class ProgressMessage(BaseModel):
    """进度消息"""
    task_id: str = Field(..., description="任务ID")
    progress: float = Field(..., description="进度 0-100")
    status: str = Field(..., description="状态")
    message: str = Field(..., description="消息")
    result: Optional[str] = Field(None, description="结果")

