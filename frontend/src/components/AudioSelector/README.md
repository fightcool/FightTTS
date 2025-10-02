# 音频选择系统

这是一个完整、可扩展的音频选择和管理系统，专为IndexTTS项目设计。

## 特性

- 🎵 **完整的音频管理** - 支持音色和情绪采样
- 🔍 **智能扫描** - 自动发现和分类音频文件
- 🎨 **主题系统** - 支持亮色/暗色/自动主题
- 🔌 **插件系统** - 可扩展的插件架构
- 📊 **实时统计** - 音频文件统计和状态监控
- 🎯 **类型安全** - 完整的TypeScript类型定义
- 🔄 **自动刷新** - 支持文件监控和自动更新

## 快速开始

### 基本用法

```tsx
import React from 'react';
import { AudioSelector } from './components/AudioSelector';
import { ThemeProvider } from './components/AudioSelector/theme';

function App() {
  return (
    <ThemeProvider>
      <AudioSelector
        type="voice"
        onAudioSelect={(audio) => console.log('Selected:', audio)}
        placeholder="请选择音色采样"
      />
    </ThemeProvider>
  );
}
```

### 高级用法（使用AudioManager）

```tsx
import React from 'react';
import { useAudioManager } from './hooks';
import { AudioSelector } from './components/AudioSelector';

function AdvancedAudioApp() {
  const {
    voiceSamples,
    emotionSamples,
    selectedVoiceSample,
    selectedEmotionSample,
    selectVoiceSample,
    selectEmotionSample,
    scanAudioFiles
  } = useAudioManager({
    autoInitialize: true,
    enableAutoScan: true,
    autoScanInterval: 60000 // 1分钟自动扫描
  });

  return (
    <div>
      <AudioSelector
        type="voice"
        selectedAudio={selectedVoiceSample}
        onAudioSelect={selectVoiceSample}
      />
      <AudioSelector
        type="emotion"
        selectedAudio={selectedEmotionSample}
        onAudioSelect={selectEmotionSample}
      />
    </div>
  );
}
```

## 核心组件

### AudioSelector

主要的音频选择组件，整合了所有子组件。

```tsx
interface AudioSelectorProps {
  type: 'voice' | 'emotion';           // 音频类型
  selectedAudio?: AudioSample | null;  // 当前选中的音频
  onAudioSelect?: (audio: AudioSample) => void; // 选择回调
  placeholder?: string;                // 占位符文本
  disabled?: boolean;                  // 是否禁用
  className?: string;                  // 自定义类名
  showWaveform?: boolean;              // 是否显示波形
  theme?: Theme;                       // 主题配置
}
```

### AudioPlayer

音频播放器组件，支持WaveSurfer波形可视化。

```tsx
interface AudioPlayerProps {
  audio: AudioSample;                  // 音频数据
  autoPlay?: boolean;                  // 自动播放
  showControls?: boolean;              // 显示控制按钮
  showWaveform?: boolean;              // 显示波形
  height?: number;                     // 波形高度
  onPlay?: () => void;                 // 播放回调
  onPause?: () => void;                // 暂停回调
  onStop?: () => void;                 // 停止回调
  onTimeUpdate?: (current: number, total: number) => void; // 时间更新回调
  theme?: Theme;                       // 主题配置
}
```

### AudioCard

音频卡片组件，用于展示单个音频文件。

```tsx
interface AudioCardProps {
  audio: AudioSample;                  // 音频数据
  isSelected?: boolean;                // 是否选中
  disabled?: boolean;                  // 是否禁用
  showWaveform?: boolean;              // 显示波形
  onSelect?: (audio: AudioSample) => void;  // 选择回调
  onPreview?: (audio: AudioSample) => void; // 预览回调
  theme?: Theme;                       // 主题配置
}
```

### AudioCategorySelector

音频分类选择器，支持快速筛选和搜索。

```tsx
interface AudioCategorySelectorProps {
  type: 'voice' | 'emotion';           // 音频类型
  value?: string;                      // 当前值
  onCategoryChange?: (category: string) => void; // 分类变更回调
  onValueChange?: (value: string) => void;       // 值变更回调
  placeholder?: string;                // 占位符
  disabled?: boolean;                  // 是否禁用
  enableSearch?: boolean;              // 启用搜索
  theme?: Theme;                       // 主题配置
}
```

## Hooks

### useAudioManager

核心音频管理Hook，提供完整的音频管理功能。

```tsx
const {
  // 状态
  isInitialized,
  isScanning,
  voiceSamples,
  emotionSamples,
  selectedVoiceSample,
  selectedEmotionSample,
  error,

  // 音频样本访问
  getAllSamples,
  getSamplesByCategory,
  getSamplesBySubcategory,
  searchSamples,
  getSampleById,

  // 选择操作
  selectVoiceSample,
  selectEmotionSample,
  getSelectedSamples,

  // 扫描操作
  scanAudioFiles,
  refreshCache,

  // 工具方法
  getStats,
  clearError
} = useAudioManager({
  autoInitialize: true,
  enableAutoScan: true,
  autoScanInterval: 60000
});
```

### useVoiceSelector

专门用于音色选择的便捷Hook。

