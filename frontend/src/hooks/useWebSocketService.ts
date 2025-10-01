/**
 * 简化的WebSocket Hook
 * 提供UI友好的接口，内部使用WebSocketService
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketService, ConnectionStatus, TTSTask } from '../services/WebSocketService';
import { useTTSStore } from '../store/ttsStore';

// 全局单例服务实例
let globalWebSocketService: WebSocketService | null = null;
let globalServiceInitCount = 0;

// 全局状态监听器列表
const statusListeners = new Set<(status: ConnectionStatus) => void>();

export const useWebSocketService = () => {
  const store = useTTSStore();
  const serviceRef = useRef<WebSocketService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  // 状态更新回调函数
  const statusCallback = useCallback((status: ConnectionStatus) => {
    // 只在开发环境或连接状态改变时输出日志
    if (process.env.NODE_ENV === 'development' || status !== connectionStatus) {
      console.log('状态更新回调:', status);
    }
    setConnectionStatus(status);
    setIsConnected(status === 'connected');
  }, [connectionStatus]);

  // 注册状态监听器
  useEffect(() => {
    statusListeners.add(statusCallback);

    return () => {
      statusListeners.delete(statusCallback);
    };
  }, [statusCallback]);

  // 创建或获取全局单例服务实例
  useEffect(() => {
    // 如果没有全局实例，创建一个
    if (!globalWebSocketService) {
      globalWebSocketService = new WebSocketService({
        onConnectionStatusChange: (status) => {
          // 减少日志输出，只在状态真正改变时记录
          console.log('全局连接状态变化:', status);
          // 通知所有监听器
          statusListeners.forEach(listener => listener(status));
        },
        onTaskUpdate: (task) => {
          console.log('📝 任务更新回调:', task);
          store.setCurrentTask(task);
        },
        onTaskComplete: (task) => {
          console.log('任务完成回调:', task.id, task.status, task.progress);
          // 使用store的completeTask方法来正确处理任务完成
          store.completeTask(task.id, task.result || task.audioUrl || '');
          store.setIsLoading(false);
        },
        onTaskError: (task) => {
          console.log('任务错误回调:', task.id, task.error);
          // 使用store的failTask方法来正确处理任务失败
          store.failTask(task.id, task.error || '任务失败');
          store.setIsLoading(false);
        },
        onProgress: (taskId, progress, message) => {
          store.updateTaskProgress(taskId, progress, message);
        },
        onConnect: (clientId) => {
          console.log('WebSocket已连接，客户端ID:', clientId);
        },
        onDisconnect: (clientId) => {
          console.log('WebSocket已断开，客户端ID:', clientId);
        }
      });
      console.log('创建全局WebSocketService实例');
    }

    // 引用全局实例
    serviceRef.current = globalWebSocketService;
    globalServiceInitCount++;

    // 清理函数
    return () => {
      globalServiceInitCount--;

      // 只有当没有任何组件使用时才销毁，增加防抖
      if (globalServiceInitCount <= 0 && globalWebSocketService) {
        // 延迟销毁，避免快速重新创建
        setTimeout(() => {
          if (globalServiceInitCount <= 0 && globalWebSocketService) {
            console.log('销毁全局WebSocketService实例');
            globalWebSocketService.disconnect();
            globalWebSocketService = null;
            globalServiceInitCount = 0;
          }
        }, 1000); // 1秒延迟
      }
    };
  }, []); // 空依赖数组，只运行一次

  const service = serviceRef.current;

  // 连接WebSocket
  const connect = useCallback(async (clientId: string) => {
    if (!service) throw new Error('WebSocket service not initialized');

    try {
      await service.connect(clientId);
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      throw error;
    }
  }, [service]);

  // 断开WebSocket
  const disconnect = useCallback(() => {
    if (service) {
      service.disconnect();
    }
  }, [service]);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    return service?.sendMessage(message) ?? false;
  }, [service]);

  // 自动连接逻辑 - 使用独立的effect，但避免重复触发
  useEffect(() => {
    const currentClientId = store.clientId;

    if (currentClientId && !isConnected && service && connectionStatus !== 'connecting') {
      console.log('触发自动连接，客户端ID:', currentClientId, '当前状态:', connectionStatus);
      // 延迟连接，避免快速重连
      const timer = setTimeout(() => {
        // 再次检查状态，避免重复连接
        if (!isConnected && connectionStatus !== 'connecting') {
          connect(currentClientId).catch(error => {
            console.error('自动连接失败:', error);
          });
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [store.clientId, isConnected, connectionStatus, service, connect]);

  // 页面可见性变化时的重连逻辑
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentClientId = store.clientId;

      if (document.visibilityState === 'visible' && currentClientId && !isConnected && service) {
        console.log('页面重新可见，尝试重连WebSocket');
        setTimeout(() => {
          connect(currentClientId).catch(error => {
          console.error('页面可见性重连失败:', error);
          // 不显示错误给用户，静默处理
        });
      }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [store.clientId, isConnected, service, connect]);

  return {
    // 连接状态
    isConnected,
    connectionStatus,

    // 连接方法
    connect,
    disconnect,

    // 消息方法
    sendMessage,

    // 服务实例方法
    getCurrentTask: () => service?.getCurrentTask() ?? null,
    getClientId: () => service?.getClientId() ?? null
  };
};