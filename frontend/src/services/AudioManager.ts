import { AudioSample, AudioConfig, AudioScanResult } from '../types/audio';
import { AudioScanner } from './AudioScanner';
import { AudioPluginManager } from '../components/AudioSelector/plugins/PluginManager';

export interface AudioManagerConfig extends AudioConfig {
  enableAutoScan?: boolean;
  autoScanInterval?: number;
  enableFileWatcher?: boolean;
  cacheEnabled?: boolean;
  maxCacheSize?: number;
}

export interface AudioManagerState {
  isInitialized: boolean;
  isScanning: boolean;
  voiceSamples: AudioSample[];
  emotionSamples: AudioSample[];
  selectedVoiceSample: AudioSample | null;
  selectedEmotionSample: AudioSample | null;
  error: string | null;
  lastScanTime: Date | null;
}

export class AudioManager {
  private config: AudioManagerConfig;
  private scanner: AudioScanner;
  private pluginManager: AudioPluginManager;
  private state: AudioManagerState;
  private listeners: Set<(state: AudioManagerState) => void> = new Set();
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(config: AudioManagerConfig) {
    this.config = {
      enableAutoScan: true,
      autoScanInterval: 60000, // 1分钟
      enableFileWatcher: true,
      cacheEnabled: true,
      maxCacheSize: 1000,
      ...config
    };

    this.scanner = new AudioScanner(config);
    this.pluginManager = new AudioPluginManager();

    this.state = {
      isInitialized: false,
      isScanning: false,
      voiceSamples: [],
      emotionSamples: [],
      selectedVoiceSample: null,
      selectedEmotionSample: null,
      error: null,
      lastScanTime: null
    };
  }

  // 初始化AudioManager
  async initialize(): Promise<void> {
    try {
      console.log('🎵 初始化AudioManager...');

      // 初始化扫描器
      await this.scanner.initialize();

      // 执行初始扫描
      await this.scanAudioFiles();

      // 启动自动扫描
      if (this.config.enableAutoScan) {
        this.startAutoScan();
      }

      // 启动插件系统
      await this.pluginManager.initialize();

      this.state.isInitialized = true;
      this.notifyListeners();

      console.log('✅ AudioManager初始化完成');

    } catch (error) {
      console.error('❌ AudioManager初始化失败:', error);
      this.state.error = error instanceof Error ? error.message : '初始化失败';
      this.notifyListeners();
      throw error;
    }
  }

  // 扫描音频文件
  async scanAudioFiles(): Promise<AudioScanResult> {
    if (this.state.isScanning) {
      throw new Error('扫描正在进行中，请稍后再试');
    }

    this.state.isScanning = true;
    this.state.error = null;
    this.notifyListeners();

    try {
      const result = await this.scanner.scanAllAudioFiles();

      // 更新状态
      this.state.voiceSamples = result.voiceSamples;
      this.state.emotionSamples = result.emotionSamples;
      this.state.lastScanTime = new Date();
      this.state.isScanning = false;

      // 触发插件事件
      this.pluginManager.emit('audio:scan-complete', result);

      this.notifyListeners();

      console.log(`🎉 音频扫描完成: ${result.total} 个文件`);
      return result;

    } catch (error) {
      this.state.isScanning = false;
      this.state.error = error instanceof Error ? error.message : '扫描失败';
      this.notifyListeners();
      throw error;
    }
  }

  // 刷新音频缓存
  async refreshCache(): Promise<AudioScanResult> {
    console.log('🔄 刷新音频缓存...');
    return this.scanAudioFiles();
  }

  // 获取所有音频样本
  getAllSamples(): AudioSample[] {
    return [...this.state.voiceSamples, ...this.state.emotionSamples];
  }

  // 按类别获取音频样本
  getSamplesByCategory(category: 'voice' | 'emotion'): AudioSample[] {
    return category === 'voice' ? this.state.voiceSamples : this.state.emotionSamples;
  }

  // 按子类别获取音频样本
  getSamplesBySubcategory(category: 'voice' | 'emotion', subcategory: string): AudioSample[] {
    const samples = this.getSamplesByCategory(category);
    return samples.filter(sample => sample.subcategory === subcategory);
  }

