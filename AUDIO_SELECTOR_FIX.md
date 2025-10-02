# 音频选择器问题诊断与修复

## 问题总结

根据系统分析，发现了以下关键问题：

### 1. **API接口参数传递不匹配** (已修复 ✅)
**问题**: 前端通过URL query参数传递TTS参数，但后端期望通过FormData接收

**原因**:
- 后端运行的是 `api_server_v2.py`，使用 `app/routers/tts.py`
- 后端endpoint定义: `text: str = Form(...), client_id: str = Form(...), ...`
- 前端发送: `POST /api/tts/generate?text=xxx&client_id=xxx&...`

**修复**:
- 修改 `frontend/src/utils/api.ts` 的 `generateTTS` 方法
- 将所有参数从URL query改为FormData body
- 文件位置: `frontend/src/utils/api.ts:92-155`

### 2. **音频文件路径代理配置不完整** (已修复 ✅)
**问题**: 音频样本文件无法通过Vite开发服务器访问

**原因**:
- Vite配置只代理了 `/api` 和 `/ws`
- 音频文件路径 `/audio-samples/*` 没有被代理
- 导致前端无法加载音频预览

**修复**:
- 修改 `frontend/vite.config.ts`
- 添加 `/audio-samples`, `/outputs`, `/uploads` 的代理配置
- 文件位置: `frontend/vite.config.ts:10-44`

### 3. **音频路径格式问题** (已修复 ✅)
**问题**: 开发环境和生产环境的音频URL格式不一致

**原因**:
- AudioScanner硬编码使用 `http://127.0.0.1:8000` 前缀
- 在开发环境应该使用相对路径让Vite代理处理

**修复**:
- 修改 `frontend/src/services/AudioScanner.ts`
- 根据环境变量动态设置路径格式
- 开发环境: `/audio-samples/voice_samples/xxx.mp3`
- 生产环境: `http://127.0.0.1:8000/audio-samples/voice_samples/xxx.mp3`
- 文件位置: `frontend/src/services/AudioScanner.ts:59-87`

### 4. **音频播放器错误处理不足** (已修复 ✅)
**问题**: AudioPlayer加载失败时没有详细的错误信息

**修复**:
- 增强 `frontend/src/components/AudioSelector/AudioPlayer.tsx` 的日志
- 添加详细的错误信息输出
- 文件位置: `frontend/src/components/AudioSelector/AudioPlayer.tsx:148-166`

## 修复的文件列表

1. ✅ `frontend/src/utils/api.ts` - API调用方式修复
2. ✅ `frontend/vite.config.ts` - 代理配置完善
3. ✅ `frontend/src/services/AudioScanner.ts` - 路径格式修复
4. ✅ `frontend/src/components/AudioSelector/AudioPlayer.tsx` - 错误处理增强
5. ✅ `frontend/src/pages/AudioDebugPage.tsx` - 新增调试页面

## 测试步骤

### 1. 重启前端开发服务器
```bash
cd frontend
npm run dev
```

### 2. 访问调试页面
打开浏览器访问: `http://localhost:5173/debug` (需要添加路由)

或者在浏览器控制台测试:
```javascript
// 测试API扫描
fetch('/api/audio-samples/scan')
  .then(r => r.json())
  .then(data => console.log('扫描结果:', data));

// 测试音频文件访问
fetch('/audio-samples/voice_samples/和弦.mp3')
  .then(r => console.log('音频文件状态:', r.status, r.headers.get('Content-Type')));
```

### 3. 测试音频选择和播放
1. 打开主页面
2. 选择音色采样
3. 点击预览按钮
4. 检查浏览器控制台是否有错误
5. 检查音频是否能正常播放

### 4. 测试TTS生成
1. 输入文本
2. 选择音色样本
3. 点击生成按钮
4. 检查是否返回422错误（应该已修复）
5. 检查WebSocket是否收到进度消息

## 预期结果

### 音频预览功能
- ✅ 能够扫描并显示所有音频样本
- ✅ 点击样本能够预览播放
- ✅ 音频波形正常显示
- ✅ 播放控制正常工作

