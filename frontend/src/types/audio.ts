/**
 * 音频文件类型定义
 */

// 音频样本接口
export interface AudioSample {
  id: string;
  name: string;
  category: 'voice' | 'emotion';
  subcategory: string;
  fileName: string;
  filePath: string;
  duration: number;
  description?: string;
  tags: string[];
  created: Date;
  metadata?: {
    sampleRate?: number;
    channels?: number;
    bitrate?: number;
    size: number;
  };
  waveform?: number[]; // WaveSurfer预计算波形数据
}

// 音频配置接口
export interface AudioConfig {
  basePath: string;
  voiceSamplesPath: string;
  emotionSamplesPath: string;
  supportedFormats: string[];
  maxFileSize: number; // 字节数
  enableWaveform: boolean;
  theme: 'light' | 'dark' | 'auto';
  plugins: string[];
}

// 主题接口
export interface Theme {
  name: string;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    backgroundSecondary: string;
    text: string;
    textSecondary: string;
    accent: string;
    accentHover: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    xs: Record<string, string>;
    sm: Record<string, string>;
    md: Record<string, string>;
    lg: Record<string, string>;
    xl: Record<string, string>;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// 音频选择器属性接口
export interface AudioSelectorProps {
  type: 'voice' | 'emotion';
  selectedAudio?: AudioSample | null;
  onAudioSelect: (audio: AudioSample | null) => void;
  onAudioPreview?: (audio: AudioSample) => void;
  onPreviewEnd?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showWaveform?: boolean;
  enableSearch?: boolean;
  enableBatchSelect?: boolean;
  maxSelectCount?: number;
}

// 音频卡片属性接口
export interface AudioCardProps {
  audio: AudioSample;
  isSelected?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onPreview?: () => void;
  onSelect?: () => void;
  disabled?: boolean;
  showWaveform?: boolean;
  theme?: Theme;
  className?: string;
}

// 音频播放器属性接口
export interface AudioPlayerProps {
  audio: AudioSample;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  autoPlay?: boolean;
  showControls?: boolean;
  showWaveform?: boolean;
  height?: number;
  className?: string;
}

// 音频扫描服务接口
export interface AudioScanResult {
  total: number;
  voiceSamples: AudioSample[];
  emotionSamples: AudioSample[];
  errors: string[];
  scanTime: number;
}

// 插件接口
export interface AudioPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  permissions: string[];

  // 插件生命周期
  initialize(config: AudioConfig): Promise<void>;
  destroy(): Promise<void>;

  // 扩展点
  onAudioLoad?(audio: AudioSample): Promise<AudioSample | null>;
  onAudioSelect?(audio: AudioSample): Promise<void>;
  onRenderCard?(audio: AudioSample, defaultElement: JSX.Element): JSX.Element;
  onRenderControls?(audio: AudioSample, defaultControls: JSX.Element): JSX.Element;
  onThemeChange?(theme: Theme): Promise<void>;
}

// 音频选择事件类型
export type AudioEventType =
  | 'select'
  | 'preview_start'
  | 'preview_end'
  | 'play'
  | 'pause'
  | 'stop'
  | 'load_start'
  | 'load_complete'
  | 'error';

// 音频扫描结果接口
export interface AudioScanResult {
  total: number;
  voiceSamples: AudioSample[];
  emotionSamples: AudioSample[];
  errors: string[];
  scanTime: number;
}

// 音频事件接口
export interface AudioEvent {
  type: AudioEventType;
  audio?: AudioSample;
  data?: any;
  timestamp: number;
}