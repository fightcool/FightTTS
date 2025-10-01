# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

IndexTTS2 是一个先进的零样本文本转语音（TTS）系统，专注于情感表达和时长可控的语音合成。它是 IndexTTS 的继任者，提供改进的情感控制、时长精度和多语言支持。

### 核心特性
- **零样本语音克隆**，仅需单个参考音频
- **多维度情感控制**，通过音频提示、向量或文本描述
- **精确的时长控制**用于语音合成
- **多语言支持**（中英文混合建模）
- **实时进度反馈**通过 WebSocket 连接
- **自回归生成**，具有改进的稳定性

## 开发命令

### 环境设置
```bash
# 使用 uv 安装依赖（必需）
uv sync --all-extras

# 使用特定镜像的替代方案
uv sync --all-extras --default-index "https://mirrors.aliyun.com/pypi/simple"

# 下载模型
uv tool install "huggingface-hub[cli,hf_xet]"
hf download IndexTeam/IndexTTS-2 --local-dir=checkpoints
```

### 运行应用程序
```bash
# Web UI（基于 Gradio）
uv run webui.py

# 命令行界面
uv run indextts "要合成的文本" -v examples/voice_01.wav -o output.wav

# API 服务器（FastAPI）
python api_server.py

# 前端开发（React）
cd frontend && npm run dev
```

### 测试
```bash
# 运行回归测试
PYTHONPATH="$PYTHONPATH:." uv run tests/regression_test.py

# 测试 API 功能
python test_api.py

# 测试 WebSocket 连接
python test_websocket_connection.py

# GPU 环境检查
uv run tools/gpu_check.py
```

### 常见 Python 脚本执行
```bash
# 始终使用 uv run 运行 Python 脚本
PYTHONPATH="$PYTHONPATH:." uv run indextts/infer_v2.py
```

## 架构概述

### 核心组件

**IndexTTS2 引擎** (`indextts/infer_v2.py`):
- 具有情感控制功能的主要推理类
- 支持多种情感输入模式（音频、向量、文本）
- 处理时长控制和随机采样

**传统 IndexTTS** (`indextts/infer.py`):
- 上一代 TTS 引擎
- 用于基本语音克隆的更简单界面

**GPT 模型** (`indextts/gpt/`):
- `model_v2.py`: IndexTTS2 的 UnifiedVoice 模型
- `model.py`: 原始基于 GPT 的 TTS 模型
- `conformer_encoder.py`: 用于音频处理的 Conformer 架构

**音频处理** (`indextts/s2mel/`):
- `modules/bigvgan/`: 用于音频生成的神经声码器
- `modules/campplus/`: 说话人嵌入提取
- `dac/`: 用于音频压缩的 Descript Audio Codec

**工具函数** (`indextts/utils/`):
- `maskgct_utils.py`: 语义模型和编解码器工具
- `front.py`: 文本规范化和分词
- `checkpoint.py`: 模型检查点管理

### 模型配置
- 配置文件：`checkpoints/config.yaml`
- 模型检查点：`checkpoints/` 目录
- 音素词汇表：`checkpoints/pinyin.vocab`

### API 架构

**FastAPI 服务器** (`api_server.py`):
- 用于 TTS 生成的 RESTful API 端点
- 支持实时进度更新的 WebSocket
- 结构化日志系统
- 文件上传/下载处理

**前端** (`frontend/`):
- React 19 + TypeScript 应用程序
- Vite 构建系统
- Tailwind CSS 样式
- 用于进度更新的 WebSocket 客户端

## 关键开发模式

### 情感控制实现
IndexTTS2 支持三种情感控制模式：
1. **音频参考**：`emo_audio_prompt` 参数
2. **情感向量**：8 维向量 `[快乐, 愤怒, 悲伤, 恐惧, 厌恶, 忧郁, 惊讶, 平静]`
3. **文本描述**：通过 `emo_text` 参数的自然语言情感描述

### 模型加载模式
```python
from indextts.infer_v2 import IndexTTS2

tts = IndexTTS2(
    cfg_path="checkpoints/config.yaml",
    model_dir="checkpoints",
    use_fp16=False,        # 半精度以提高内存效率
    use_cuda_kernel=False, # BigVGAN CUDA 内核
    use_deepspeed=False    # DeepSpeed 加速
)
```

### 环境变量
- `HF_HUB_CACHE`: 设置为 `./checkpoints/hf_cache` 用于模型缓存
- `HF_ENDPOINT`: 在中国使用 `https://hf-mirror.com` 以更快下载

## 模型版本

### IndexTTS2（当前版本）
- 可控情感的合成
- 时长控制功能
- 通过三阶段训练增强稳定性
- 通过微调 Qwen3 实现基于文本的情感引导

### IndexTTS1（传统版本）
- 基本零样本语音克隆
- 更简单的架构
- 为向后兼容而维护

## 文件组织

```
indextts/
├── infer_v2.py          # 主要的 IndexTTS2 推理引擎
├── infer.py             # 传统 IndexTTS 推理
├── cli.py               # 命令行界面
├── gpt/                 # 基于 GPT 的语言模型
├── s2mel/               # 语音到频谱处理模块
├── utils/               # 工具函数和助手
└── vqvae/               # 矢量量化变分自编码器

frontend/                # React 前端应用程序
├── src/
│   ├── components/      # UI 组件
│   ├── services/        # API 服务层
│   └── store/           # 状态管理

tests/                   # 测试文件和示例
examples/                # 示例音频文件
checkpoints/             # 模型权重和配置
```

## 常见问题和解决方案

### CUDA/GPU 问题
- 使用 `uv run tools/gpu_check.py` 诊断 GPU 检测
- 确保安装了 CUDA Toolkit 12.8+
- 在 CPU 上禁用 FP16：`use_fp16=False`

### 内存管理
- 使用 `use_fp16=True` 减少 VRAM 使用
- 考虑大规模推理使用 DeepSpeed：`use_deepspeed=True`
- 监控批处理期间的 GPU 内存使用

### 模型加载
- 确保模型已下载到 `checkpoints/` 目录
- 使用 `hf download IndexTeam/IndexTTS-2 --local-dir=checkpoints` 下载模型
- 检查 `checkpoints/config.yaml` 中的正确模型路径

### WebSocket 通信
- 连接格式：`ws://localhost:5173/ws/{client_id}`
- 消息类型：`start`、`progress`、`complete`、`error`、`ping`
- 确保正确的 `task_id` 处理以进行进度跟踪

## 性能优化

### 推理速度
- 启用 FP16：`use_fp16=True`
- 使用 CUDA 内核：`use_cuda_kernel=True`
- 考虑 DeepSpeed：`use_deepspeed=True`
- 根据可用 VRAM 调整批处理大小

### 音频质量
- 使用适当的 `emo_alpha` 值（文本情感模式为 0.6-0.9）
- 谨慎启用随机采样：`use_random=True` 会降低语音克隆保真度
- 考虑使用集束搜索获得更稳定的生成：`num_beams > 1`

### 内存效率
- 在推理调用之间清除 GPU 缓存
- 使用适当的 `max_mel_tokens` 限制
- 使用 `nvidia-smi` 或类似工具监控内存使用

## 开发注意事项

- 本项目使用 `uv` 作为主要包管理器
- 始终通过 `uv run` 运行 Python 脚本以确保正确的环境
- 项目支持 IndexTTS2 和传统 IndexTTS1 模型
- 情感控制功能是 IndexTTS2 独有的
- Web UI 提供对所有模型功能的轻松访问
- API 服务器支持具有实时进度更新的编程访问