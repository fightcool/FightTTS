import React, { useState, useCallback } from 'react';
import { Folder } from 'lucide-react';
import { AudioSample, AudioSelectorProps } from '../../types/audio';
import AudioPlayer from './AudioPlayer';
import AudioCategorySelector from './AudioCategorySelector';

export const AudioSelector: React.FC<AudioSelectorProps> = ({
  type,
  selectedAudio,
  onAudioSelect,
  placeholder = '请选择音频采样',
  disabled = false,
  className = '',
  showWaveform = true
}) => {
  const [currentAudio, setCurrentAudio] = useState<AudioSample | null>(selectedAudio || null);
  const [previewAudio, setPreviewAudio] = useState<AudioSample | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 音频处理
  const handleAudioSelect = useCallback((audio: AudioSample) => {
    if (previewAudio && previewAudio.id !== audio.id) {
      // 停止预览避免冲突
      setPreviewAudio(null);
    }

    setCurrentAudio(audio);
    onAudioSelect?.(audio);

    // 重置错误状态
    if (error) {
      setError(null);
    }
  }, [onAudioSelect, previewAudio, error]);

  // 音频预览
  const handleAudioPreview = useCallback(() => {
    if (currentAudio) {
      setPreviewAudio(currentAudio);
    }
  }, [currentAudio]);

  const handlePreviewStop = useCallback(() => {
    setPreviewAudio(null);
  }, []);

  return (
    <div className={`audio-selector ${className}`}>
      {/* 头部标题 */}
      <div className="text-lg font-semibold text-secondary-900 mb-4">
        选择{type === 'voice' ? '音色采样' : '情绪采样'}
      </div>

      <AudioCategorySelector
        type={type}
        value={currentAudio?.id || ''}
        onCategoryChange={handleAudioSelect}
        placeholder={placeholder}
        disabled={disabled}
        showSearch={true}
      />

      {/* 当前选择的音频信息 */}
      {currentAudio ? (
        <div className="card mb-6 bg-white dark:bg-secondary-900 rounded-lg shadow-md">
          <div className="p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                {currentAudio.subcategory === 'male' ? '👨' :
                 currentAudio.subcategory === 'female' ? '👩' :
                 currentAudio.subcategory === 'neutral' ? '🎭' : '🎵'}
              </div>
              <div>
                <span className="text-secondary-900 font-medium">{currentAudio.name}</span>
                <span className="text-xs text-secondary-500 ml-2">#{currentAudio.category}</span>
              </div>
            </div>
          </div>

          {/* 当前选中的音频预览 */}
          {previewAudio && (
            <div className="card mt-4">
              <AudioPlayer
                audio={previewAudio}
                autoPlay={true}
                onPause={handlePreviewStop}
                onStop={handlePreviewStop}
              />
            </div>
          )}

          {/* 选择其他音频的提示 */}
          {currentAudio && !previewAudio && (
            <div className="text-center text-sm text-secondary-500 mt-2">
              <div className="text-xs text-secondary-500">
                已选择: {currentAudio.name}
              </div>
              <button
                onClick={handleAudioPreview}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                预览音频
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 没有选中音频时的提示 */
        <div className="text-center text-sm text-secondary-500 mt-4 p-8 border-2 border-dashed border-secondary-300 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <Folder className="w-5 h-5 text-gray-400" />
            <span>请从下方选择音频采样</span>
          </div>
        </div>
      )}
    </div>
  );
};