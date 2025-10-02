import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, Download, Info, AlertCircle } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { AudioSample, AudioCardProps } from '../types/audio';
import { useTheme } from '../theme';

export const AudioCard: React.FC<AudioCardProps> = ({
  audio,
  isSelected = false,
  onPlay,
  onPause,
  onStop,
  onPreview,
  onSelect,
  disabled = false,
  showWaveform = true,
  theme
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [waveformReady, setWaveformReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waveformRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // 初始化WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    if (!showWaveform) {
      setWaveformReady(true);
      return;
    }

    const wavesurferConfig = {
      container: containerRef.current,
      waveColor: theme.colors.secondary,
      progressColor: theme.colors.primary,
      height: 60,
      normalize: true,
      backend: 'WebAudio',
      mediaControls: false,
      interact: true,
      cursorColor: theme.colors.primary,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 1
    };

    wavesurfer.current = WaveSurfer.create(wavesurferConfig);

    // 事件监听
    wavesurfer.current.on('ready', () => {
      setWaveformReady(true);
      setDuration(wavesurfer.current?.getDuration() || 0);
      setWaveformReady(true);
      setIsLoading(false);
      setError(null);
    });

    wavesurfer.current.on('play', () => {
      setIsPlaying(true);
      onPlay?.();
    });

    wavesurfer.current.on('pause', () => {
      setIsPlaying(false);
      onPause?.();
    });

    wavesurfer.current.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onStop?.();
    });

    wavesurfer.current.on('audioprocess', () => {
      setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
    });

    wavesurfer.current.on('error', (error) => {
      console.error('WaveSurfer error:', error);
      setError('音频播放失败');
      setIsLoading(false);
      setIsPlaying(false);
    });

    return () => {
      wavesurfer.current?.destroy();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [showWaveform, theme, containerRef.current?.clientHeight]);

  // 加载音频
  useEffect(() => {
    if (!audio || !wavesurfer.current || !waveformReady) return;

    loadAudio();
  }, [audio, waveformReady, wavesurfer.current]);

  // 清理
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // 播放控制
  const togglePlayPause = useCallback(() => {
    if (!wavesurfer.current || isLoading) return;

    try {
      if (isPlaying) {
        wavesurfer.current.pause();
      } else {
        wavesurfer.current.play();
      }
    } catch (error) {
      console.error('播放控制错误:', error);
      setIsPlaying(false);
    }
  }, [isPlaying, isLoading, wavesurfer.current]);

  // 音量控制
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    wavesurfer.current?.setVolume(newVolume);
  }, []);

  // 加载音频文件
  const loadAudio = useCallback(async () => {
    if (!wavesurfer.current || !audio) return;

    setIsLoading(true);
    setError(null);

    try {
      // 清理之前的blob URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      // 如果有预计算的波形数据，直接使用
      if (audio.waveform) {
        const peaks = new Int16Array(audio.waveform);
        const buffer = new ArrayBuffer(peaks.buffer.byteLength * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < peaks.length; i++) {
          view.setInt16(i * 2, peaks[i]);
          view.setInt16(i * 2 + 1, peaks[i] < 0 ? -32768 : 32767);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        objectUrlRef.current = url;

        await wavesurfer.current.load(url);
        console.log(`使用预计算波形数据: ${audio.waveform.length} points`);
      } else {
        // 否则使用文件路径
        const url = audio.filePath;
        await wavesurfer.current.load(url);
      }
    } catch (error) {
      console.error('音频加载失败:', error);
      setError('音频加载失败');
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [audio, audio.waveform, wavesurfer.current]);

  // 下载音频
  const downloadAudio = useCallback(() => {
    if (audio.audioUrl) {
      const a = document.createElement('a');
      a.href = audio.audioUrl;
      a.download = `${audio.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.wav`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [audio.audioUrl]);

  // 格式化时间
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`audio-card ${isSelected ? 'ring-2 ring-primary-500' : 'border border-secondary-200'}
                 bg-white dark:bg-secondary-900 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200
                 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* 错误状态 */}
      {error && (
        <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-sm text-red-800 font-medium">音频加载失败</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-secondary-600">加载音频中...</span>
        </div>
      )}

      {/* 波形显示 */}
      {showWaveform && (
        <div className="relative">
          <div
            ref={containerRef}
            className="w-full"
            style={{ height: 60 }}
          />
          {waveformReady && (
            <div className="absolute bottom-0 left-0 right-0 p-2 opacity-75 hover:opacity-100">
              <div className="text-xs text-secondary-500 text-center">
                拖拽调整进度 / 总时长
              </div>
            </div>
          )}
        </div>
      )}

      {/* 控制面板 */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-4">
          {/* 播放/暂停按钮 */}
          <button
            onClick={togglePlayPause}
            className={`flex items-center justify-center w-10 h-10
                           ${isPlaying
                             ? 'bg-red-500 hover:bg-red-600'
                             : theme.colors.primary + ' hover:bg-opacity-90 disabled:bg-secondary-300
                             text-white rounded-full transition-all duration-200
                             disabled={disabled || !audio}`}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* 时间显示 */}
          <div className="text-sm text-secondary-600 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* 音量控制 */}
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-secondary-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-secondary-600 w-8">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* 下载按钮 */}
          {audio.audioUrl && (
            <button
              onClick={downloadAudio}
              className="flex items-center justify-center w-8 h-8
                           text-secondary-600 hover:text-primary-600
                           transition-colors duration-200"
              title="下载音频"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 音频信息 */}
      <div className="mt-4 space-y-2 text-sm text-secondary-600">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{audio.name}</span>
          <span className="text-xs px-2 bg-primary-100 text-primary-800 rounded">
            {audio.category}
          </span>
        </div>
        {audio.description && (
          <p className="text-xs text-secondary-500">
            {audio.description}
          </p>
        )}
        <div className="flex items-center space-x-4 text-xs text-secondary-500">
          <span>时长: {formatTime(audio.duration)}</span>
          <span>大小: {audio.metadata?.size ? `${(audio.metadata.size / 1024 / 1024).toFixed(2)}MB` : '未知'}</span>
        </div>
        {audio.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {audio.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioCard;