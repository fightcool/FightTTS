import React, { useEffect } from 'react';
import { Mic, Headphones } from 'lucide-react';
import { useTTSStore } from './store/ttsStore';
import { useWebSocketService } from './hooks/useWebSocketService';
import { api, createClientId } from './utils/api';

// 导入所有组件
import { ConnectionStatus } from './components/ConnectionStatus';
import { TextInput } from './components/TextInput';
import { EnhancedAudioSelector } from './components/EnhancedAudioSelector';
import { EmotionControl } from './components/EmotionControl';
import { AdvancedSettings } from './components/AdvancedSettings';
import { GenerateButton } from './components/GenerateButton';
import { ProgressBar } from './components/ProgressBar';
import { TaskHistory } from './components/TaskHistory';
import { ExampleCases } from './components/ExampleCases';
import { AudioWaveform } from './components/AudioWaveform';

function App() {
  const {
    currentTask,
    config,
    setConfig,
    isLoading,
    clientId,
    setClientId,
    clearCurrentTask
  } = useTTSStore();

  // 调试：监控currentTask变化
  React.useEffect(() => {
    console.log('🔄 App中currentTask变化:', currentTask);
  }, [currentTask]);

  // 初始化clientId
  useEffect(() => {
    if (!clientId) {
      const newClientId = createClientId();
      setClientId(newClientId);
      console.log('Generated client ID:', newClientId);
    }
  }, []); // 移除clientId依赖，避免循环

  // 初始化WebSocket连接 - useWebSocketService统一管理
  const { connectionStatus } = useWebSocketService();

  // 加载应用配置和健康检查 - 合并为一个effect
  useEffect(() => {
    let isMounted = true;
    let intervalId: number;

    const initializeApp = async () => {
      try {
        // 并行加载配置和健康检查
        const [configResponse] = await Promise.all([
          api.getConfig(),
          api.healthCheck()
        ]);

        if (isMounted) {
          setConfig(configResponse);
          console.log('后端服务正常');
        }
      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    const healthCheck = async () => {
      try {
        await api.healthCheck();
      } catch (error) {
        console.error('后端服务连接失败:', error);
      }
    };

    initializeApp();

    // 每30秒检查一次
    intervalId = setInterval(healthCheck, 30000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // 只在组件挂载时执行一次

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo和标题 */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Mic className="w-8 h-8 text-primary-600" />
                <Headphones className="w-8 h-8 text-secondary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-secondary-900">
                  战酷语音合成系统 - FightTTS
                </h1>
                <p className="text-sm text-secondary-600">
                  智能语音合成系统
                </p>
              </div>
            </div>

            {/* 连接状态和配置信息 */}
            <div className="flex items-center space-x-4">
              {config && (
                <div className="text-sm text-secondary-600">
                  <span className="font-medium">{config.model_name}</span>
                  {config.model_version && (
                    <span className="ml-2 text-xs bg-secondary-100 px-2 py-1 rounded">
                      v{config.model_version}
                    </span>
                  )}
                </div>
              )}
              <ConnectionStatus />
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧列 - 输入和设置 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 文本输入 */}
            <TextInput />

            {/* 音频选择 - 音色 */}
            <EnhancedAudioSelector
              type="voice"
              label="音色参考"
              className="w-full"
            />

            {/* 音频选择 - 情绪 */}
            <EnhancedAudioSelector
              type="emotion"
              label="情绪参考"
              className="w-full"
            />

            {/* 情感控制 */}
            <EmotionControl />

            {/* 高级设置 */}
            <AdvancedSettings />

            {/* 生成按钮 */}
            <GenerateButton />

            {/* 当前任务进度 */}
            {currentTask && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900">
                    当前任务
                  </h3>
                  {(currentTask.status === 'completed' || currentTask.status === 'error') && (
                    <button
                      onClick={() => clearCurrentTask()}
                      className="text-sm px-3 py-1 bg-secondary-100 hover:bg-secondary-200 text-secondary-600 rounded transition-colors"
                    >
                      清除
                    </button>
                  )}
                </div>
                <ProgressBar
                  progress={currentTask.progress || 0}
                  status={currentTask.status}
                  message={currentTask.error || currentTask.message || '正在处理...'}
                />

                {/* 显示生成的音频 */}
                {currentTask.status === 'completed' && currentTask.audioUrl && (
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-secondary-800 mb-2">
                      生成结果
                    </h4>
                    <AudioWaveform
                      audioUrl={currentTask.audioUrl}
                      title={`任务 ${currentTask.id.slice(0, 8)}`}
                    />
                  </div>
                )}

                {/* 任务状态提示 */}
                {currentTask.status === 'completed' && (
                  <div className="mt-4 text-sm text-green-600 text-center">
                    ✅ 任务已完成，将在30秒后自动清除
                  </div>
                )}
                {currentTask.status === 'error' && (
                  <div className="mt-4 text-sm text-red-600 text-center">
                    ❌ 任务失败，将在10秒后自动清除
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧列 - 历史和示例 */}
          <div className="space-y-6">
            {/* 示例案例 */}
            <ExampleCases />

            {/* 任务历史 */}
            <TaskHistory />
          </div>
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="bg-white border-t border-secondary-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-secondary-600">
            <div className="flex items-center space-x-4">
              <span>© 2024 FightCoolTTS</span>
              <span>•</span>
              <span>基于 React + FastAPI + WebSocket</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {config && (
                <>
                  <span>模型: {config.model_name}</span>
                  <span>•</span>
                  <span>设备: {config.device}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* 全局加载遮罩 */}
      {isLoading && connectionStatus === 'connecting' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="text-secondary-700">连接服务器中...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
