import React, { useState, useEffect } from 'react';
import { AudioSelector } from './AudioSelector';
import { useAudioManager, useToast } from '../../hooks';
import { ThemeProvider, useTheme } from './theme';
import { AudioSample } from '../../types/audio';

// 单独的示例组件
export const AudioSelectorExample: React.FC = () => {
  const { toast } = useToast();
  const { theme } = useTheme();

  // 使用AudioManager Hook
  const {
    isInitialized,
    isScanning,
    voiceSamples,
    emotionSamples,
    selectedVoiceSample,
    selectedEmotionSample,
    selectVoiceSample,
    selectEmotionSample,
    scanAudioFiles,
    refreshCache,
    getStats,
    error,
    clearError
  } = useAudioManager({
    autoInitialize: true,
    enableAutoScan: true,
    autoScanInterval: 30000 // 30秒自动扫描
  });

  // 状态
  const [activeTab, setActiveTab] = useState<'voice' | 'emotion'>('voice');
  const [showStats, setShowStats] = useState(false);

  // 错误处理
  useEffect(() => {
    if (error) {
      toast.error('音频管理器错误', error);
    }
  }, [error, toast]);

  // 手动扫描
  const handleScan = async () => {
    try {
      toast.info('开始扫描', '正在扫描音频文件...');
      await scanAudioFiles();
      toast.success('扫描完成', `发现 ${voiceSamples.length + emotionSamples.length} 个音频文件`);
    } catch (err) {
      toast.error('扫描失败', err instanceof Error ? err.message : '未知错误');
    }
  };

  // 刷新缓存
  const handleRefresh = async () => {
    try {
      toast.info('刷新缓存', '正在刷新音频缓存...');
      await refreshCache();
      toast.success('刷新完成', '音频缓存已更新');
    } catch (err) {
      toast.error('刷新失败', err instanceof Error ? err.message : '未知错误');
    }
  };

  // 音频选择处理
  const handleVoiceSelect = (audio: AudioSample | null) => {
    selectVoiceSample(audio);
    if (audio) {
      toast.success('音色已选择', `已选择音色: ${audio.name}`);
    } else {
      toast.info('音色已清除', '已清除选中的音色');
    }
  };

  const handleEmotionSelect = (audio: AudioSample | null) => {
    selectEmotionSample(audio);
    if (audio) {
      toast.success('情绪已选择', `已选择情绪: ${audio.name}`);
    } else {
      toast.info('情绪已清除', '已清除选中的情绪');
    }
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">音频选择系统示例</h1>
          <p className="text-gray-600">
            展示完整的音频管理功能，包括音色选择、情绪控制和实时预览
          </p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">控制面板</h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowStats(!showStats)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {showStats ? '隐藏统计' : '显示统计'}
              </button>
              <button
                onClick={handleRefresh}
                disabled={isScanning}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                刷新缓存
              </button>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-colors"
              >
                {isScanning ? '扫描中...' : '重新扫描'}
              </button>
            </div>
          </div>

          {/* 错误显示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-red-800 font-medium">错误</h3>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* 统计信息 */}
          {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSamples}</div>
                <div className="text-sm text-gray-600">总文件数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.voiceSamples}</div>
                <div className="text-sm text-gray-600">音色文件</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.emotionSamples}</div>
                <div className="text-sm text-gray-600">情绪文件</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.selectedVoice || stats.selectedEmotion ? '已选择' : '未选择'}
                </div>
                <div className="text-sm text-gray-600">选择状态</div>
              </div>
            </div>
          )}
        </div>

        {/* 标签页 */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('voice')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'voice'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                音色选择
                {selectedVoiceSample && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    已选择
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('emotion')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'emotion'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                情绪选择
                {selectedEmotionSample && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    已选择
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* 内容区域 */}
          <div className="p-6">
            {!isInitialized ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">正在初始化音频管理器...</span>
              </div>
            ) : (
              <>
                {activeTab === 'voice' && (
                  <AudioSelector
                    type="voice"
                    selectedAudio={selectedVoiceSample}
                    onAudioSelect={handleVoiceSelect}
                    placeholder="请选择音色采样"
                    showWaveform={true}
                    theme={theme}
                  />
                )}
                {activeTab === 'emotion' && (
                  <AudioSelector
                    type="emotion"
                    selectedAudio={selectedEmotionSample}
                    onAudioSelect={handleEmotionSelect}
                    placeholder="请选择情绪采样"
                    showWaveform={true}
                    theme={theme}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* 当前选择摘要 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">当前选择摘要</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-4 rounded-lg border-2 ${
              selectedVoiceSample
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className="font-medium text-gray-900 mb-2">音色采样</h4>
              {selectedVoiceSample ? (
                <div>
                  <p className="text-sm font-medium text-green-800">{selectedVoiceSample.name}</p>
                  <p className="text-xs text-green-600 mt-1">
                    分类: {selectedVoiceSample.subcategory} |
                    时长: {Math.floor(selectedVoiceSample.duration)}s
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">未选择音色采样</p>
              )}
            </div>
            <div className={`p-4 rounded-lg border-2 ${
              selectedEmotionSample
                ? 'border-purple-200 bg-purple-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className="font-medium text-gray-900 mb-2">情绪采样</h4>
              {selectedEmotionSample ? (
                <div>
                  <p className="text-sm font-medium text-purple-800">{selectedEmotionSample.name}</p>
                  <p className="text-xs text-purple-600 mt-1">
                    分类: {selectedEmotionSample.subcategory} |
                    时长: {Math.floor(selectedEmotionSample.duration)}s
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">未选择情绪采样</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 完整的示例组件（包含ThemeProvider）
export const AudioSelectorCompleteExample: React.FC = () => {
  return (
    <ThemeProvider>
      <AudioSelectorExample />
    </ThemeProvider>
  );
};

export default AudioSelectorCompleteExample;