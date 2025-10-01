import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  message,
  className = '',
  showPercentage = true,
  animated = true
}) => {
  // 调试：监控进度条props
  useEffect(() => {
    console.log('📊 ProgressBar组件props:', { progress, status, message });
  }, [progress, status, message]);
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'processing':
        return 'bg-primary-500';
      default:
        return 'bg-secondary-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (message) return message;
    
    switch (status) {
      case 'pending':
        return '等待开始...';
      case 'processing':
        return '生成中...';
      case 'completed':
        return '生成完成！';
      case 'error':
        return '生成失败';
      default:
        return '';
    }
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 状态信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-secondary-700">
            {getStatusText()}
          </span>
        </div>
        
        {showPercentage && (
          <span className="text-sm text-secondary-500">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className="w-full bg-secondary-200 rounded-full h-2 overflow-hidden">
        <div
          className={`
            h-full rounded-full transition-all duration-300 ease-out
            ${getStatusColor()}
            ${animated && status === 'processing' ? 'animate-pulse' : ''}
          `}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* 动画效果 */}
          {animated && status === 'processing' && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse-slow"></div>
          )}
        </div>
      </div>

      {/* 详细信息 */}
      {status === 'processing' && (
        <div className="flex justify-between text-xs text-secondary-500">
          <span>正在处理您的请求...</span>
          <span>预计还需要几秒钟</span>
        </div>
      )}
    </div>
  );
};