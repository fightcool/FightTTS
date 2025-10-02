import { AudioConfig, AudioSample, Theme } from '../../../types/audio';

// 插件状态
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
  DISABLED = 'disabled'
}

// 插件元数据
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords: string[];
  dependencies?: string[];
  permissions: PluginPermission[];
}

// 插件权限类型
export enum PluginPermission {
  AUDIO_READ = 'audio:read',
  AUDIO_MODIFY = 'audio:modify',
  AUDIO_DELETE = 'audio:delete',
  THEME_MODIFY = 'theme:modify',
  CONFIG_MODIFY = 'config:modify'
}

// 插件接口
export interface AudioPlugin {
  // 元数据
  readonly metadata: PluginMetadata;

  // 状态
  state: PluginState;
  enabled: boolean;
  config: Record<string, any>;

  // 插件生命周期方法
  initialize(config: AudioConfig): Promise<void>;
  destroy(): Promise<void>;

  // 扩展点方法
  onAudioLoad?(audio: AudioSample): Promise<AudioSample | null>;
  onAudioSelect?(audio: AudioSample): Promise<void>;
  onAudioPreview?(audio: AudioSample): Promise<void>;
  onAudioUnselect?(audio: AudioSample): Promise<void>;
  onThemeChange?(theme: Theme): Promise<void>;

  // UI扩展方法
  renderCard?: (audio: AudioSample, defaultElement: JSX.Element): JSX.Element;
  renderControls?: (audio: AudioSample, defaultControls: JSX.Element): JSX.Element;
  renderPreviewer?: (audio: AudioSample): JSX.Element;
  renderCustomControls?: (audio: AudioSample): JSX.Element;

  // 音频处理方法
  processAudioFile?(file: File): Promise<File | null>;
  extractMetadata?(file: File): Promise<Partial<AudioSample>>;
  enhanceAudio?(audioData: ArrayBuffer): Promise<ArrayBuffer>;

  // 配置方法
  getConfigSchema?(): any;
  validateConfig?(config: Record<string, any>): boolean;
  updateConfig?(updates: Record<string, any>): void;
}

// 插件错误类型
export class PluginError extends Error {
  constructor(
    message: string,
    public pluginId: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
    this.pluginId = pluginId;
    this.code = code;
    this.details = details;
  }
}

// 插件接口验证
export function isValidPlugin(obj: any): obj is AudioPlugin {
  return (
    obj &&
    typeof obj.metadata === 'object' &&
    typeof obj.state === 'string' &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.initialize === 'function' &&
    typeof obj.destroy === 'function'
  );
}

// 插件工厂类型
export type PluginFactory = () => AudioPlugin;

// 插件注册信息
export interface PluginRegistration {
  plugin: AudioPlugin;
  factory?: PluginFactory;
  autoLoad?: boolean;
}

// 插件事件类型
export interface PluginEvent {
  type: 'plugin-loaded' | 'plugin-unloaded' | 'plugin-error' | 'plugin-enabled' | 'plugin-disabled';
  pluginId: string;
  error?: PluginError;
  data?: any;
  timestamp: number;
}