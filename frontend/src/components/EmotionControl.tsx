import React from 'react';
import { Heart, Mic, Sliders, Type } from 'lucide-react';
import { AudioUpload } from './AudioUpload';
import { useTTSStore } from '../store/ttsStore';

const emotionMethods = [
  { value: 0, label: '与音色参考音频相同', icon: Heart, description: '使用音色参考音频的情感' },
  { value: 1, label: '使用情感参考音频', icon: Mic, description: '上传单独的情感参考音频' },
  { value: 2, label: '使用情感向量控制', icon: Sliders, description: '通过数值向量精确控制情感' },
  { value: 3, label: '使用情感描述文本控制', icon: Type, description: '通过文本描述控制情感表达' }
];

export const EmotionControl: React.FC = () => {
  const {
    ttsParams,
    updateTTSParams,
    emoAudio,
    setEmoAudio
  } = useTTSStore();

  const handleMethodChange = (method: number) => {
    updateTTSParams({ emo_control_method: method });
    
    // 清理不相关的数据
    if (method !== 1) {
      setEmoAudio(null);
    }
    if (method !== 2) {
      updateTTSParams({ emo_vec: undefined });
    }
    if (method !== 3) {
      updateTTSParams({ emo_text: '' });
    }
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTTSParams({ emo_weight: parseFloat(e.target.value) });
  };

  const handleEmoTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateTTSParams({ emo_text: e.target.value });
  };

  const handleRandomToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTTSParams({ emo_random: e.target.checked });
  };

  const handleEmoVecChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const vecStr = e.target.value.trim();
      if (!vecStr) {
        updateTTSParams({ emo_vec: undefined });
        return;
      }
      
      const vec = vecStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      updateTTSParams({ emo_vec: vec.length > 0 ? vec : undefined });
    } catch (error) {
      console.error('Invalid emotion vector format:', error);
    }
  };

  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-semibold text-secondary-900 flex items-center space-x-2">
        <Heart className="w-5 h-5 text-primary-600" />
        <span>情感控制</span>
      </h3>

      {/* 情感控制方法选择 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-secondary-700">
          情感控制方法
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {emotionMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = ttsParams.emo_control_method === method.value;
            
            return (
              <div
                key={method.value}
                className={`
                  relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-secondary-200 hover:border-primary-300 hover:bg-secondary-50'
                  }
                `}
                onClick={() => handleMethodChange(method.value)}
              >
                <div className="flex items-start space-x-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-primary-600' : 'text-secondary-500'}`} />
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${isSelected ? 'text-primary-900' : 'text-secondary-900'}`}>
                      {method.label}
                    </h4>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-primary-700' : 'text-secondary-600'}`}>
                      {method.description}
                    </p>
                  </div>
                  
                  {/* 选中指示器 */}
                  <div className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                    ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-secondary-300'}
                  `}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 情感权重控制 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-secondary-700">
          情感权重: {ttsParams.emo_weight.toFixed(2)}
        </label>
        
        <div className="flex items-center space-x-4">
          <span className="text-xs text-secondary-500">弱</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ttsParams.emo_weight}
            onChange={handleWeightChange}
            className="flex-1 h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-secondary-500">强</span>
        </div>
        
        <p className="text-xs text-secondary-600">
          调整情感表达的强度，数值越高情感越明显
        </p>
      </div>

      {/* 情感参考音频上传 */}
      {ttsParams.emo_control_method === 1 && (
        <AudioUpload
          label="情感参考音频"
          value={emoAudio}
          onChange={setEmoAudio}
          placeholder="上传用于情感参考的音频文件"
          required={false}
        />
      )}

      {/* 情感向量输入 */}
      {ttsParams.emo_control_method === 2 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-secondary-700">
            情感向量
          </label>
          
          <textarea
            value={ttsParams.emo_vec?.join(', ') || ''}
            onChange={handleEmoVecChange}
            placeholder="输入情感向量，用逗号分隔，例如：0.1, 0.5, -0.2, 0.8"
            className="input-field h-20 resize-none"
          />
          
          <p className="text-xs text-secondary-600">
            输入数值向量来精确控制情感表达，每个数值代表不同的情感维度
          </p>
        </div>
      )}

      {/* 情感描述文本 */}
      {ttsParams.emo_control_method === 3 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-secondary-700">
            情感描述文本
          </label>
          
          <textarea
            value={ttsParams.emo_text || ''}
            onChange={handleEmoTextChange}
            placeholder="描述希望的情感表达，例如：开心、悲伤、愤怒、平静等"
            className="input-field h-20 resize-none"
          />
          
          <p className="text-xs text-secondary-600">
            用自然语言描述希望的情感表达方式
          </p>
        </div>
      )}

      {/* 随机情感选项 */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="emo_random"
          checked={ttsParams.emo_random}
          onChange={handleRandomToggle}
          className="w-4 h-4 text-primary-600 bg-secondary-100 border-secondary-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="emo_random" className="text-sm text-secondary-700">
          随机情感变化
        </label>
        <p className="text-xs text-secondary-600">
          在生成过程中添加随机的情感变化
        </p>
      </div>
    </div>
  );
};