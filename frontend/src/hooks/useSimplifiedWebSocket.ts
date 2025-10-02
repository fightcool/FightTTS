/**
 * 简化的WebSocket Hook
 * 移除复杂的全局状态管理，专注于连接和消息处理
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketClient } from '../utils/websocket';
import { useTTSStore } from '../store/ttsStore';

export interface UseSimplifiedWebSocketOptions {
  onTaskStart?: (taskId: string) => void;
  onTaskProgress?: (taskId: string, progress: number, message: string) => void;
  onTaskComplete?: (taskId: string, result: string) => void;
  onTaskError?: (taskId: string, error: string) => void;
}

export const useSimplifiedWebSocket = (options: UseSimplifiedWebSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const store = useTTSStore();

  // 清理连接
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  // 创建连接
  const connect = useCallback(async (clientId: string) => {
    if (!clientId) return;

    cleanup(); // 先清理现有连接

    setConnectionStatus('connecting');

    try {
      const wsUrl = `ws://localhost:5173/ws/${clientId}`;

      wsClientRef.current = new WebSocketClient({
        url: wsUrl,
        reconnectInterval: 3000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 30000,
        connectionTimeout: 10000
      });

      // 设置事件监听
      wsClientRef.current.on('connection:open', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
      });

      wsClientRef.current.on('connection:close', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      wsClientRef.current.on('connection:error', () => {
        setIsConnected(false);
        setConnectionStatus('error');
      });

      // 任务消息处理
      wsClientRef.current.on('start', (message) => {
        const taskId = message.task_id;
        if (taskId) {
          options.onTaskStart?.(taskId);
          // 通知WebSocket客户端有活跃任务
          wsClientRef.current?.setActiveTask(true);
          // 创建任务状态
          store.setCurrentTask({
            id: taskId,
            status: 'processing',
            progress: 0,
            message: message.message || '开始生成...',
            startTime: Date.now(),
            createdAt: Date.now()
          });
        }
      });

      wsClientRef.current.on('progress', (message) => {
        const taskId = message.task_id;
        if (taskId) {
          options.onTaskProgress?.(taskId, message.progress || 0, message.message || '生成中...');
          store.updateTaskProgress(taskId, message.progress || 0, message.message || '生成中...');
        }
      });

      wsClientRef.current.on('complete', (message) => {
        const taskId = message.task_id;
        if (taskId && message.result) {
          options.onTaskComplete?.(taskId, message.result);
          store.completeTask(taskId, message.result);
          // 通知WebSocket客户端任务已完成
          wsClientRef.current?.setActiveTask(false);
        }
      });

      wsClientRef.current.on('error', (message) => {
        const taskId = message.task_id;
        if (taskId) {
          const error = message.error || '生成失败';
          options.onTaskError?.(taskId, error);
          store.failTask(taskId, error);
          // 通知WebSocket客户端任务已完成（失败）
          wsClientRef.current?.setActiveTask(false);
        }
      });

      // 开始连接
      await wsClientRef.current.connect();

    } catch (error) {
      console.error('WebSocket连接失败:', error);
      setConnectionStatus('error');

      // 自动重连
      reconnectTimeoutRef.current = setTimeout(() => {
        if (clientId) {
          connect(clientId);
        }
      }, 3000);
    }
  }, [store, options, cleanup]);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (wsClientRef.current?.isConnected) {
      wsClientRef.current.send(message);
      return true;
    }
    return false;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 页面可见性变化时的智能重连逻辑
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentClientId = store.clientId;

      // 只有在页面可见且没有连接时才考虑重连
      if (document.visibilityState === 'visible' && currentClientId && !isConnected && wsClientRef.current) {
        // 检查是否应该重连（避免不必要的重连）
        if (wsClientRef.current.shouldConnect()) {
          console.log('页面重新可见，智能重连WebSocket');
          setTimeout(() => {
            connect(currentClientId).catch(error => {
              console.error('页面可见性重连失败:', error);
            });
          }, 1000); // 延迟1秒重连，避免频繁重连
        } else {
          console.log('页面重新可见，但智能模式跳过重连');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [store.clientId, isConnected, connect]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect: cleanup,
    sendMessage
  };
};