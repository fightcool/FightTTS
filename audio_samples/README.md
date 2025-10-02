# 音频样本库

这是IndexTTS音频选择系统的样本库目录。

## 目录结构

```
audio_samples/
├── voice_samples/     # 音色样本
│   ├── male_*.wav     # 男性音色
│   ├── female_*.wav   # 女性音色
│   ├── child_*.wav    # 儿童音色
│   ├── old_*.wav      # 老年音色
│   └── neutral_*.wav  # 中性音色
└── emotion_samples/   # 情绪样本
    ├── happy_*.wav    # 快乐情绪
    ├── sad_*.wav      # 悲伤情绪
    ├── angry_*.wav    # 愤怒情绪
    └── peaceful_*.wav # 平静情绪
```

## 如何添加音频文件

### 方法1: 通过Web界面上传（推荐）

1. 打开IndexTTS Web界面
2. 在音色或情绪选择区域，点击"上传"按钮
3. 选择音频文件并输入名称
4. 系统会自动分类并保存到相应目录

### 方法2: 手动添加文件

1. **选择文件类型**：
   - 音色文件放入 `voice_samples/` 目录
   - 情绪文件放入 `emotion_samples/` 目录

2. **文件命名**：
   - 音色：`{subcategory}_{description}.wav`
   - 情绪：`{emotion}_{description}.wav`
   - 例如：`male_adult_01.wav`, `happy_cheerful_01.wav`

3. **音频要求**：
   - 格式：WAV、MP3、M4A、FLAC、OGG
   - 采样率：44.1kHz+
   - 时长：5-30秒（音色）、3-15秒（情绪）
   - 质量：清晰、无噪音

## 自动扫描系统

- 系统会定期扫描这些目录
- 根据文件名自动分类
- 支持热更新（新增文件会自动被发现）
- 提供音频预览和选择功能

## 推荐样本数量

- **音色样本**：每个子分类 3-5 个
- **情绪样本**：每种情绪 2-3 个
- **总数建议**：20-40 个样本

## 质量标准

### 1. 录音质量
- 使用专业录音设备
- 环境安静，无回声
- 声音清晰，无失真

### 2. 内容要求
- 音色：朗读标准文本，展现声音特色
- 情绪：表达相应情绪，自然不做作
- 长度适中，包含完整的语音片段

### 3. 格式标准
- WAV格式（无损）
- 44.1kHz采样率
- 16-bit或更高比特深度
- 单声道或立体声

## 文件命名规范

### 音色样本命名
- `male_adult_01.wav` - 成年男性音色1
- `female_young_01.wav` - 年轻女性音色1
- `child_boy_01.wav` - 男童音色1
- `old_male_01.wav` - 老年男性音色1
- `neutral_01.wav` - 中性音色1

### 情绪样本命名
- `happy_excited_01.wav` - 兴奋快乐
- `sad_crying_01.wav` - 悲伤哭泣
- `angry_furious_01.wav` - 愤怒暴怒
- `peaceful_calm_01.wav` - 平静放松

## 样本管理

### 通过API管理

系统提供以下API端点：

- `GET /api/audio-samples/scan` - 扫描所有音频样本
- `POST /api/audio-samples/upload` - 上传新样本
- `PUT /api/audio-samples/{id}` - 重命名样本
- `DELETE /api/audio-samples/{id}` - 删除样本

### 通过Web界面管理

在音频选择器中，每个样本都有管理选项：
- 预览播放
- 重命名
- 删除
- 查看详细信息

## 版权说明

- 请确保您有权使用所有音频文件
- 推荐使用原创录音或免版权音频
- 避免使用受版权保护的内容
- 如需商业使用，请获得相应授权

## 维护建议

- 定期检查音频文件质量
- 清理损坏或不合适的文件
- 根据用户反馈调整样本库
- 备份重要的音频文件

## 技术支持

如遇到问题，请检查：
1. 文件命名是否符合规范
2. 音频格式是否受支持
3. 文件是否损坏
4. 目录权限是否正确

更多信息请参考各子目录的README文件。

## 示例样本

项目提供了一些示例样本供测试使用，位于：
- `frontend/public/audio-samples/voice_samples/`
- `frontend/public/audio-samples/emotion_samples/`

这些样本可以作为参考，了解合适的音频质量和格式。

