import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';
import { useWebSocketService } from '../hooks/useWebSocketService';

export const ConnectionStatus: React.FC = () => {
  const { clientId } = useTTSStore();
  const { connectionStatus, connect } = useWebSocketService();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: '服务已连接',
          color: 'text-green-600 bg-green-50 border-green-200',
          iconColor: 'text-green-500'
        };
      case 'connecting':
        return {
          icon: <Loader className="w-4 h-4 animate-spin" />,
          text: '连接中',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          iconColor: 'text-yellow-500'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: '已断开',
          color: 'text-red-600 bg-red-50 border-red-200',
          iconColor: 'text-red-500'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: '连接错误',
          color: 'text-red-600 bg-red-50 border-red-200',
          iconColor: 'text-red-500'
        };
      default:
        return {
          icon: <Wifi className="w-4 h-4" />,
          text: '未知状态',
          color: 'text-secondary-600 bg-secondary-50 border-secondary-200',
          iconColor: 'text-secondary-500'
        };
    }
  };

  const handleReconnect = async () => {
    try {
      console.log('ConnectionStatus: 手动重新连接WebSocket');
      await connect(clientId);
    } catch (error) {
      console.error('ConnectionStatus: 重新连接失败:', error);
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border text-sm font-medium ${config.color}`}>
      <span className={config.iconColor}>
        {config.icon}
      </span>
      <span>{config.text}</span>
      {clientId && (
        <span className="text-xs opacity-75">
          ID: {clientId.slice(-8)}
        </span>
      )}
      {/* 添加重连按钮 */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
        <button
          onClick={handleReconnect}
          className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
          title="重新连接"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};