```tsx
const {
  voiceSamples,
  selectedVoiceSample,
  selectVoice,
  searchVoiceSamples
} = useVoiceSelector();
```

### useEmotionSelector

专门用于情绪选择的便捷Hook。

```tsx
const {
  emotionSamples,
  selectedEmotionSample,
  selectEmotion,
  searchEmotionSamples
} = useEmotionSelector();
```

### useTheme

主题管理Hook。

```tsx
const {
  theme,
  mode,
  setMode,
  setTheme,
  isDark,
  toggleTheme
} = useTheme();
```

### useToast

消息通知Hook。

```tsx
const {
  messages,
  toast: {
    success,
    error,
    warning,
    info
  }
} = useToast();
```

## 主题系统

### 内置主题

```tsx
import { lightTheme, darkTheme } from './components/AudioSelector/theme';

// 使用亮色主题
<ThemeProvider theme={lightTheme}>
  <AudioSelector type="voice" />
</ThemeProvider>

// 使用暗色主题
<ThemeProvider theme={darkTheme}>
  <AudioSelector type="voice" />
</ThemeProvider>

// 自动切换（跟随系统）
<ThemeProvider defaultMode="auto">
  <AudioSelector type="voice" />
</ThemeProvider>
```

### 自定义主题

```tsx
const customTheme: Theme = {
  name: 'custom',
  displayName: '自定义主题',
  colors: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    background: '#ffffff',
    // ... 其他颜色配置
  },
  spacing: {
    xs: 4,
    sm: 8,
    // ... 其他间距配置
  },
  // ... 其他配置
};

<ThemeProvider theme={customTheme}>
  <AudioSelector type="voice" />
</ThemeProvider>
```

## 插件系统

### 创建插件

```tsx
import { AudioPlugin } from './components/AudioSelector/plugins';

const myPlugin: AudioPlugin = {
  metadata: {
    id: 'my-plugin',
    name: '我的插件',
    version: '1.0.0',
    description: '自定义音频处理插件'
  },

  async initialize() {
    console.log('插件初始化');
  },

  async destroy() {
    console.log('插件销毁');
  },

  onAudioLoad(audio) {
    // 处理音频加载
    return audio;
  },

  onAudioSelect(audio) {
    // 处理音频选择
    console.log('选中音频:', audio.name);
  }
};

// 注册插件
const pluginManager = audioManager.getPluginManager();
pluginManager.registerPlugin(myPlugin);
```

## 目录结构

```
src/
├── components/
│   └── AudioSelector/
│       ├── AudioSelector.tsx          # 主组件
│       ├── AudioPlayer.tsx            # 播放器组件
│       ├── AudioCard.tsx              # 卡片组件
│       ├── AudioCategorySelector.tsx  # 分类选择器
│       ├── Toast.tsx                  # 消息组件
│       ├── theme/                     # 主题系统
│       │   ├── ThemeManager.tsx
│       │   ├── themes.ts
│       │   └── index.ts
│       ├── plugins/                   # 插件系统
│       │   ├── PluginManager.tsx
│       │   └── index.ts
│       ├── AudioSelectorExample.tsx   # 示例组件
│       └── README.md                  # 文档
├── services/
│   ├── AudioManager.ts                # 音频管理服务
│   └── AudioScanner.ts                # 音频扫描服务
├── hooks/
│   ├── useAudioManager.ts             # 音频管理Hook
│   └── useTheme.ts                    # 主题Hook
└── types/
    └── audio.ts                       # 类型定义
```

## 配置选项

### AudioManager配置

```tsx
const config: AudioManagerConfig = {
  basePath: '/audio-samples',                    // 基础路径
  voiceSamplesPath: '/audio-samples/voice_samples', // 音色文件路径
  emotionSamplesPath: '/audio-samples/emotion_samples', // 情绪文件路径
  supportedFormats: ['.wav', '.mp3', '.flac'],   // 支持的格式
  maxFileSize: 50 * 1024 * 1024,                // 最大文件大小 (50MB)
  enableAutoScan: true,                          // 启用自动扫描
  autoScanInterval: 60000,                       // 扫描间隔 (1分钟)
  enableFileWatcher: true,                       // 启用文件监控
  cacheEnabled: true,                            // 启用缓存
  maxCacheSize: 1000                             // 最大缓存数量
};
```

## API参考

详细的API文档请参考各个组件和Hook的TypeScript接口定义。

## 示例

查看 `AudioSelectorExample.tsx` 文件获取完整的使用示例。

## 故障排除

### 常见问题

1. **音频文件无法加载**
   - 检查文件路径是否正确
   - 确认文件格式被支持
   - 检查文件大小是否超限

2. **波形不显示**
   - 确认已安装WaveSurfer依赖
   - 检查音频文件是否可访问
   - 查看浏览器控制台错误信息

3. **自动扫描不工作**
   - 检查API端点是否可用
   - 确认网络连接正常
   - 查看扫描日志

### 调试模式

```tsx
// 启用调试日志
const audioManager = useAudioManager({
  ...config,
  debug: true
});
```

## 贡献

欢迎提交Issue和Pull Request来改进这个音频选择系统。

## 许可证

MIT License