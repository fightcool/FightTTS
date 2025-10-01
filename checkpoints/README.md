# 模型文件目录

此目录需要下载IndexTTS2的预训练模型文件。

## 下载方法

### 方法1：使用HuggingFace CLI
```bash
uv tool install "huggingface-hub[cli,hf_xet]"
hf download IndexTeam/IndexTTS-2 --local-dir=checkpoints
```

### 方法2：使用ModelScope
```bash
uv tool install "modelscope"
modelscope download --model IndexTeam/IndexTTS-2 --local_dir checkpoints
```

## 文件说明

- `gpt.pth` - GPT语言模型权重 (~3.3GB)
- `s2mel.pth` - 语音到频谱模型权重 (~1.2GB)
- `feat1.pt`, `feat2.pt` - 特征提取器权重
- `bpe.model` - BPE编码器模型
- `config.yaml` - 模型配置文件
- `pinyin.vocab` - 拼音词汇表
- `wav2vec2bert_stats.pt` - 音频特征统计文件

## 注意事项

- 这些文件总大小约5GB，请确保有足够的磁盘空间
- 模型文件已被添加到 `.gitignore`，不会被版本控制系统跟踪
- 如果下载缓慢，可以使用镜像源或代理

## 网络加速

在中国大陆地区，可以使用以下镜像加速下载：

```bash
export HF_ENDPOINT="https://hf-mirror.com"
```

## IndexTTS2 项目信息

<div align="center">
  <h3>IndexTTS2: A Breakthrough in Emotionally Expressive and Duration-Controlled Auto-Regressive Zero-Shot Text-to-Speech</h3>
</div>

<div align="center">
  <a href='https://arxiv.org/abs/2506.21619'>
    <img src='https://img.shields.io/badge/ArXiv-2506.21619-red?logo=arxiv'/>
  </a>
  <br/>
  <a href='https://github.com/index-tts/index-tts'>
    <img src='https://img.shields.io/badge/GitHub-Code-orange?logo=github'/>
  </a>
  <a href='https://index-tts.github.io/index-tts2.github.io/'>
    <img src='https://img.shields.io/badge/GitHub-Demo-orange?logo=github'/>
  </a>
  <br/>
  <a href='https://huggingface.co/IndexTeam/IndexTTS-2'>
    <img src='https://img.shields.io/badge/HuggingFace-Model-blue?logo=huggingface' />
  </a>
  <a href='https://modelscope.cn/models/IndexTeam/IndexTTS-2'>
    <img src='https://img.shields.io/badge/ModelScope-Model-purple?logo=modelscope'/>
  </a>
</div>

## 引用

如果您觉得我们的工作有帮助，请为我们点赞并引用论文：

**IndexTTS2**
```
@article{zhou2025indextts2,
  title={IndexTTS2: A Breakthrough in Emotionally Expressive and Duration-Controlled Auto-Regressive Zero-Shot Text-to-Speech},
  author={Siyi Zhou, Yiquan Zhou, Yi He, Xun Zhou, Jinchao Wang, Wei Deng, Jingchen Shu},
  journal={arXiv preprint arXiv:2506.21619},
  year={2025}
}
```

**IndexTTS**
```
@article{deng2025indextts,
  title={IndexTTS: An Industrial-Level Controllable and Efficient Zero-Shot Text-To-Speech System},
  author={Wei Deng, Siyi Zhou, Jingchen Shu, Jinchao Wang, Lu Wang},
  journal={arXiv preprint arXiv:2502.05512},
  year={2025},
  doi={10.48550/arXiv:2502.05512},
  url={https://arxiv.org/abs/2502.05512}
}
```