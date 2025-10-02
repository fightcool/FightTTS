import React, { useState, useEffect, useCallback } from 'react';
import { Search, Play, Pause, RefreshCw } from 'lucide-react';
import { AudioSample } from '../../types/audio';
import { api } from '../../utils/api';

interface AudioCategorySelectorProps {
  type: 'voice' | 'emotion';
  value?: string;
  onCategoryChange?: (sample: AudioSample) => void;
  placeholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
}

export const AudioCategorySelector: React.FC<AudioCategorySelectorProps> = ({
  type,
  value,
  onCategoryChange,
  placeholder = '选择音频样本',
  disabled = false,
  showSearch = true
}) => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // 加载音频样本
  const loadSamples = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    try {
      const result = await api.scanAudioSamples();
      const allSamples = type === 'voice' ? result.voice_samples : result.emotion_samples;
      setSamples(allSamples);
    } catch (err) {
      console.error('加载音频样本失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsScanning(false);
    }
  }, [type]);

  // 组件挂载时加载样本
  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 获取子分类列表
  const subcategories = React.useMemo(() => {
    const subcats = new Set<string>();
    samples.forEach((sample: AudioSample) => subcats.add(sample.subcategory));
    return ['all', ...Array.from(subcats)];
  }, [samples]);

  // 过滤样本
  const filteredSamples = React.useMemo(() => {
    let filtered = samples;

    // 按子分类过滤
    if (selectedSubcategory !== 'all') {
      filtered = filtered.filter((s: AudioSample) => s.subcategory === selectedSubcategory);
    }

    // 按搜索关键词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s: AudioSample) =>
        s.name.toLowerCase().includes(query) ||
        s.fileName.toLowerCase().includes(query) ||
        s.subcategory.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [samples, selectedSubcategory, searchQuery]);

  // 处理样本选择
  const handleSampleSelect = useCallback((sample: AudioSample) => {
    onCategoryChange?.(sample);
  }, [onCategoryChange]);

  // 处理音频播放
  const handlePlay = useCallback((sample: AudioSample) => {
    // 如果正在播放同一个音频，则停止
    if (playingId === sample.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
      return;
    }

    // 停止之前的音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 创建新的音频元素
    const audio = new Audio(sample.filePath);
    audioRef.current = audio;

    console.log('🎵 播放音频:', sample.name, '路径:', sample.filePath);

    // 设置事件监听
    audio.addEventListener('ended', () => {
      setPlayingId(null);
      console.log('✅ 音频播放结束');
    });

    audio.addEventListener('error', (e) => {
      console.error('❌ 音频播放错误:', e);
      console.error('音频路径:', sample.filePath);
      setPlayingId(null);
      setError(`播放失败: ${sample.name}`);
    });

    // 播放音频
    audio.play()
      .then(() => {
        setPlayingId(sample.id);
        console.log('✅ 开始播放:', sample.name);
      })
      .catch((err) => {
        console.error('❌ 播放失败:', err);
        setPlayingId(null);
        setError(`播放失败: ${err.message}`);
      });
  }, [playingId]);

  // 刷新样本列表
  const handleRefresh = useCallback(async () => {
    await loadSamples();
  }, [loadSamples]);

  // 子分类显示名称映射
  const subcategoryNames: Record<string, string> = {
    all: '全部',
    male: '男性',
    female: '女性',
    child: '儿童',
    old: '老年',
    neutral: '中性',
    happy: '快乐',
    sad: '悲伤',
    angry: '愤怒',
    peaceful: '平静'
  };

  return (
    <div className="audio-category-selector w-full space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        {showSearch && (
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-secondary-100"
            />
          </div>
        )}

        <button
          onClick={handleRefresh}
          disabled={isScanning || disabled}
          className="ml-2 p-2 text-secondary-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
          title="刷新列表"
        >
          <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 子分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {subcategories.map((subcat) => (
          <button
            key={subcat}
            onClick={() => setSelectedSubcategory(subcat)}
            disabled={disabled}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedSubcategory === subcat
                ? 'bg-primary-600 text-white'
                : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
            } disabled:opacity-50`}
          >
            {subcategoryNames[subcat] || subcat}
          </button>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 样本列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isScanning ? (
          <div className="text-center py-8 text-secondary-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>正在扫描音频样本...</p>
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="text-center py-8 text-secondary-500">
            <p>暂无音频样本</p>
            <p className="text-xs mt-1">请上传音频文件或刷新列表</p>
          </div>
        ) : (
          filteredSamples.map((sample: AudioSample) => (
            <div
              key={sample.id}
              onClick={() => handleSampleSelect(sample)}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                value === sample.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-secondary-200 hover:border-primary-300 hover:bg-secondary-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* 播放按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(sample);
                    }}
                    className="p-2 rounded-full hover:bg-primary-100 transition-colors"
                    title={playingId === sample.id ? '停止播放' : '播放预览'}
                  >
                    {playingId === sample.id ? (
                      <Pause className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Play className="w-4 h-4 text-primary-600" />
                    )}
                  </button>

                  {/* 样本信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-secondary-900 truncate">
                      {sample.name}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-secondary-500 mt-1">
                      <span className="px-2 py-0.5 bg-secondary-100 rounded">
                        {subcategoryNames[sample.subcategory] || sample.subcategory}
                      </span>
                      {sample.duration > 0 && (
                        <span>{sample.duration.toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 统计信息 */}
      <div className="text-xs text-secondary-500 text-center">
        共 {filteredSamples.length} 个样本
        {searchQuery && ` (搜索: "${searchQuery}")`}
      </div>
    </div>
  );
};

export default AudioCategorySelector;