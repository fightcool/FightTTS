# FightTTS 🎙️

<div align="center">
  <a href="https://github.com/fightcool/FightTTS">
    <img src="https://img.shields.io/badge/GitHub-Code-orange?logo=github" alt="GitHub代码库" />
  </a>
  <a href="https://fightcool.github.io/FightTTS/">
    <img src="https://img.shields.io/badge/🌐 Demo-orange?logo=github pages" alt="在线演示" />
  </a>
  <a href="https://huggingface.co/spaces/IndexTeam/IndexTTS-2-Demo">
    <img src="https://img.shields.io/badge/HuggingFace-Demo-blue?logo=huggingface" alt="Hugging Face模型" />
  </a>
  <a href="https://modelscope.cn/models/IndexTeam/IndexTTS-2">
    <img src="https://img.shields.io/badge/ModelScope-Model-purple?logo=modelscope" alt="ModelScope模型" />
  </a>
</div>

## 🚀 项目简介

**FightTTS** 是基于 **IndexTTS2** 的先进TTS（文本转语音）项目，专注于情感表达和时长可控的语音合成。

### ✨ 核心特性

- 🎯️ **零样本语音克隆** - 仅需参考音频即可复刻音色
- 🎭️ **多维度情感控制** - 支持情感音频、情感向量、情感文本描述
- 🌐 **多语言支持** - 中英文混合语音合成
- ⚡️ **实时进度反馈** - WebSocket实时显示生成进度
- 🎛️ **高级参数调节** - temperature、top_p、top_k、beam search等
- 📱 **历史记录管理** - 任务历史查看和管理

### 🎯 **技术亮点**

- **Auto-Regressive Generation**: 自回归生成机制，提高语音自然度
- **Duration Control**: 精确控制生成音频时长
- **Emotion Expression**: 多种情感控制方式，让语音更有表现力
- **Real-time Progress**: WebSocket实时进度更新
- **High-Quality Output**: 基于先进模型，音质卓越

## 🏗️ 技术架构

### 后端 (Python)
- **框架**: FastAPI + Uvicorn
- **核心引擎**: IndexTTS2 (PyTorch)
- **实时通信**: WebSocket (异步双向通信)
- **静态服务**: 静态文件挂载
- **日志系统**: 结构化日志配置

### 前端 (React TypeScript)
- **框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI库**: Tailwind CSS + Lucide React图标
- **状态管理**: Zustand
- **音频处理**: WaveSurfer.js

## 🚀 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+
- CUDA兼容的GPU（推荐）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/fightcool/FightTTS.git
   cd FightTTS
   ```

2. **后端设置**
   ```bash
   # 创建虚拟环境
   python -m venv venv
   source venv/bin/activate  # Windows
   source venv/bin/activate   # Linux/macOS

   # 安装依赖
   pip install -r requirements-api.txt

   # 下载模型（如果需要）
   # 见模型下载指南
   ```

3. **前端设置**
   ```bash
   cd frontend
   npm install
   ```

4. **启动服务**
   ```bash
   # 终端1 (默认8000端口)
   python api_server.py

   # 终端2 (默认5173端口)
   cd frontend
   npm run dev
   ```

5. **访问应用**
   - 前端界面: http://localhost:5173
   - API文档: http://localhost:8000/docs

## 📖 使用指南

### 基本TTS生成

1. 输入要转换的文本
2. 选择音色参考音频（可选）
3. 选择情感控制方式：
   - 情感参考音频
   - 情感向量控制
   - 情感文本描述
4. 调节高级参数（可选）
5. 点击生成按钮
6. 实时查看进度更新
7. 生成完成后自动播放音频

### 高级功能

#### 情感控制

```python
# 1. 情感参考音频
from pathlib import Path

# 情感参考音频路径
emotion_audio = Path("path/to/emotion.wav")

# 2. 情感向量控制（8维）
emotion_vector = [0.5, -0.3, 0.8, 0.2, -0.1, 0.6, 0.4, -0.2]

# 3. 情感文本描述
emotion_text = "用开心的语气朗读这段文字"
```

#### 参数调节

| 参数 | 范围 | 说明 |
|------|------|------|
| temperature | 0.1-1.0 | 控制生成随机性，越低越稳定 |
| top_p | 0.1-0.9 | 核采样概率 |
| top_k | 1-100 | 保留top_k个候选token |
| num_beams | 1-10 | beam search宽度 |
| max_mel_tokens | 100-3000 | 最大mel tokens |

## 🔧 API文档

### 主要端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/tts/generate` | 生成TTS音频 |
| GET | `/api/config` | 获取配置信息 |
| GET | `/api/examples` | 获取示例案例 |
| GET | `/api/stats` | 获取服务器统计 |

### WebSocket通信

**连接地址**: `ws://localhost:5173/ws/{client_id}`

**消息类型**:
- `start` - 任务开始
- `progress` - 进度更新
- `complete` - 任务完成
- `error` - 任务错误
- `ping` - 心跳保持连接

### 请求示例

```python
import requests

# 基本TTS请求
data = {
    "text": "Hello, this is a test!",
    "voice_name": "default",
    "temperature": 0.7,
    "top_p": 0.9
}

response = requests.post(
    "http://localhost:8000/api/tts/generate",
    params=data
)
```

## 📁 项目结构

```
FightTTS/
├── api_server.py              # FastAPI服务器
├── frontend/                  # React前端应用
│   ├── src/
│   │   ├── components/          # UI组件
│   │   ├── hooks/             # 自定义Hook
│   │   ├── services/          # 服务层
│   │   ├── store/             # 状态管理
│   │   └── utils/             # 工具函数
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── indextts/                  # TTS核心代码
│   ├── BigVGAN/
│   ├── gpt/
│   ├── s2mel/
│   └── utils/
├── checkpoints/                # 模型检查点
├── outputs/                   # 生成的音频文件
├── uploads/                   # 上传的音频文件
├── docs/                      # 文档目录
├── requirements-api.txt         # Python依赖
└── README.md                  # 项目说明
```

## 🐛 故障排除

### 常见问题

**Q: WebSocket连接失败**
- 检查后端服务器是否启动
- 确认端口是否正确（后端8000，前端5173）
- 检查防火墙设置

**Q: 进度显示不更新**
- 查看控制台是否有WebSocket消息接收
- 确认`task_id`字段是否正确传递
- 检查前端WebSocket状态

**Q: 音频生成失败**
- 检查模型文件是否下载完整
- 查看后端日志错误信息
- 确认音频文件权限

**Q: 内存使用过高**
- 限制同时进行的TTS任务数量
- 检查GPU显存使用情况
- 定期清理临时文件

### 日志查看

```bash
# 查看后端日志
tail -f tts_service.log

# 查看特定客户端连接信息
grep "client_" tts_service.log
```

## 🤝 贡献指南

### 开发环境设置

1. Fork本项目到你的GitHub仓库
2. 创建功能分支
3. 进行开发和测试
4. 提交Pull Request

### 代码规范

- 遵循现有代码风格
- 添加适当的注释
- 确保类型安全（TypeScript）
- 编写测试用例

### 提交信息格式

```
feat: 添加新功能描述
fix: 修复某个问题
docs: 更新文档
chore: 代码优化
style: 代码格式调整
```

## 📄 许可证

本项目基于原IndexTTS2项目，遵循其开源许可证。

## 🤝 致谢

- [IndexTTS2](https://github.com/index-tts/index-tts) 原始项目
- 所有贡献者的努力和贡献
- 开源社区的反馈和支持

---

**FightTTS** - 让语音合成更智能、更富于表现力！ 🎙️✨