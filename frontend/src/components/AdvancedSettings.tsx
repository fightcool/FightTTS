import React from 'react';
import { Settings, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';

interface SettingItemProps {
  label: string;
  value: number | boolean;
  onChange: (value: number | boolean) => void;
  type: 'range' | 'number' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  value,
  onChange,
  type,
  min = 0,
  max = 1,
  step = 0.1,
  description,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'boolean') {
      onChange(e.target.checked);
    } else {
      onChange(parseFloat(e.target.value));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-secondary-700 flex items-center space-x-2">
          <span>{label}</span>
          {description && (
            <div className="group relative">
              <Info className="w-3 h-3 text-secondary-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-secondary-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                {description}
              </div>
            </div>
          )}
        </label>
        
        {type !== 'boolean' && (
          <span className="text-sm text-secondary-500">
            {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}
          </span>
        )}
      </div>
      
      {type === 'range' && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value as number}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
      )}
      
      {type === 'number' && (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value as number}
          onChange={handleChange}
          disabled={disabled}
          className="input-field disabled:opacity-50"
        />
      )}
      
      {type === 'boolean' && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={handleChange}
            disabled={disabled}
            className="w-4 h-4 text-primary-600 bg-secondary-100 border-secondary-300 rounded focus:ring-primary-500 disabled:opacity-50"
          />
          <span className="text-sm text-secondary-600">启用</span>
        </div>
      )}
    </div>
  );
};

export const AdvancedSettings: React.FC = () => {
  const { ttsParams, updateTTSParams, showAdvanced, setShowAdvanced } = useTTSStore();

  const handleParamChange = (key: keyof typeof ttsParams) => (value: number | boolean) => {
    updateTTSParams({ [key]: value });
  };

  return (
    <div className="card">
      {/* 标题和折叠按钮 */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <h3 className="text-lg font-semibold text-secondary-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-primary-600" />
          <span>高级设置</span>
        </h3>
        
        {showAdvanced ? (
          <ChevronUp className="w-5 h-5 text-secondary-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-secondary-500" />
        )}
      </div>

      {/* 设置内容 */}
      {showAdvanced && (
        <div className="mt-6 space-y-6">
          {/* GPT2 采样设置 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-secondary-800 border-b border-secondary-200 pb-2">
              GPT2 采样参数
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingItem
                label="启用采样"
                value={ttsParams.do_sample}
                onChange={handleParamChange('do_sample')}
                type="boolean"
                description="是否启用随机采样，关闭则使用贪心搜索"
              />
              
              <SettingItem
                label="温度 (Temperature)"
                value={ttsParams.temperature}
                onChange={handleParamChange('temperature')}
                type="range"
                min={0.1}
                max={2.0}
                step={0.1}
                description="控制生成的随机性，值越高越随机"
                disabled={!ttsParams.do_sample}
              />
              
              <SettingItem
                label="Top-p"
                value={ttsParams.top_p}
                onChange={handleParamChange('top_p')}
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                description="核采样参数，保留累积概率前p的词汇"
                disabled={!ttsParams.do_sample}
              />
              
              <SettingItem
                label="Top-k"
                value={ttsParams.top_k}
                onChange={handleParamChange('top_k')}
                type="number"
                min={1}
                max={100}
                step={1}
                description="只考虑概率最高的k个词汇，0表示不限制"
                disabled={!ttsParams.do_sample}
              />
              
              <SettingItem
                label="束搜索数量 (Num Beams)"
                value={ttsParams.num_beams}
                onChange={handleParamChange('num_beams')}
                type="number"
                min={1}
                max={10}
                step={1}
                description="束搜索的束数量，1表示贪心搜索"
              />
              
              <SettingItem
                label="重复惩罚"
                value={ttsParams.repetition_penalty}
                onChange={handleParamChange('repetition_penalty')}
                type="range"
                min={1.0}
                max={20.0}
                step={0.5}
                description="防止重复生成的惩罚系数"
              />
              
              <SettingItem
                label="长度惩罚"
                value={ttsParams.length_penalty}
                onChange={handleParamChange('length_penalty')}
                type="range"
                min={-2.0}
                max={2.0}
                step={0.1}
                description="对生成长度的惩罚，正值偏好长序列"
              />
            </div>
          </div>

          {/* 生成限制设置 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-secondary-800 border-b border-secondary-200 pb-2">
              生成限制
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingItem
                label="最大音频令牌数"
                value={ttsParams.max_mel_tokens}
                onChange={handleParamChange('max_mel_tokens')}
                type="number"
                min={100}
                max={3000}
                step={50}
                description="生成音频的最大令牌数量"
              />
              
              <SettingItem
                label="每段最大文本令牌数"
                value={ttsParams.max_text_tokens_per_segment}
                onChange={handleParamChange('max_text_tokens_per_segment')}
                type="number"
                min={50}
                max={300}
                step={10}
                description="文本分段时每段的最大令牌数"
              />
            </div>
          </div>

          {/* 重置按钮 */}
          <div className="pt-4 border-t border-secondary-200">
            <button
              onClick={() => {
                updateTTSParams({
                  do_sample: true,
                  temperature: 0.8,
                  top_p: 0.8,
                  top_k: 30,
                  num_beams: 3,
                  repetition_penalty: 10.0,
                  length_penalty: 0.0,
                  max_mel_tokens: 1500,
                  max_text_tokens_per_segment: 120
                });
              }}
              className="btn-secondary text-sm"
            >
              重置为默认值
            </button>
          </div>
        </div>
      )}
    </div>
  );
};