/**
 * 统一的WebSocket服务类
 * 负责管理连接、消息处理和状态同步
 */

import { WebSocketClient, WebSocketMessage } from '../utils/websocket';
import { getWebSocketUrl } from '../utils/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface TTSTask {
  id: string;
  status: TaskStatus;
  progress: number;
  message: string;
  result?: string;
  startTime: number;
  createdAt: number;
  error?: string;
  audioUrl?: string;
}

export interface WebSocketServiceConfig {
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onTaskUpdate?: (task: TTSTask) => void;
  onTaskComplete?: (task: TTSTask) => void;
  onTaskError?: (task: TTSTask) => void;
  onProgress?: (taskId: string, progress: number, message: string) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: (clientId: string) => void;
}

export class WebSocketService {
  private wsClient: WebSocketClient | null = null;
  private clientId: string | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private currentTask: TTSTask | null = null;
  private config: WebSocketServiceConfig;
  private heartbeatTimer: number | null = null;
  private heartbeatInterval = 30000; // 30秒

  constructor(config: WebSocketServiceConfig) {
    this.config = config;
  }

  /**
   * 初始化并连接WebSocket
   */
  async connect(clientId: string): Promise<void> {
    if (!clientId) {
      throw new Error('Client ID is required for WebSocket connection');
    }

    // 如果已经连接到同一个clientId，跳过
    if (this.clientId === clientId && this.connectionStatus === 'connected') {
      console.log(`WebSocket已连接到客户端: ${clientId}`);
      return;
    }

    // 如果正在连接中，避免重复连接
    if (this.connectionStatus === 'connecting' && this.clientId === clientId) {
      console.log(`WebSocket正在连接中: ${clientId}`);
      return;
    }

    // 如果连接到不同clientId，断开现有连接
    if (this.wsClient && this.clientId !== clientId) {
      console.log(`切换客户端: ${this.clientId} -> ${clientId}`);
      this.disconnect();
    }

    this.clientId = clientId;
    this.connectionStatus = 'connecting';
    this.config.onConnectionStatusChange?.('connecting');

    try {
      const wsUrl = getWebSocketUrl(clientId);
      console.log(`开始WebSocket连接: ${wsUrl}`);

      this.wsClient = new WebSocketClient({ url: wsUrl });

      // 设置事件监听器
      this.setupEventListeners();

      // 连接WebSocket
      await this.wsClient.connect();

    } catch (error) {
      this.connectionStatus = 'error';
      this.config.onConnectionStatusChange?.('error');
      console.error('WebSocket连接失败:', error);
      throw error;
    }
  }

