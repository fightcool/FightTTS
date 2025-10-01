import React from 'react';
import { Play, Square, Loader, AlertCircle } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';
import { useWebSocketService } from '../hooks/useWebSocketService';
import { api } from '../utils/api';

export const GenerateButton: React.FC = () => {
  const {
    inputText,
    textSegments,
    ttsParams,
    promptAudio,
    emoAudio,
    currentTask,
    clientId,
    setCurrentTask,
    addTaskToHistory,
    setIsLoading
  } = useTTSStore();

  const { connectionStatus, isConnected } = useWebSocketService();

  // 检查是否可以开始生成
  const canGenerate = () => {
    // 检查连接状态
    if (!isConnected || connectionStatus !== 'connected' || !clientId) {
      return { canGenerate: false, reason: `未连接到服务器 (状态: ${connectionStatus})` };
    }

    // 检查是否有正在进行的任务
    if (currentTask && currentTask.status === 'processing') {
      return { canGenerate: false, reason: '有任务正在进行中' };
    }

    // 检查文本输入
    const textToUse = textSegments.length > 0 ? textSegments.join('') : inputText;
    if (!textToUse.trim()) {
      return { canGenerate: false, reason: '请输入要合成的文本' };
    }

    // 检查参考音频
    if (!promptAudio) {
      return { canGenerate: false, reason: '请上传参考音频' };
    }

    return { canGenerate: true, reason: '' };
  };

  // 开始生成
  const handleGenerate = async () => {
    const { canGenerate: can, reason } = canGenerate();
    if (!can) {
      alert(reason);
      return;
    }

    // 确保WebSocket连接正常
    if (!isConnected) {
      console.log('WebSocket未连接，请等待连接建立...');
      alert('WebSocket未连接，请等待连接建立或刷新页面重试');
      return;
    }

    const textToUse = textSegments.length > 0 ? textSegments.join('') : inputText;
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('=== TTS请求详情 ===');
    console.log('客户端ID:', clientId);
    console.log('WebSocket连接状态:', isConnected);
    console.log('连接状态:', connectionStatus);
    console.log('任务ID:', taskId);
    console.log('文本内容:', textToUse);
    console.log('=== 请求详情结束 ===');

    // 创建新任务
    const newTask = {
      id: taskId,
      text: textToUse,
      status: 'processing' as const,
      progress: 0,
      message: '开始生成...',
      result: undefined,
      startTime: Date.now(),
      createdAt: Date.now(),
      params: { ...ttsParams }
    };

    setCurrentTask(newTask);
    setIsLoading(true);

    try {
      // 准备TTS参数，确保text字段正确设置
      const ttsRequestParams = {
        ...ttsParams,
        text: textToUse  // 确保使用正确的文本内容
      };
      
      // 发送请求
      const response = await api.generateTTS(ttsRequestParams, clientId!, promptAudio!, emoAudio || undefined, taskId);
      
      // 后端异步返回结果，只要请求成功(200)就等待WebSocket消息
      console.log('TTS生成请求已发送，等待WebSocket消息...', response);
      console.log('使用任务ID:', taskId);
      console.log('前端使用的客户端ID:', clientId);
    } catch (error) {
      console.error('TTS生成错误:', error);
      
      // 更新任务状态为错误
      const errorTask = {
        ...newTask,
        status: 'error' as const,
        error: error instanceof Error ? error.message : '生成失败',
        completedAt: Date.now(),
        duration: (Date.now() - newTask.createdAt) / 1000
      };
      
      setCurrentTask(errorTask);
      addTaskToHistory(errorTask);
      setIsLoading(false);
    }
  };

  // 停止生成（如果支持的话）
  const handleStop = () => {
    if (currentTask && currentTask.status === 'processing') {
      // 这里可以发送停止请求到后端
      // 目前先简单地标记为已取消
      const stoppedTask = {
        ...currentTask,
        status: 'error' as const,
        error: '用户取消',
        completedAt: Date.now(),
        duration: (Date.now() - currentTask.createdAt) / 1000
      };
      
      setCurrentTask(stoppedTask);
      addTaskToHistory(stoppedTask);
      setIsLoading(false);
    }
  };

  const { canGenerate: can, reason } = canGenerate();
  const isProcessing = currentTask?.status === 'processing';

  return (
    <div className="card">
      <div className="space-y-4">
        {/* 状态提示 */}
        {!can && (
          <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{reason}</span>
          </div>
        )}

        {/* 当前任务进度 */}
        {currentTask && currentTask.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary-700">正在生成音频...</span>
              <span className="text-primary-600">
                {Math.round(currentTask.progress || 0)}%
              </span>
            </div>
            
            <div className="w-full bg-secondary-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentTask.progress || 0}%` }}
              />
            </div>
            
            <div className="text-xs text-secondary-500 text-center">
              任务ID: {currentTask.id.slice(0, 12)}...
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <div className="flex items-center space-x-3">
          {!isProcessing ? (
            <button
              onClick={handleGenerate}
              disabled={!can}
              className="btn-primary flex-1 flex items-center justify-center space-x-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              <span className="font-medium">开始生成</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="btn-secondary flex-1 flex items-center justify-center space-x-2 py-3 border-red-300 text-red-600 hover:bg-red-50"
            >
              <Square className="w-5 h-5" />
              <span className="font-medium">停止生成</span>
            </button>
          )}
        </div>

        {/* 预估信息 */}
        {can && !isProcessing && (
          <div className="text-xs text-secondary-500 text-center space-y-1">
            <div>
              预估生成时间: ~{Math.ceil((textSegments.length > 0 ? textSegments.join('').length : inputText.length) / 20)}秒
            </div>
            <div>
              文本长度: {textSegments.length > 0 ? textSegments.join('').length : inputText.length} 字符
              {textSegments.length > 0 && ` (${textSegments.length} 段)`}
            </div>
          </div>
        )}

        {/* 处理中的额外信息 */}
        {isProcessing && currentTask && (
          <div className="text-xs text-secondary-500 text-center space-y-1">
            <div>
              已用时: {Math.floor((Date.now() - currentTask.createdAt) / 1000)}秒
            </div>
            <div className="flex items-center justify-center space-x-1">
              <Loader className="w-3 h-3 animate-spin" />
              <span>请保持页面打开，生成过程中请勿关闭</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};