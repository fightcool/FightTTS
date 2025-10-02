import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioSample, AudioManagerConfig, AudioManagerState } from '../types/audio';
import { AudioManager, getDefaultAudioManager } from '../services/AudioManager';

export interface UseAudioManagerOptions extends Partial<AudioManagerConfig> {
  autoInitialize?: boolean;
}

export interface UseAudioManagerReturn extends AudioManagerState {
  // 音频样本访问
  getAllSamples: () => AudioSample[];
  getSamplesByCategory: (category: 'voice' | 'emotion') => AudioSample[];
  getSamplesBySubcategory: (category: 'voice' | 'emotion', subcategory: string) => AudioSample[];
  searchSamples: (query: string, category?: 'voice' | 'emotion') => AudioSample[];
  getSampleById: (id: string) => AudioSample | undefined;

  // 选择操作
  selectVoiceSample: (sample: AudioSample | null) => void;
  selectEmotionSample: (sample: AudioSample | null) => void;
  getSelectedSamples: () => { voice: AudioSample | null; emotion: AudioSample | null };

  // 扫描操作
  scanAudioFiles: () => Promise<void>;
  refreshCache: () => Promise<void>;

  // 工具方法
  getStats: () => {
    totalSamples: number;
    voiceSamples: number;
    emotionSamples: number;
    lastScanTime: Date | null;
    selectedVoice: string | null;
    selectedEmotion: string | null;
  };

  // 错误处理
  clearError: () => void;
}

export const useAudioManager = (options: UseAudioManagerOptions = {}): UseAudioManagerReturn => {
  const {
    autoInitialize = true,
    ...config
  } = options;

  const managerRef = useRef<AudioManager | null>(null);
  const [state, setState] = useState<AudioManagerState>({
    isInitialized: false,
    isScanning: false,
    voiceSamples: [],
    emotionSamples: [],
    selectedVoiceSample: null,
    selectedEmotionSample: null,
    error: null,
    lastScanTime: null
  });

  // 初始化管理器
  const initializeManager = useCallback(async () => {
    if (!managerRef.current) {
      managerRef.current = getDefaultAudioManager(config);
    }

    const manager = managerRef.current;

    try {
      if (!manager.getState().isInitialized) {
        await manager.initialize();
      }

      // 订阅状态变化
      const unsubscribe = manager.subscribe(setState);

      return unsubscribe;
    } catch (error) {
      console.error('AudioManager初始化失败:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '初始化失败'
      }));
    }
  }, [config]);

  // 组件挂载时初始化
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (autoInitialize) {
      initializeManager().then(unsub => {
        unsubscribe = unsub;
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [autoInitialize, initializeManager]);

  // 音频样本访问方法
  const getAllSamples = useCallback(() => {
    return managerRef.current?.getAllSamples() || [];
  }, []);

  const getSamplesByCategory = useCallback((category: 'voice' | 'emotion') => {
    return managerRef.current?.getSamplesByCategory(category) || [];
  }, []);

  const getSamplesBySubcategory = useCallback((category: 'voice' | 'emotion', subcategory: string) => {
    return managerRef.current?.getSamplesBySubcategory(category, subcategory) || [];
  }, []);

  const searchSamples = useCallback((query: string, category?: 'voice' | 'emotion') => {
    return managerRef.current?.searchSamples(query, category) || [];
  }, []);

  const getSampleById = useCallback((id: string) => {
    return managerRef.current?.getSampleById(id);
  }, []);

  // 选择操作方法
  const selectVoiceSample = useCallback((sample: AudioSample | null) => {
    managerRef.current?.selectVoiceSample(sample);
  }, []);

  const selectEmotionSample = useCallback((sample: AudioSample | null) => {
    managerRef.current?.selectEmotionSample(sample);
  }, []);

  const getSelectedSamples = useCallback(() => {
    return managerRef.current?.getSelectedSamples() || { voice: null, emotion: null };
  }, []);

  // 扫描操作方法
  const scanAudioFiles = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('AudioManager未初始化');
    }
    await managerRef.current.scanAudioFiles();
  }, []);

  const refreshCache = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('AudioManager未初始化');
    }
    await managerRef.current.refreshCache();
  }, []);

  // 工具方法
  const getStats = useCallback(() => {
    return managerRef.current?.getStats() || {
      totalSamples: 0,
      voiceSamples: 0,
      emotionSamples: 0,
      lastScanTime: null,
      selectedVoice: null,
      selectedEmotion: null
    };
  }, []);

  // 错误处理
  const clearError = useCallback(() => {
    managerRef.current?.getState().error && setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // 状态
    ...state,

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

    // 错误处理
    clearError
  };
};

// 便捷Hook：专门用于音色选择
export const useVoiceSelector = () => {
  const {
    voiceSamples,
    selectedVoiceSample,
    selectVoiceSample,
    searchSamples,
    ...rest
  } = useAudioManager();

  const selectVoice = useCallback((sample: AudioSample | null) => {
    selectVoiceSample(sample);
  }, [selectVoiceSample]);

  const searchVoiceSamples = useCallback((query: string) => {
    return searchSamples(query, 'voice');
  }, [searchSamples]);

  return {
    // 音色相关状态
    voiceSamples,
    selectedVoiceSample,

    // 音色相关操作
    selectVoice,
    searchVoiceSamples,

    // 其他状态和方法
    ...rest
  };
};

// 便捷Hook：专门用于情绪选择
export const useEmotionSelector = () => {
  const {
    emotionSamples,
    selectedEmotionSample,
    selectEmotionSample,
    searchSamples,
    ...rest
  } = useAudioManager();

  const selectEmotion = useCallback((sample: AudioSample | null) => {
    selectEmotionSample(sample);
  }, [selectEmotionSample]);

  const searchEmotionSamples = useCallback((query: string) => {
    return searchSamples(query, 'emotion');
  }, [searchSamples]);

  return {
    // 情绪相关状态
    emotionSamples,
    selectedEmotionSample,

    // 情绪相关操作
    selectEmotion,
    searchEmotionSamples,

    // 其他状态和方法
    ...rest
  };
};

// 便捷Hook：用于音频统计信息
export const useAudioStats = () => {
  const { getStats, voiceSamples, emotionSamples, lastScanTime } = useAudioManager();

  const [stats, setStats] = useState(() => getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats());
    }, 1000); // 每秒更新一次统计

    return () => clearInterval(interval);
  }, [getStats]);

  return {
    stats,
    voiceSamples,
    emotionSamples,
    lastScanTime,
    refreshStats: () => setStats(getStats())
  };
};