  /**
   * 设置WebSocket事件监听器
   */
  private setupEventListeners(): void {
    if (!this.wsClient) return;

    const currentClientId = this.clientId!;

    // 连接成功
    this.wsClient.on('connection:open', () => {
      this.connectionStatus = 'connected';
      this.config.onConnectionStatusChange?.('connected');
      this.config.onConnect?.(currentClientId);
      this.startHeartbeat();
      console.log(`✅ WebSocket连接成功: ${currentClientId}`);
    });

    // 连接断开
    this.wsClient.on('connection:close', () => {
      this.connectionStatus = 'disconnected';
      this.config.onConnectionStatusChange?.('disconnected');
      this.config.onDisconnect?.(currentClientId);
      this.stopHeartbeat();
      console.log(`❌ WebSocket连接断开: ${currentClientId}`);
    });

    // 连接错误
    this.wsClient.on('connection:error', (error) => {
      this.connectionStatus = 'error';
      this.config.onConnectionStatusChange?.('error');
      console.error(`🚫 WebSocket连接错误: ${currentClientId}`, error);
    });

    // 任务开始
    this.wsClient.on('start', (message: any) => {
      console.log('📥 收到start消息:', message);

      // 支持两种字段名：task_id（向后兼容）和 unique_task_id（新版本）
      const taskId = message.task_id || message.unique_task_id;

      if (taskId) {
        const task: TTSTask = {
          id: taskId,
          status: 'processing',
          progress: 0,
          message: message.message || '开始生成...',
          result: undefined,
          startTime: Date.now(),
          createdAt: Date.now()
        };

        console.log('✅ 创建任务:', task);
        this.currentTask = task;
        this.config.onTaskUpdate?.(task);
        console.log(`📌 任务开始通知: ${task.id}`);
      } else {
        console.log('❌ start消息缺少task_id');
      }
    });

    // 进度更新
    this.wsClient.on('progress', (message: any) => {
      console.log('📥 收到progress消息:', message);
      console.log('当前任务:', this.currentTask?.id);

      // 支持两种字段名：task_id（向后兼容）和 unique_task_id（新版本）
      const taskId = message.task_id || message.unique_task_id;

      if (taskId) {
        // 如果没有当前任务，创建一个新任务（处理没有收到start消息的情况）
        if (!this.currentTask || this.currentTask.id !== taskId) {
          console.log('🆕 自动创建任务（未收到start消息）');
          this.currentTask = {
            id: taskId,
            status: 'processing',
            progress: 0,
            message: '开始生成...',
            result: undefined,
            startTime: Date.now(),
            createdAt: Date.now()
          };
          this.config.onTaskUpdate?.(this.currentTask);
        }

        const updatedTask: TTSTask = {
          ...this.currentTask,
          progress: message.progress,
          message: message.message || '生成中...'
        };

        console.log('✅ 更新任务进度:', updatedTask.progress, updatedTask.message);
        this.currentTask = updatedTask;
        this.config.onTaskUpdate?.(updatedTask);
        this.config.onProgress?.(taskId, message.progress, message.message);
      } else {
        console.log('❌ progress消息缺少task_id');
      }
    });

    // 任务完成
    this.wsClient.on('complete', (message: any) => {
      console.log('📥 收到complete消息:', message);

      // 支持两种字段名：task_id（向后兼容）和 unique_task_id（新版本）
      const taskId = message.task_id || message.unique_task_id;

      if (taskId && message.result) {
        // 如果没有当前任务或任务ID不匹配，创建一个新任务
        if (!this.currentTask || this.currentTask.id !== taskId) {
          console.log('🆕 为完成消息创建新任务');
          this.currentTask = {
            id: taskId,
            status: 'processing',
            progress: 100,
            message: '生成完成',
            result: message.result,
            startTime: Date.now(),
            createdAt: Date.now()
          };
        }

        const completedTask: TTSTask = {
          ...this.currentTask,
          status: 'completed',
          progress: 100,
          result: message.result,
          audioUrl: message.result.startsWith('/') ? `http://127.0.0.1:8000${message.result}` : message.result,
          message: '生成完成'
        };

        // 更新内部状态
        this.currentTask = completedTask;

        // 只通知任务完成，避免重复调用update
        this.config.onTaskComplete?.(completedTask);

        console.log(`✅ WebSocket任务完成: ${completedTask.id}`, completedTask.status, completedTask.progress);
      } else {
        console.log('❌ complete消息不完整:', {
          hasTaskId: !!message.task_id,
          hasResult: !!message.result,
          currentTaskId: this.currentTask?.id
        });
      }
    });

    // 任务错误
    this.wsClient.on('error', (message: any) => {
      console.log('📥 收到error消息:', message);

      // 支持两种字段名：task_id（向后兼容）和 unique_task_id（新版本）
      const taskId = message.task_id || message.unique_task_id;

      if (taskId) {
        // 如果没有当前任务或任务ID不匹配，创建一个新任务
        if (!this.currentTask || this.currentTask.id !== taskId) {
          console.log('🆕 为错误消息创建新任务');
          this.currentTask = {
            id: taskId,
            status: 'processing',
            progress: 0,
            message: '生成中...',
            result: undefined,
            startTime: Date.now(),
            createdAt: Date.now()
          };
        }

        const errorTask: TTSTask = {
          ...this.currentTask,
          status: 'error',
          error: message.error || '生成失败',
          message: '生成失败'
        };

        this.currentTask = errorTask;
        this.config.onTaskUpdate?.(errorTask);
        this.config.onTaskError?.(errorTask);
        console.error(`🚫 任务失败: ${errorTask.id} - ${errorTask.error}`);
      } else {
        console.log('❌ error消息缺少task_id');
      }
    });

    // 心跳响应
    this.wsClient.on('pong', () => {
      // 心跳响应已收到，连接正常
      console.debug('收到心跳响应');
    });
  }

  /**
   * 开始心跳机制
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      if (this.wsClient?.isConnected) {
        try {
          this.wsClient.send({ type: 'ping', timestamp: Date.now() });
        } catch (error) {
          console.error('心跳发送失败:', error);
          this.disconnect();
        }
      } else {
        console.log('WebSocket未连接，停止心跳');
        this.disconnect();
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳机制
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.wsClient) {
      try {
        this.wsClient.disconnect();
      } catch (error) {
        console.error('WebSocket断开失败:', error);
      }

      this.wsClient = null;
    }

    this.connectionStatus = 'disconnected';
    this.config.onConnectionStatusChange?.('disconnected');

    if (this.clientId) {
      const oldClientId = this.clientId;
      this.clientId = null;
      this.config.onDisconnect?.(oldClientId);
    }

    this.currentTask = null;
  }

  /**
   * 发送消息
   */
  sendMessage(message: any): boolean {
    if (this.wsClient?.isConnected) {
      try {
        this.wsClient.send(message);
        return true;
      } catch (error) {
        console.error('发送消息失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * 获取当前任务
   */
  getCurrentTask(): TTSTask | null {
    return this.currentTask;
  }

  /**
   * 获取客户端ID
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.wsClient?.isConnected;
  }
}