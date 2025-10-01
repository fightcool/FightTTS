/**
 * 优化的音频波形组件
 * 改进错误处理，提供更好的用户体验
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Download, AlertCircle, Loader2 } from 'lucide-react';

interface OptimizedAudioWaveformProps {
  audioUrl?: string;
  audioFile?: File;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  className?: string;
  showControls?: boolean;
  title?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: string) => void;
}

interface AudioState {
  isLoading: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  error: string | null;
}

export const OptimizedAudioWaveform: React.FC<OptimizedAudioWaveformProps> = ({
  audioUrl,
  audioFile,
  height = 80,
  waveColor = '#e2e8f0',
  progressColor = '#3b82f6',
  className = '',
  showControls = true,
  onReady,
  onPlay,
  onPause,
  onError
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [audioState, setAudioState] = useState<AudioState>({
    isLoading: false,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    volume: 1,
    error: null
  });

  const updateAudioState = useCallback((updates: Partial<AudioState>) => {
    setAudioState(prev => ({ ...prev, ...updates }));
  }, []);

  // 初始化WaveSurfer
  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor,
      progressColor,
      height,
      normalize: true,
      backend: 'WebAudio',
      mediaControls: false,
      interact: true,
      cursorColor: progressColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 1
    });

    // 事件监听
    wavesurfer.current.on('ready', () => {
      updateAudioState({
        isLoading: false,
        duration: wavesurfer.current?.getDuration() || 0,
        error: null
      });
      onReady?.();
    });

    wavesurfer.current.on('play', () => {
      updateAudioState({ isPlaying: true });
      onPlay?.();
    });

    wavesurfer.current.on('pause', () => {
      updateAudioState({ isPlaying: false });
      onPause?.();
    });

    wavesurfer.current.on('finish', () => {
      updateAudioState({ isPlaying: false, currentTime: 0 });
    });

    wavesurfer.current.on('audioprocess', () => {
      updateAudioState({ currentTime: wavesurfer.current?.getCurrentTime() || 0 });
    });

    wavesurfer.current.on('error', (error) => {
      console.error('WaveSurfer error:', error);
      updateAudioState({
        isLoading: false,
        isPlaying: false,
        error: '音频加载失败'
      });
      onError?.('音频加载失败');
    });

    return () => {
      wavesurfer.current?.destroy();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [height, waveColor, progressColor, onReady, onPlay, onPause, onError, updateAudioState]);

  // 音频加载函数
  const loadAudio = useCallback(async () => {
    if (!wavesurfer.current || (!audioUrl && !audioFile)) return;

    updateAudioState({ isLoading: true, error: null });

    try {
      // 清理之前的资源
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      let audioSource: string;

      if (audioFile) {
        // 验证文件类型
        if (!audioFile.type.startsWith('audio/')) {
          throw new Error('请选择有效的音频文件');
        }

        objectUrlRef.current = URL.createObjectURL(audioFile);
        audioSource = objectUrlRef.current;
      } else if (audioUrl) {
        // 添加缓存破坏参数
        const separator = audioUrl.includes('?') ? '&' : '?';
        audioSource = `${audioUrl}${separator}t=${Date.now()}`;
      } else {
        throw new Error('未提供音频源');
      }

      // 加载音频
      await wavesurfer.current.load(audioSource);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '音频加载失败';
      console.error('AudioWaveform加载失败:', error);

      updateAudioState({
        isLoading: false,
        isPlaying: false,
        error: errorMessage
      });

      // 清理失败的资源
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      onError?.(errorMessage);
    }
  }, [audioUrl, audioFile, onError, updateAudioState]);

  // 监听音频源变化
  useEffect(() => {
    loadAudio();
  }, [loadAudio]);

  const togglePlayPause = useCallback(() => {
    if (!wavesurfer.current || audioState.isLoading) return;

    try {
      if (audioState.isPlaying) {
        wavesurfer.current.pause();
      } else {
        wavesurfer.current.play();
      }
    } catch (error) {
      console.error('播放控制失败:', error);
      updateAudioState({ isPlaying: false });
    }
  }, [audioState.isPlaying, audioState.isLoading, updateAudioState]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    updateAudioState({ volume: newVolume });
    wavesurfer.current?.setVolume(newVolume);
  }, [updateAudioState]);

  const downloadAudio = useCallback(() => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `audio_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [audioUrl]);

  const retryLoad = useCallback(() => {
    loadAudio();
  }, [loadAudio]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`waveform-container ${className}`}>
      {/* 错误状态 */}
      {audioState.error && (
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">音频加载失败</p>
            <p className="text-xs text-red-600 mt-1">{audioState.error}</p>
          </div>
          <button
            onClick={retryLoad}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* 波形显示区域 */}
      <div
        ref={waveformRef}
        className="w-full mb-4"
        style={{ minHeight: height }}
      />

      {/* 加载状态 */}
      {audioState.isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600 mr-2" />
          <span className="text-sm text-secondary-600">加载音频中...</span>
        </div>
      )}

      {/* 控制面板 */}
      {showControls && !audioState.isLoading && !audioState.error && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 播放/暂停按钮 */}
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:bg-secondary-300 text-white rounded-full transition-colors duration-200 disabled:cursor-not-allowed"
              disabled={!audioUrl && !audioFile}
            >
              {audioState.isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* 时间显示 */}
            <div className="text-sm text-secondary-600 font-mono">
              {formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}
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
                value={audioState.volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-secondary-600 w-8">
                {Math.round(audioState.volume * 100)}%
              </span>
            </div>

            {/* 下载按钮 */}
            {audioUrl && (
              <button
                onClick={downloadAudio}
                className="flex items-center justify-center w-8 h-8 text-secondary-600 hover:text-primary-600 transition-colors duration-200"
                title="下载音频"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};