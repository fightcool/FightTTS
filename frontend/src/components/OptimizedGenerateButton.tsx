/**
 * 优化的生成按钮组件
 * 改进用户体验，添加更好的状态管理和错误处理
 */

import React, { useCallback, useMemo } from 'react';
import { Play, Square, Loader2, AlertTriangle } from 'lucide-react';
import { useInputState, useTaskState, useUIState } from '../store/optimizedTtsStore';
import { useSimplifiedWebSocket } from '../hooks/useSimplifiedWebSocket';
import { api } from '../utils/api';
import { useToast } from './Toast';

interface GenerationRequirement {
  isValid: boolean;
  reason: string;
  level: 'error' | 'warning';
}

export const OptimizedGenerateButton: React.FC = () => {
  const {
    inputText,
    textSegments,
    ttsParams,
    promptAudio,
    emoAudio
  } = useInputState();

  const {
    currentTask,
    setCurrentTask,
    failTask
  } = useTaskState();

  const { isGenerating, setGenerating } = useUIState();
  const { isConnected, connectionStatus } = useSimplifiedWebSocket();
  const { success, error, warning, info } = useToast();

  // 检查生成要求
  const checkRequirements = useMemo((): GenerationRequirement => {
    // 检查连接状态
    if (!isConnected) {
      return {
        isValid: false,
        reason: '未连接到服务器，请等待连接建立',
        level: 'error'
      };
    }

    // 检查是否有正在进行的任务
    if (currentTask?.status === 'processing') {
      return {
        isValid: false,
        reason: '有任务正在进行中，请等待完成',
        level: 'warning'
      };
    }

    // 检查文本输入
    const textToUse = textSegments.length > 0
      ? textSegments.map(seg => seg.content).join('')
      : inputText;

    if (!textToUse?.trim()) {
      return {
        isValid: false,
        reason: '请输入要合成的文本',
        level: 'error'
      };
    }

    if (textToUse.length > 1000) {
      return {
        isValid: false,
        reason: '文本过长，请控制在1000字符以内',
        level: 'error'
      };
    }

    // 检查参考音频
    if (!promptAudio) {
      return {
        isValid: false,
        reason: '请上传参考音频文件',
        level: 'error'
      };
    }

    // 检查情感控制相关要求
    if (ttsParams.emo_control_method === 1 && !emoAudio) {
      return {
        isValid: false,
        reason: '使用情感音频控制时，请上传情感参考音频',
        level: 'warning'
      };
    }

    if (ttsParams.emo_control_method === 2 && !ttsParams.emo_vec) {
      return {
        isValid: false,
        reason: '使用情感向量控制时，请输入情感向量',
        level: 'warning'
      };
    }

    if (ttsParams.emo_control_method === 3 && !ttsParams.emo_text?.trim()) {
      return {
        isValid: false,
        reason: '使用情感文本控制时，请输入情感描述',
        level: 'warning'
      };
    }

    return {
      isValid: true,
      reason: '准备就绪',
      level: 'error'
    };
  }, [isConnected, currentTask, inputText, textSegments, ttsParams, promptAudio, emoAudio]);

  // 估算生成时间
  const estimateGenerationTime = useMemo(() => {
    const textToUse = textSegments.length > 0
      ? textSegments.map(seg => seg.content).join('')
      : inputText;

    const textLength = textToUse?.length || 0;
    const baseTime = 2; // 基础时间2秒
    const timePerChar = 0.05; // 每字符0.05秒

    return Math.ceil(baseTime + (textLength * timePerChar));
  }, [inputText, textSegments]);

  // 开始生成
  const handleGenerate = useCallback(async () => {
    const requirement = checkRequirements;

    if (!requirement.isValid) {
      if (requirement.level === 'error') {
        error('生成失败', requirement.reason);
      } else {
        warning('提示', requirement.reason);
      }
      return;
    }

    const textToUse = textSegments.length > 0
      ? textSegments.map(seg => seg.content).join('')
      : inputText;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建新任务
    const newTask = {
      id: taskId,
      status: 'processing' as const,
      progress: 0,
      message: '开始生成...',
      result: undefined,
      startTime: Date.now(),
      createdAt: Date.now()
    };

    setCurrentTask(newTask);
    setGenerating(true);

    info('开始生成', '正在处理您的请求...');

    try {
      // 准备TTS参数
      const ttsRequestParams = {
        ...ttsParams,
        text: textToUse
      };

      // 发送请求
      const response = await api.generateTTS(
        ttsRequestParams,
        `client_placeholder`, // 这里需要从store获取clientId
        promptAudio!,
        emoAudio || undefined,
        taskId
      );

      console.log('TTS生成请求已发送:', response);

    } catch (error) {
      console.error('TTS生成错误:', error);

      const errorMessage = error instanceof Error ? error.message : '生成失败';

      failTask(taskId, errorMessage);
      setGenerating(false);

      error('生成失败', errorMessage);
    }
  }, [
    checkRequirements,
    textSegments,
    inputText,
    ttsParams,
    promptAudio,
    emoAudio,
    setCurrentTask,
    setGenerating,
    failTask,
    error,
    warning,
    info
  ]);

  // 停止生成
  const handleStop = useCallback(() => {
    if (currentTask?.status === 'processing') {
      const stoppedTask = {
        ...currentTask,
        status: 'error' as const,
        error: '用户取消',
        completedAt: Date.now(),
        duration: (Date.now() - currentTask.createdAt) / 1000
      };

      setCurrentTask(null);
      setGenerating(false);

      warning('已取消', '语音生成已取消');
    }
  }, [currentTask, setCurrentTask, setGenerating, warning]);

  const requirement = checkRequirements;
  const isProcessing = currentTask?.status === 'processing';

  return (
    <div className="card space-y-4">
      {/* 状态提示 */}
      {!requirement.isValid && (
        <div className={`
          flex items-center space-x-2 text-sm p-3 rounded-lg
          ${requirement.level === 'error'
            ? 'text-red-600 bg-red-50 border border-red-200'
            : 'text-amber-600 bg-amber-50 border border-amber-200'
          }
        `}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{requirement.reason}</span>
        </div>
      )}

      {/* 当前任务进度 */}
      {isProcessing && currentTask && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary-700">正在生成音频...</span>
            <span className="text-primary-600 font-medium">
              {Math.round(currentTask.progress || 0)}%
            </span>
          </div>

          <div className="w-full bg-secondary-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${currentTask.progress || 0}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-secondary-500">
            <span>任务ID: {currentTask.id.slice(0, 12)}...</span>
            <span>已用时: {Math.floor((Date.now() - currentTask.createdAt) / 1000)}秒</span>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <div className="flex items-center space-x-3">
        {!isProcessing ? (
          <button
            onClick={handleGenerate}
            disabled={!requirement.isValid}
            className={`
              flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium
              transition-all duration-200
              ${requirement.isValid
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md'
                : 'bg-secondary-200 text-secondary-400 cursor-not-allowed'
              }
            `}
          >
            <Play className="w-5 h-5" />
            <span>开始生成</span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium
                     bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md
                     transition-all duration-200"
          >
            <Square className="w-5 h-5" />
            <span>停止生成</span>
          </button>
        )}
      </div>

      {/* 预估信息 */}
      {requirement.isValid && !isProcessing && (
        <div className="text-xs text-secondary-500 text-center space-y-1">
          <div>预估生成时间: ~{estimateGenerationTime}秒</div>
          <div>
            文本长度: {(textSegments.length > 0
              ? textSegments.map(seg => seg.content).join('').length
              : inputText.length)} 字符
            {textSegments.length > 0 && ` (${textSegments.length} 段)`}
          </div>
          <div className="flex items-center justify-center space-x-1 text-green-600">
            <Play className="w-3 h-3" />
            <span>一切就绪，点击开始生成</span>
          </div>
        </div>
      )}

      {/* 处理中的额外信息 */}
      {isProcessing && (
        <div className="text-xs text-secondary-500 text-center space-y-1">
          <div className="flex items-center justify-center space-x-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>请保持页面打开，生成过程中请勿关闭</span>
          </div>
          <div className="text-amber-600">
            提示：生成过程可能需要几分钟，请耐心等待
          </div>
        </div>
      )}
    </div>
  );
};