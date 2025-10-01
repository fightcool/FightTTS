import React, { useState } from 'react';
import { History, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';
import { AudioWaveform } from './AudioWaveform';

interface TaskItemProps {
  task: any;
  onDelete: (taskId: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-secondary-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'error':
        return '失败';
      case 'processing':
        return '处理中';
      default:
        return '等待中';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'processing':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-secondary-600 bg-secondary-50';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds.toFixed(1)}秒`;
  };

  return (
    <div className="border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* 任务头部信息 */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* 状态和时间 */}
          <div className="flex items-center space-x-2 mb-2">
            {getStatusIcon(task.status)}
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
              {getStatusText(task.status)}
            </span>
            <span className="text-xs text-secondary-500">
              {formatDate(task.createdAt)}
            </span>
          </div>

          {/* 文本预览 */}
          <p className="text-sm text-secondary-700 line-clamp-2 mb-2">
            {task.text}
          </p>

          {/* 任务信息 */}
          <div className="flex items-center space-x-4 text-xs text-secondary-500">
            {task.duration && (
              <span>耗时: {formatDuration(task.duration)}</span>
            )}
            {task.audioUrl && (
              <span>已生成音频</span>
            )}
            {task.progress !== undefined && task.status === 'processing' && (
              <span>进度: {Math.round(task.progress)}%</span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {showDetails ? '收起' : '详情'}
          </button>
          
          <button
            onClick={() => onDelete(task.id)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 详细信息 */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-secondary-200 space-y-4">
          {/* 参数信息 */}
          {task.params && (
            <div>
              <h5 className="text-sm font-medium text-secondary-800 mb-2">生成参数</h5>
              <div className="grid grid-cols-2 gap-2 text-xs text-secondary-600">
                <div>温度: {task.params.temperature}</div>
                <div>Top-p: {task.params.top_p}</div>
                <div>Top-k: {task.params.top_k}</div>
                <div>束搜索: {task.params.num_beams}</div>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {task.error && (
            <div>
              <h5 className="text-sm font-medium text-red-800 mb-2">错误信息</h5>
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {task.error}
              </p>
            </div>
          )}

          {/* 音频播放器 */}
          {task.audioUrl && task.status === 'completed' && (
            <div>
              <h5 className="text-sm font-medium text-secondary-800 mb-2">生成的音频</h5>
              <AudioWaveform
                audioUrl={task.audioUrl}
                title={`任务 ${task.id.slice(0, 8)}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const TaskHistory: React.FC = () => {
  const { taskHistory, clearTaskHistory, removeTaskFromHistory } = useTTSStore();

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('确定要删除这个任务记录吗？')) {
      removeTaskFromHistory(taskId);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清除所有任务记录吗？此操作不可恢复。')) {
      clearTaskHistory();
    }
  };

  // 按时间倒序排列
  const sortedTasks = [...taskHistory].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="card">
      {/* 标题和操作 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-primary-600" />
          <span>任务历史</span>
          <span className="text-sm font-normal text-secondary-500">
            ({taskHistory.length})
          </span>
        </h3>

        {taskHistory.length > 0 && (
          <button
            onClick={handleClearAll}
            className="btn-secondary text-sm flex items-center space-x-1"
          >
            <Trash2 className="w-4 h-4" />
            <span>清空历史</span>
          </button>
        )}
      </div>

      {/* 任务列表 */}
      {taskHistory.length === 0 ? (
        <div className="text-center py-8 text-secondary-500">
          <History className="w-12 h-12 mx-auto mb-3 text-secondary-300" />
          <p>暂无任务历史</p>
          <p className="text-sm mt-1">完成的TTS任务将在这里显示</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      )}

      {/* 统计信息 */}
      {taskHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-secondary-200">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-lg font-semibold text-green-600">
                {taskHistory.filter(t => t.status === 'completed').length}
              </div>
              <div className="text-secondary-600">成功</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-600">
                {taskHistory.filter(t => t.status === 'error').length}
              </div>
              <div className="text-secondary-600">失败</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-600">
                {taskHistory.filter(t => t.status === 'processing').length}
              </div>
              <div className="text-secondary-600">进行中</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};