  // 搜索音频样本
  searchSamples(query: string, category?: 'voice' | 'emotion'): AudioSample[] {
    let samples = this.getAllSamples();

    if (category) {
      samples = this.getSamplesByCategory(category);
    }

    const lowerQuery = query.toLowerCase();
    return samples.filter(sample =>
      sample.name.toLowerCase().includes(lowerQuery) ||
      sample.description?.toLowerCase().includes(lowerQuery) ||
      sample.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // 选择音色样本
  selectVoiceSample(sample: AudioSample | null): void {
    this.state.selectedVoiceSample = sample;
    this.pluginManager.emit('audio:voice-selected', sample);
    this.notifyListeners();
  }

  // 选择情绪样本
  selectEmotionSample(sample: AudioSample | null): void {
    this.state.selectedEmotionSample = sample;
    this.pluginManager.emit('audio:emotion-selected', sample);
    this.notifyListeners();
  }

  // 获取选中的样本
  getSelectedSamples(): {
    voice: AudioSample | null;
    emotion: AudioSample | null;
  } {
    return {
      voice: this.state.selectedVoiceSample,
      emotion: this.state.selectedEmotionSample
    };
  }

  // 按ID获取音频样本
  getSampleById(id: string): AudioSample | undefined {
    return this.getAllSamples().find(sample => sample.id === id);
  }

  // 启动自动扫描
  private startAutoScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    this.scanInterval = setInterval(() => {
      if (!this.state.isScanning) {
        this.scanAudioFiles().catch(error => {
          console.error('自动扫描失败:', error);
        });
      }
    }, this.config.autoScanInterval);

    console.log(`🔄 启动自动扫描，间隔: ${this.config.autoScanInterval}ms`);
  }

  // 停止自动扫描
  stopAutoScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('⏹️ 停止自动扫描');
    }
  }

  // 注册状态监听器
  subscribe(listener: (state: AudioManagerState) => void): () => void {
    this.listeners.add(listener);

    // 立即调用一次，提供当前状态
    listener(this.getState());

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 通知所有监听器
  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('状态监听器错误:', error);
      }
    });
  }

  // 获取当前状态（返回副本以避免外部修改）
  getState(): AudioManagerState {
    return { ...this.state };
  }

  // 获取插件管理器
  getPluginManager(): AudioPluginManager {
    return this.pluginManager;
  }

  // 清理资源
  destroy(): void {
    console.log('🧹 清理AudioManager资源...');

    // 停止自动扫描
    this.stopAutoScan();

    // 清理监听器
    this.listeners.clear();

    // 销毁插件管理器
    this.pluginManager.destroy();

    // 重置状态
    this.state.isInitialized = false;

    console.log('✅ AudioManager清理完成');
  }

  // 获取统计信息
  getStats(): {
    totalSamples: number;
    voiceSamples: number;
    emotionSamples: number;
    lastScanTime: Date | null;
    selectedVoice: string | null;
    selectedEmotion: string | null;
  } {
    return {
      totalSamples: this.getAllSamples().length,
      voiceSamples: this.state.voiceSamples.length,
      emotionSamples: this.state.emotionSamples.length,
      lastScanTime: this.state.lastScanTime,
      selectedVoice: this.state.selectedVoiceSample?.name || null,
      selectedEmotion: this.state.selectedEmotionSample?.name || null
    };
  }

  // 导出音频数据
  exportAudioData(): {
    voiceSamples: AudioSample[];
    emotionSamples: AudioSample[];
    exportTime: Date;
  } {
    return {
      voiceSamples: [...this.state.voiceSamples],
      emotionSamples: [...this.state.emotionSamples],
      exportTime: new Date()
    };
  }

  // 导入音频数据
  async importAudioData(data: {
    voiceSamples: AudioSample[];
    emotionSamples: AudioSample[];
  }): Promise<void> {
    try {
      // 验证数据
      this.validateAudioData(data);

      // 更新状态
      this.state.voiceSamples = data.voiceSamples;
      this.state.emotionSamples = data.emotionSamples;

      // 触发插件事件
      this.pluginManager.emit('audio:data-imported', data);

      this.notifyListeners();
      console.log('✅ 音频数据导入完成');

    } catch (error) {
      console.error('❌ 音频数据导入失败:', error);
      throw error;
    }
  }

  // 验证音频数据
  private validateAudioData(data: {
    voiceSamples: AudioSample[];
    emotionSamples: AudioSample[];
  }): void {
    const validateSamples = (samples: AudioSample[], category: string) => {
      samples.forEach((sample, index) => {
        if (!sample.id || !sample.name || !sample.category) {
          throw new Error(`${category}样本[${index}]缺少必要字段`);
        }
        if (sample.category !== category) {
          throw new Error(`${category}样本[${index}]类别不匹配`);
        }
      });
    };

    validateSamples(data.voiceSamples, 'voice');
    validateSamples(data.emotionSamples, 'emotion');
  }
}

// 默认AudioManager实例
let defaultManager: AudioManager | null = null;

export const getDefaultAudioManager = (config?: Partial<AudioManagerConfig>): AudioManager => {
  if (!defaultManager) {
    const defaultConfig: AudioManagerConfig = {
      basePath: '/audio-samples',
      voiceSamplesPath: '/audio-samples/voice_samples',
      emotionSamplesPath: '/audio-samples/emotion_samples',
      supportedFormats: ['.wav', '.mp3', '.m4a', '.flac', '.ogg'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      enableAutoScan: true,
      autoScanInterval: 60000,
      enableFileWatcher: true,
      cacheEnabled: true,
      maxCacheSize: 1000,
      ...config
    };

    defaultManager = new AudioManager(defaultConfig);
  }

  return defaultManager;
};

export const destroyDefaultAudioManager = (): void => {
  if (defaultManager) {
    defaultManager.destroy();
    defaultManager = null;
  }
};