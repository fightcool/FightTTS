import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { AudioSample, AudioPlayerProps } from '../types/audio';

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audio,
  onPlay,
  onPause,
  onStop,
  onTimeUpdate,
  autoPlay = false,
  showControls = true,
  showWaveform = true,
  height = 80,
  theme
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [waveformReady, setWaveformReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const waveformRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !showWaveform) return;

    const config = {
      container: containerRef.current,
      waveColor: theme?.colors?.secondary || '#999',
      progressColor: theme?.colors?.primary || '#3b82f6',
      height,
      normalize: true,
      backend: 'WebAudio',
      mediaControls: false,
      interact: true,
      cursorColor: theme?.colors?.primary || '#3b82f6',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 1
    };

    const wavesurfer = WaveSurfer.create(config);
    waveformRef.current = wavesurfer;

    // 事件监听
    wavesurfer.on('ready', () => {
      setWaveformReady(true);
      setDuration(wavesurfer.getDuration() || 0);
      setIsInitialized(true);
      console.log('AudioPlayer: WaveSurfer ready');
    });

    wavesurfer.on('play', () => {
      setIsPlaying(true);
      onPlay?.();
    });

    wavesurfer.on('pause', () => {
      setIsPlaying(false);
      onPause?.();
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onStop?.();
    });

    wavesurfer.on('audioprocess', () => {
      const newTime = wavesurfer.getCurrentTime() || 0;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime, wavesurfer.getDuration() || 0);
    });

    wavesurfer.on('error', (error) => {
      console.error('AudioPlayer error:', error);
      setError('音频播放失败');
      setIsPlaying(false);
      setIsLoading(false);
    });

    return () => {
      wavesurfer.destroy();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [showWaveform, theme, height]);

  // 加载音频
  useEffect(() => {
    if (!audio || !waveformRef.current || !waveformReady) return;

    loadAudio();
  }, [audio, waveformReady, waveformRef.current]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // 加载音频文件
  const loadAudio = useCallback(async () => {
    if (!waveformRef.current || !audio) return;

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

        await waveformRef.current.load(url);
        console.log(`使用预计算波形数据: ${audio.waveform.length} points`);
      } else {
        // 否则使用文件路径
        const url = audio.filePath || audio.audioUrl;
        if (url) {
          console.log(`AudioPlayer: 加载音频 ${audio.name}, URL: ${url}`);
          await waveformRef.current.load(url);
          console.log(`AudioPlayer: 音频加载成功 ${audio.name}`);
        } else {
          throw new Error('音频URL不存在');
        }
      }
    } catch (error) {
      console.error('音频加载失败:', error);
      console.error('音频信息:', audio);
      setError(`音频加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [audio, waveformRef.current]);

  // 播放控制
  const togglePlayPause = useCallback(() => {
    if (!waveformRef.current || isLoading) return;

    try {
      if (isPlaying) {
        waveformRef.current.pause();
      } else {
        waveformRef.current.play();
      }
    } catch (error) {
      console.error('播放控制错误:', error);
      setIsPlaying(false);
    }
  }, [isPlaying, isLoading, waveformRef.current]);

  // 音量控制
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    waveformRef.current?.setVolume(newVolume);
  }, []);

  // 格式化时间
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-player bg-white dark:bg-secondary-900 rounded-lg p-4 shadow-sm">
      {/* 错误状态 */}
      {error && (
        <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <span className="text-red-500">⚠️</span>
          <div>
            <p className="text-sm text-red-800 font-medium">音频加载失败</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 波形显示 */}
      {showWaveform && (
        <div className="relative mb-4">
          <div
            ref={containerRef}
            className="w-full"
            style={{ height }}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-secondary-600">加载中...</span>
            </div>
          )}
        </div>
      )}

      {/* 控制面板 */}
      {showControls && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 播放/暂停按钮 */}
            <button
              onClick={togglePlayPause}
              disabled={!audio || isLoading}
              className={`flex items-center justify-center w-10 h-10
                             ${isPlaying
                               ? 'bg-red-500 hover:bg-red-600'
                               : 'bg-blue-500 hover:bg-blue-600'
                             } text-white rounded-full transition-all duration-200
                             disabled:bg-secondary-300 disabled:cursor-not-allowed`}
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
          </div>
        </div>
      )}

      {/* 音频信息 */}
      {audio && (
        <div className="mt-4 text-sm text-secondary-600">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{audio.name}</span>
            <span className="text-xs px-2 bg-primary-100 text-primary-800 rounded">
              {audio.category}
            </span>
          </div>
          {audio.description && (
            <p className="text-xs text-secondary-500 mt-1">
              {audio.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;