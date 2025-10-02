import { AudioSample, AudioConfig, AudioScanResult } from '../types/audio';

export interface AudioScannerConfig {
  basePath: string;
  voiceSamplesPath: string;
  emotionSamplesPath: string;
  supportedFormats: string[];
  maxFileSize: number;
}

export class AudioScanner {
  private config: AudioScannerConfig;
  private audioCache: Map<string, AudioSample> = new Map();
  private isInitialized: boolean = false;
  private scanningInProgress: boolean = false;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  // 初始化扫描服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔍 初始化音频扫描服务...');
    this.isInitialized = true;

    // 执行初始扫描
    await this.scanAllAudioFiles();
  }

  // 执行完整音频扫描
  async scanAllAudioFiles(): Promise<AudioScanResult> {
    if (this.scanningInProgress) {
      throw new Error('扫描正在进行中，请稍后再试');
    }

    this.scanningInProgress = true;
    const startTime = Date.now();

    try {
      // 使用新的API端点扫描音频样本
      const response = await fetch('http://127.0.0.1:8000/api/audio-samples/scan');

      if (!response.ok) {
        console.warn(`无法访问音频扫描API: ${response.status}`);
        return {
          total: 0,
          voiceSamples: [],
          emotionSamples: [],
          errors: [`API请求失败: ${response.status}`],
          scanTime: Date.now() - startTime
        };
      }

      const scanResult = await response.json();
      console.log('扫描结果:', scanResult);

      const voiceSamples: AudioSample[] = (scanResult.voice_samples || []).map((sample: any) => ({
        id: sample.id,
        name: sample.name,
        category: 'voice' as const,
        subcategory: sample.subcategory,
        fileName: sample.fileName,
        // 在开发环境使用相对路径，让Vite代理处理；生产环境使用完整URL
        filePath: import.meta.env.DEV ? sample.filePath : `http://127.0.0.1:8000${sample.filePath}`,
        duration: sample.duration || 0,
        description: sample.description,
        tags: sample.tags || [],
        created: new Date(sample.metadata?.created || Date.now()),
        metadata: sample.metadata
      }));

      const emotionSamples: AudioSample[] = (scanResult.emotion_samples || []).map((sample: any) => ({
        id: sample.id,
        name: sample.name,
        category: 'emotion' as const,
        subcategory: sample.subcategory,
        fileName: sample.fileName,
        // 在开发环境使用相对路径，让Vite代理处理；生产环境使用完整URL
        filePath: import.meta.env.DEV ? sample.filePath : `http://127.0.0.1:8000${sample.filePath}`,
        duration: sample.duration || 0,
        description: sample.description,
        tags: sample.tags || [],
        created: new Date(sample.metadata?.created || Date.now()),
        metadata: sample.metadata
      }));

      const totalTime = Date.now() - startTime;
      const total = voiceSamples.length + emotionSamples.length;

      console.log(`🎉 音频扫描完成，共发现 ${total} 个音频文件，耗时 ${totalTime}ms`);

      const result: AudioScanResult = {
        total,
        voiceSamples,
        emotionSamples,
        errors: [],
        scanTime: totalTime
      };

      // 清理旧的缓存
      this.cleanupOldCache();

      // 更新缓存
      this.updateAudioCache(voiceSamples);
      this.updateAudioCache(emotionSamples);

      return result;

    } catch (error) {
      console.error('音频扫描失败:', error);
      return {
        total: 0,
        voiceSamples: [],
        emotionSamples: [],
        errors: [error instanceof Error ? error.message : '扫描失败'],
        scanTime: Date.now() - startTime
      };
    } finally {
      this.scanningInProgress = false;
    }
  }



  // 更新音频缓存
  private updateAudioCache(audioSamples: AudioSample[]): void {
    audioSamples.forEach(audio => {
      this.audioCache.set(audio.id, audio);
    });
  }

  // 清理旧的缓存
  private cleanupOldCache(): void {
    // 检查缓存中的文件是否仍然存在
    const cachedIds = Array.from(this.audioCache.keys());

    cachedIds.forEach(id => {
      const audio = this.audioCache.get(id);
      if (audio && !audio.filePath) {
        console.warn(`清理无效的音频缓存: ${audio.id}`);
        this.audioCache.delete(id);
      }
    });
  }

  // 获取所有音频
  getAllAudioSamples(): AudioSample[] {
    return Array.from(this.audioCache.values());
  }

  // 按分类获取音频
  getAudioSamplesByCategory(category: 'voice' | 'emotion'): AudioSample[] {
    return Array.from(this.audioCache.values()).filter(audio => audio.category === category);
  }

  // 按ID获取音频
  getAudioById(id: string): AudioSample | undefined {
    return this.audioCache.get(id);
  }

  // 清除缓存
  clearCache(): void {
    this.audioCache.clear();
  }

  // 刷新扫描
  async refreshCache(): Promise<AudioScanResult> {
    this.clearCache();
    return this.scanAllAudioFiles();
  }
}