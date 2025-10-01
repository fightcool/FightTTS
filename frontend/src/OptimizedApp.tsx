/**
 * 优化后的主应用组件
 * 使用简化的状态管理和优化的组件
 */

import React, { useEffect } from 'react';
import { Mic, Headphones } from 'lucide-react';
import { useAppState, useInputState } from './store/optimizedTtsStore';
import { useSimplifiedWebSocket } from './hooks/useSimplifiedWebSocket';
import { api, createClientId } from './utils/api';

// 导入优化后的组件
import { ConnectionStatus } from './components/ConnectionStatus';
import { TextInput } from './components/TextInput';
import { AudioUpload } from './components/AudioUpload';
import { EmotionControl } from './components/EmotionControl';
import { AdvancedSettings } from './components/AdvancedSettings';
import { OptimizedGenerateButton } from './components/OptimizedGenerateButton';
import { TaskHistory } from './components/TaskHistory';
import { ExampleCases } from './components/ExampleCases';
import { OptimizedAudioWaveform } from './components/OptimizedAudioWaveform';
import { ToastContainer } from './components/Toast';

export const OptimizedApp: React.FC = () => {
  const {
    clientId,
    config,
    setConfig,
    setClientId,
    isLoading
  } = useAppState();

  const { promptAudio, setPromptAudio } = useInputState();

  const { isConnected, connect } = useSimplifiedWebSocket();

  // 初始化clientId
  useEffect(() => {
    if (!clientId) {
      const newClientId = createClientId();
      setClientId(newClientId);
    }
  }, [clientId, setClientId]);

  // 自动连接WebSocket
  useEffect(() => {
    if (clientId && !isConnected) {
      connect(clientId).catch(error => {
        console.error('WebSocket连接失败:', error);
      });
    }
  }, [clientId, isConnected, connect]);

  // 加载应用配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [configResponse] = await Promise.all([
          api.getConfig()
        ]);

        setConfig(configResponse);
      } catch (error) {
        console.error('配置加载失败:', error);
      }
    };

    loadConfig();
  }, [setConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Toast容器 */}
      <ToastContainer />

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
                  IndexTTS
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

            {/* 音频上传 */}
            <AudioUpload
              label="参考音频"
              value={promptAudio}
              onChange={setPromptAudio}
              placeholder="上传用于音色参考的音频文件"
              required={false}
            />

            {/* 情感控制 */}
            <EmotionControl />

            {/* 高级设置 */}
            <AdvancedSettings />

            {/* 生成按钮 */}
            <OptimizedGenerateButton />

            {/* 当前任务结果 */}
            {config && config.model_name && (
              <div className="card">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                  当前任务
                </h3>

                {/* 这里可以添加任务进度显示 */}
                <div className="text-sm text-secondary-600 text-center py-8">
                  等待任务开始...
                </div>
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
              <span>© 2024 IndexTTS</span>
              <span>•</span>
              <span>基于 React + FastAPI + WebSocket</span>
            </div>

            {config && (
              <div className="flex items-center space-x-4">
                <span>模型: {config.model_name}</span>
                <span>•</span>
                <span>设备: {config.device}</span>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* 全局加载遮罩 */}
      {isLoading && !isConnected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="text-secondary-700">连接服务器中...</span>
          </div>
        </div>
      )}
    </div>
  );
};