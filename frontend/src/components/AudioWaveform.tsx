import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Download } from 'lucide-react';

interface AudioWaveformProps {
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
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  audioFile,
  height = 80,
  waveColor = '#e2e8f0',
  progressColor = '#3b82f6',
  className = '',
  showControls = true,
  onReady,
  onPlay,
  onPause
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const objectUrlRef = useRef<string | null>(null); // 用于跟踪blob URL

  useEffect(() => {
    if (!waveformRef.current) return;

    // 初始化WaveSurfer
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
      setIsLoading(false);
      setDuration(wavesurfer.current?.getDuration() || 0);
      onReady?.();
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
    });

    wavesurfer.current.on('audioprocess', () => {
      setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
    });

    wavesurfer.current.on('interaction', () => {
      setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
    });

    // 添加错误处理
    wavesurfer.current.on('error', (error) => {
      console.error('WaveSurfer error:', error);
      setIsLoading(false);
      setIsPlaying(false);
    });

    return () => {
      // 清理WaveSurfer实例和blob URL
      wavesurfer.current?.destroy();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [height, waveColor, progressColor, onReady, onPlay, onPause]);

  useEffect(() => {
    if (!wavesurfer.current) return;

  const loadAudio = async () => {
    if (!wavesurfer.current) return;
    
    setIsLoading(true);
    try {
      // 清理之前的blob URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (audioFile) {
        // 验证文件类型
        if (!audioFile.type.startsWith('audio/')) {
          throw new Error('Invalid file type. Please select an audio file.');
        }
        
        // 从File对象创建新的URL
        objectUrlRef.current = URL.createObjectURL(audioFile);
        
        // 添加延迟以确保blob URL完全创建
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await wavesurfer.current?.load(objectUrlRef.current);
      } else if (audioUrl) {
        // 添加时间戳参数避免缓存问题
        const urlWithTimestamp = audioUrl.includes('?') 
          ? `${audioUrl}&t=${Date.now()}` 
          : `${audioUrl}?t=${Date.now()}`;
        
        console.log('=== AudioWaveform 音频加载 ===');
        console.log('原始URL:', audioUrl);
        console.log('带时间戳URL:', urlWithTimestamp);
        
        // 先检查URL是否可访问
        try {
          console.log('开始HEAD请求检查文件可访问性...');
          const response = await fetch(urlWithTimestamp, { 
            method: 'HEAD',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          console.log('HEAD请求响应:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          if (!response.ok) {
            throw new Error(`Audio file not accessible: ${response.status} ${response.statusText}`);
          }
          
          console.log('文件可访问性检查通过，开始加载到WaveSurfer...');
        } catch (fetchError) {
          console.error('=== 音频文件访问失败 ===');
          console.error('URL:', urlWithTimestamp);
          console.error('错误详情:', fetchError);
          throw new Error(`无法访问音频文件: ${audioUrl}`);
        }
        
        // 加载到WaveSurfer
        try {
          await wavesurfer.current?.load(urlWithTimestamp);
          console.log('WaveSurfer加载成功');
        } catch (wavesurferError) {
          console.error('=== WaveSurfer加载失败 ===');
          console.error('错误详情:', wavesurferError);
          throw wavesurferError;
        }
      }
    } catch (error) {
      console.error('=== AudioWaveform加载失败 ===');
      console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('错误消息:', error instanceof Error ? error.message : String(error));
      console.error('完整错误:', error);
      setIsLoading(false);
      
      // 清理失败的blob URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      
      // 显示用户友好的错误信息
      alert(`音频加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

    loadAudio();
  }, [audioUrl, audioFile]);

  const togglePlayPause = () => {
    if (!wavesurfer.current || isLoading) return;
    
    try {
      if (isPlaying) {
        wavesurfer.current.pause();
      } else {
        wavesurfer.current.play();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    wavesurfer.current?.setVolume(newVolume);
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `audio_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`waveform-container ${className}`}>
      {/* 波形显示区域 */}
      <div 
        ref={waveformRef} 
        className="w-full mb-4"
        style={{ minHeight: height }}
      />
      
      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-secondary-600">加载音频中...</span>
        </div>
      )}
      
      {/* 控制面板 */}
      {showControls && !isLoading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 播放/暂停按钮 */}
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-colors duration-200"
              disabled={!audioUrl && !audioFile}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>
            
            {/* 时间显示 */}
            <div className="text-sm text-secondary-600">
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