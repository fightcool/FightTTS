# FightTTS - 基于IndexTTS2的智能语音合成系统

<div align="center">
<img src='assets/index_icon.png' width="200"/>
</div>

<div align="center">
<h3>FightTTS: 现代化的零样本情感语音合成系统</h3>
</div>

<div align="center">
  <a href='https://github.com/fightcool/FightTTS'>
    <img src='https://img.shields.io/badge/GitHub-Code-orange?logo=github'/>
  </a>
  <a href='https://huggingface.co/IndexTeam/IndexTTS-2'>
    <img src='https://img.shields.io/badge/Model-IndexTTS2-blue?logo=huggingface' />
  </a>
  <a href='https://modelscope.cn/models/IndexTeam/IndexTTS-2'>
    <img src='https://img.shields.io/badge/ModelScope-Model-purple?logo=modelscope'/>
  </a>
</div>

## 📖 项目介绍

FightTTS 是基于 IndexTTS2 的现代化语音合成系统，采用前后端分离架构，提供优秀的用户体验和强大的功能。

### 🌟 主要特性

- **🎭 情感控制**: 支持多种情感控制方式（音频、向量、文本）
- **⏱️ 时长控制**: 精确控制语音生成的时长
- **🎯 零样本克隆**: 单个参考音频即可实现音色克隆
- **🌐 现代化前端**: React 19 + TypeScript 响应式界面
- **🔗 实时通信**: WebSocket 实时进度反馈
- **🎛️ API 服务**: 完整的 RESTful API 接口

### 🏗️ 系统架构

```
FightTTS/
├── indextts/           # IndexTTS2 核心引擎
│   ├── infer_v2.py     # IndexTTS2 推理引擎
│   ├── gpt/            # GPT 语言模型
│   ├── s2mel/          # 语音到频谱处理
│   └── utils/          # 工具函数
├── frontend/           # React 前端应用
│   ├── src/
│   │   ├── components/ # UI 组件
│   │   ├── store/      # 状态管理 (Zustand)
│   │   ├── hooks/      # React Hooks
│   │   ├── utils/      # 前端工具
│   │   └── services/   # API 服务
│   └── package.json
├── api_server.py       # FastAPI 后端服务
└── checkpoints/        # 模型文件目录
```

## 🚀 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+
- CUDA 12.8+ (GPU 加速)
- NVIDIA GPU (推荐)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/fightcool/FightTTS.git
cd FightTTS
```

2. **安装 Python 环境**
```bash
# 安装 uv 包管理器 (如果还没有)
pip install -U uv

# 安装项目依赖
uv sync --all-extras
```

3. **安装前端依赖**
```bash
cd frontend
npm install
cd ..
```

4. **下载模型文件**
```bash
# 方法1: 使用 HuggingFace CLI
uv tool install "huggingface-hub[cli,hf_xet]"
hf download IndexTeam/IndexTTS-2 --local-dir=checkpoints

# 方法2: 使用 ModelScope
uv tool install "modelscope"
modelscope download --model IndexTeam/IndexTTS-2 --local_dir checkpoints
```

## 🎮 使用方法

### 方法1: Web 界面 (推荐)

1. **启动后端服务**
```bash
python api_server.py
```

2. **启动前端服务**
```bash
cd frontend
npm run dev
```

3. **访问 Web 界面**
打开浏览器访问: `http://localhost:5173`

### 方法2: API 调用

后端 API 服务器默认运行在 `http://127.0.0.1:8000`

```bash
# 启动 API 服务器
python api_server.py
```

API 文档: `http://127.0.0.1:8000/docs`

### 方法3: Python 代码调用

```python
from indextts.infer_v2 import IndexTTS2

# 初始化模型
tts = IndexTTS2(
    cfg_path="checkpoints/config.yaml",
    model_dir="checkpoints",
    use_fp16=True,
    use_cuda_kernel=False,
    use_deepspeed=False
)

# 基础语音克隆
text = "欢迎使用 FightTTS 系统！"
tts.infer(
    spk_audio_prompt='examples/voice_01.wav',
    text=text,
    output_path="output.wav"
)

# 带情感控制的语音合成
tts.infer(
    spk_audio_prompt='examples/voice_01.wav',
    text="今天心情真不错！",
    output_path="emotional_output.wav",
    emo_text="开心愉悦的心情"
)
```

## 🔧 配置选项

### 后端配置 (api_server.py)

```python
# 服务器端口
host = "127.0.0.1"
port = 8000

# 模型配置
use_fp16 = True           # 使用半精度
use_cuda_kernel = False   # 使用 CUDA 内核
use_deepspeed = False     # 使用 DeepSpeed
```

### 前端配置 (frontend/src/utils/config.ts)

```typescript
// API 基础 URL
apiBaseURL: "http://127.0.0.1:8000"

// WebSocket 配置
wsBaseURL: "ws://localhost:5173"
maxReconnectAttempts: 3
heartbeatInterval: 30000
```

## 🎯 功能特性

### 情感控制

1. **音频参考**: 上传情感参考音频
2. **情感向量**: 8维向量 `[快乐, 愤怒, 悲伤, 恐惧, 厌恶, 忧郁, 惊讶, 平静]`
3. **文本描述**: 自然语言描述情感

### 音频处理

- **格式支持**: WAV, MP3, FLAC, M4A
- **可视化**: WaveSurfer.js 波形显示
- **播放控制**: 完整的音频播放控制

### 实时反馈

- **进度显示**: 实时生成进度
- **状态更新**: WebSocket 实时通信
- **错误处理**: 友好的错误提示

## 🛠️ 开发指南

### 前端开发

```bash
cd frontend

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint

# 预览构建结果
npm run preview
```

### 后端开发

```bash
# 运行 API 服务器
python api_server.py

# 运行测试
PYTHONPATH="$PYTHONPATH:." uv run tests/regression_test.py

# GPU 检查
uv run tools/gpu_check.py
```

### 调试工具

项目包含多个调试工具：

- `debug_websocket.py` - WebSocket 连接调试
- `debug_audio_access.py` - 音频文件访问调试
- `test_websocket_connection.py` - WebSocket 连接测试
- `simple_websocket_test.py` - 简单 WebSocket 测试

## 📊 性能优化

### GPU 优化

- **FP16**: 半精度推理，减少显存使用
- **DeepSpeed**: 大模型加速 (可选)
- **CUDA 内核**: BigVGAN 加速 (可选)

### 前端优化

- **组件记忆化**: 避免不必要的重渲染
- **虚拟化列表**: 大数据量列表优化
- **懒加载**: 按需加载资源
- **缓存策略**: 智能缓存管理

## 📝 模型文件

模型文件总大小约 5GB，包含：

- `gpt.pth` - GPT 语言模型 (~3.3GB)
- `s2mel.pth` - 语音到频谱模型 (~1.2GB)
- `feat1.pt`, `feat2.pt` - 特征提取器
- `config.yaml` - 模型配置
- `pinyin.vocab` - 拼音词汇表

详细下载说明请查看 `checkpoints/README.md`

## 🔗 相关链接

- **IndexTTS2 原项目**: https://github.com/index-tts/index-tts
- **模型下载**: https://huggingface.co/IndexTeam/IndexTTS-2
- **论文**: https://arxiv.org/abs/2506.21619

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目基于 IndexTTS2 开发，遵循相应的开源许可证。

## 🙏 致谢

- 感谢 IndexTTS 团队提供的优秀模型
- 感谢所有贡献者的努力

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: https://github.com/fightcool/FightTTS/issues
- Email: fightcool@example.com

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！