### TTS生成功能
- ✅ 选择音色样本后能正确传递给后端
- ✅ 不再返回422错误
- ✅ WebSocket正常接收进度消息
- ✅ 生成完成后能播放结果

## 常见问题排查

### 问题1: 音频仍然无法播放
**检查项**:
1. 浏览器控制台是否有CORS错误
2. Network标签中音频文件请求的状态码
3. 后端服务器是否正常运行在8000端口
4. Vite开发服务器是否正常运行在5173端口

**解决方案**:
```bash
# 检查后端服务
curl http://127.0.0.1:8000/api/stats

# 检查音频文件
curl http://127.0.0.1:8000/audio-samples/voice_samples/和弦.mp3 -I

# 通过Vite代理检查
curl http://localhost:5173/audio-samples/voice_samples/和弦.mp3 -I
```

### 问题2: TTS生成仍然返回422
**检查项**:
1. 确认前端代码已更新并重新编译
2. 清除浏览器缓存
3. 检查Network标签中的请求payload格式

**验证方法**:
在浏览器控制台查看请求:
```javascript
// 应该看到FormData，而不是URL参数
// Content-Type应该是 multipart/form-data
```

### 问题3: 样本ID传递问题
**检查项**:
1. 选中样本后，store中是否正确保存
2. 生成时是否正确传递 `voiceSampleId`
3. 后端是否能正确解析样本ID

**调试代码**:
```javascript
// 在GenerateButton.tsx中添加
console.log('选中的音色样本:', selectedVoiceSample);
console.log('传递的样本ID:', selectedVoiceSample?.id);
```

## 架构说明

### 音频文件流程
```
1. 后端扫描 audio_samples/ 目录
   ↓
2. 返回样本列表，filePath = "/audio-samples/voice_samples/xxx.mp3"
   ↓
3. 前端接收，根据环境决定是否添加域名前缀
   ↓
4. 开发环境: Vite代理 /audio-samples/* → http://127.0.0.1:8000/audio-samples/*
   ↓
5. AudioPlayer使用filePath加载音频
   ↓
6. WaveSurfer渲染波形并播放
```

### TTS生成流程
```
1. 用户选择音色样本 → store保存 selectedVoiceSample
   ↓
2. 点击生成 → GenerateButton收集参数
   ↓
3. 调用 api.generateTTS()
   ↓
4. 构建FormData，包含:
   - text, client_id, task_id (必需)
   - voice_sample_id (样本ID)
   - 所有TTS参数
   ↓
5. POST /api/tts/generate (FormData body)
   ↓
6. 后端接收 → 解析样本ID → 获取文件路径
   ↓
7. 调用TTS引擎生成
   ↓
8. 通过WebSocket发送进度
   ↓
9. 完成后返回音频URL
```

## 后续优化建议

1. **添加音频缓存**: 避免重复加载相同的音频文件
2. **预加载常用样本**: 提升用户体验
3. **音频格式转换**: 统一使用浏览器兼容性最好的格式
4. **错误重试机制**: 网络不稳定时自动重试
5. **离线支持**: 使用Service Worker缓存音频文件

## 相关文件

### 前端
- `frontend/src/utils/api.ts` - API调用
- `frontend/src/services/AudioScanner.ts` - 音频扫描
- `frontend/src/components/AudioSelector/` - 音频选择器组件
- `frontend/src/components/GenerateButton.tsx` - TTS生成按钮
- `frontend/src/store/ttsStore.ts` - 状态管理
- `frontend/vite.config.ts` - Vite配置

### 后端
- `api_server_v2.py` - 主服务器
- `app/routers/tts.py` - TTS路由
- `app/routers/audio_samples.py` - 音频样本路由
- `app/services/audio_samples_service.py` - 音频样本服务
- `app/services/tts_service.py` - TTS服务

## 联系与支持

如果问题仍然存在，请提供以下信息:
1. 浏览器控制台完整错误日志
2. Network标签中失败请求的详细信息
3. 后端日志 (tts_service.log)
4. 使用的浏览器和版本

