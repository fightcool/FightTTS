import React from 'react';
import { X } from 'lucide-react';
import { AudioSelector } from './AudioSelector/AudioSelector';
import { ThemeProvider } from './AudioSelector/theme';
import { useTTSStore } from '../store/ttsStore';
import { AudioSample } from '../types/audio';

interface EnhancedAudioSelectorProps {
  type: 'voice' | 'emotion';
  label: string;
  className?: string;
}

export const EnhancedAudioSelector: React.FC<EnhancedAudioSelectorProps> = ({
  type,
  label,
  className = ''
}) => {
  const {
    selectedVoiceSample,
    selectedEmotionSample,
    setSelectedVoiceSample,
    setSelectedEmotionSample
  } = useTTSStore();

  // 获取当前选中的样本
  const currentSample = type === 'voice' ? selectedVoiceSample : selectedEmotionSample;

  // 处理样本选择
  const handleSampleSelect = (sample: AudioSample | null) => {
    if (type === 'voice') {
      setSelectedVoiceSample(sample);
    } else {
      setSelectedEmotionSample(sample);
    }

    if (sample) {
      console.log(`样本选择成功: ${sample.name}`);
    }
  };

  // 清除选择
  const handleClear = () => {
    if (type === 'voice') {
      setSelectedVoiceSample(null);
    } else {
      setSelectedEmotionSample(null);
    }
    console.log(`已清除${type === 'voice' ? '音色' : '情绪'}选择`);
  };

  return (
    <ThemeProvider>
      <div className={`space-y-4 ${className}`}>
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-secondary-700">
            {label}
          </label>
        </div>

        {/* 当前选择状态显示 */}
        {currentSample && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-blue-800 font-medium">
                  已选择样本: {currentSample.name}
                </span>
              </div>

              {/* 清除按钮 */}
              <button
                onClick={handleClear}
                className="p-1 text-blue-400 hover:text-red-500 transition-colors"
                title="清除选择"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 音频选择器 */}
        <div className="border border-secondary-200 rounded-lg p-4 bg-white">
          <AudioSelector
            type={type}
            selectedAudio={currentSample}
            onAudioSelect={handleSampleSelect}
            placeholder={`请选择${type === 'voice' ? '音色' : '情绪'}采样`}
            showWaveform={true}
          />
        </div>

        {/* 使用提示 */}
        <div className="text-xs text-secondary-500 bg-secondary-50 p-3 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-secondary-400">💡</span>
            <div>
              <p>
                从预置的{type === 'voice' ? '音色' : '情绪'}样本中选择，或点击上传按钮添加新样本。
                样本经过优化处理，可获得更好的合成效果。
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default EnhancedAudioSelector;