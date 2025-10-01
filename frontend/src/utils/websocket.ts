export interface WebSocketMessage {
  type: 'start' | 'progress' | 'complete' | 'error' | 'ping' | 'pong' | 'heartbeat' | 'heartbeat_response' | 'heartbeat_check';
  task_id?: string;
  progress?: number;
  status?: string;
  message?: string;
  result?: string;
  timestamp?: number;
  connection_info?: any;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private connectionCheckTimer: number | null = null;
  private isConnecting = false;
  private isDestroyed = false;
  private lastHeartbeatTime = 0;
  private connectionStartTime = 0;
  private lastConnectionAttempt = 0; // 添加最后连接尝试时间
  private readonly MIN_CONNECTION_INTERVAL = 2000; // 最小连接间隔2秒
  
  private listeners: {
    [K in WebSocketMessage['type']]?: ((message: WebSocketMessage) => void)[]
  } = {};
  
  private connectionListeners: {
    open: (() => void)[];
    close: (() => void)[];
    error: ((error: Event) => void)[];
  } = {
    open: [],
    close: [],
    error: []
  };

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 3000,   // 重连间隔3秒，避免过于频繁
      maxReconnectAttempts: 3,   // 减少重连次数，避免过度重连
      heartbeatInterval: 30000,  // 心跳间隔30秒，匹配后端45秒超时
      connectionTimeout: 15000,  // 连接超时15秒
      ...config
    };
  }

  connect(): Promise<void> {
    if (this.isDestroyed) {
      return Promise.reject(new Error('WebSocket client has been destroyed'));
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket已经连接，跳过');
      return Promise.resolve();
    }

    if (this.isConnecting) {
      console.log('WebSocket正在连接中，跳过重复连接请求');
      return Promise.resolve();
    }

    // 连接频率限制检查
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastConnectionAttempt;
    if (timeSinceLastAttempt < this.MIN_CONNECTION_INTERVAL) {
      const waitTime = this.MIN_CONNECTION_INTERVAL - timeSinceLastAttempt;
      console.log(`=== 连接频率限制 ===`);
      console.log(`需要等待 ${waitTime}ms 后才能重新连接`);
      console.log(`上次连接时间: ${new Date(this.lastConnectionAttempt).toLocaleTimeString()}`);

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.connect().then(resolve).catch(reject);
        }, waitTime);
      });
    }

    this.lastConnectionAttempt = now;

    if (this.isConnecting) {
      console.log('正在连接中，等待完成');
      return new Promise((resolve, reject) => {
        const onOpen = () => {
          this.off('connection:open', onOpen);
          this.off('connection:error', onError);
          resolve();
        };
        const onError = (error: Event) => {
          this.off('connection:open', onOpen);
          this.off('connection:error', onError);
          reject(error);
        };
        this.on('connection:open', onOpen);
        this.on('connection:error', onError);
      });
    }

    return new Promise((resolve, reject) => {
      this.isConnecting = true;
      this.connectionStartTime = Date.now();
      
      // 设置连接超时
      const connectionTimeout = setTimeout(() => {
        if (this.isConnecting) {
          console.error('WebSocket连接超时');
          this.isConnecting = false;
          if (this.ws) {
            this.ws.close();
          }
          reject(new Error('Connection timeout'));
        }
      }, this.config.connectionTimeout);
      
      try {
        // 只在首次连接或重连时输出日志
        if (this.reconnectAttempts === 0) {
          console.log(`🔗 尝试WebSocket连接: ${this.config.url.split('/').pop()}`);
        } else {
          console.log(`🔄 重连WebSocket (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}): ${this.config.url.split('/').pop()}`);
        }

        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          const connectionTime = Date.now() - this.connectionStartTime;

          // 只在首次连接时显示详细信息
          if (this.reconnectAttempts === 0) {
            console.log(`✅ WebSocket连接成功 (${connectionTime}ms)`);
          } else {
            console.log(`✅ WebSocket重连成功 (${connectionTime}ms)`);
          }

          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.lastHeartbeatTime = Date.now();
          this.startHeartbeat();
          this.startConnectionMonitor();
          this.connectionListeners.open.forEach(listener => listener());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            // 更新心跳时间 - 任何消息都表示连接活跃
            this.lastHeartbeatTime = Date.now();

            // 只对重要消息输出日志，减少日志噪音
            if (message.type !== 'pong' && message.type !== 'heartbeat_response' && message.type !== 'heartbeat' && message.type !== 'heartbeat_check') {
              console.log(`📥 WebSocket接收: ${message.type}`);
            }

            this.handleMessage(message);
          } catch (error) {
            console.error('🚫 WebSocket消息解析失败:', error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          const connectionTime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
          console.log(`=== WebSocket连接断开 ===`);
          console.log(`断开代码: ${event.code}`);
          console.log(`断开原因: ${event.reason}`);
          console.log(`连接持续时间: ${connectionTime}ms`);
          console.log(`是否正常关闭: ${event.wasClean}`);
          
          this.isConnecting = false;
          this.stopHeartbeat();
          this.stopConnectionMonitor();
          this.connectionListeners.close.forEach(listener => listener());
          
          if (!this.isDestroyed && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            console.log(`准备重连，当前重连次数: ${this.reconnectAttempts}`);
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error(`=== 达到最大重连次数 ===`);
            console.error(`最大重连次数: ${this.config.maxReconnectAttempts}`);
            console.error(`当前重连次数: ${this.reconnectAttempts}`);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error(`=== WebSocket连接错误 ===`);
          console.error(`URL: ${this.config.url}`);
          console.error(`错误详情:`, error);
          console.error(`连接状态: ${this.ws?.readyState}`);
          
          this.isConnecting = false;
          this.connectionListeners.error.forEach(listener => listener(error));
          
          if (this.isConnecting) {
            reject(error);
          }
        };
      } catch (error) {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.error('WebSocket创建失败:', error);
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    const listeners = this.listeners[message.type];
    if (listeners) {
      listeners.forEach(listener => listener(message));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // 初始化心跳时间
    this.lastHeartbeatTime = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const now = Date.now();
        this.lastHeartbeatTime = now;

        // 使用简单的ping消息
        this.send({
          type: 'ping',
          timestamp: now
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startConnectionMonitor() {
    this.stopConnectionMonitor();

    // 每20秒检查一次连接状态
    this.connectionCheckTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.lastHeartbeatTime;

      // 只有在超过120秒没有收到任何消息时才认为连接异常
      if (timeSinceLastHeartbeat > 120000) {
        console.error('🚫 连接超时，强制重连');
        console.log(`距离上次消息: ${timeSinceLastHeartbeat}ms`);
        if (this.ws) {
          this.ws.close();
        }
      }
    }, 20000); // 每20秒检查一次连接状态
  }

  private stopConnectionMonitor() {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // 使用固定延迟，避免指数退避导致的长时间等待
    const baseDelay = this.config.reconnectInterval;
    const backoffDelay = Math.min(
      baseDelay * (this.reconnectAttempts + 1),
      10000 // 最大10秒
    );
    
    console.log(`=== 安排重连 ===`);
    console.log(`重连延迟: ${backoffDelay}ms`);
    console.log(`重连次数: ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`=== 开始重连 ===`);
      console.log(`重连次数: ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      
      this.connect().catch(error => {
        console.error(`=== 重连失败 ===`);
        console.error(`重连次数: ${this.reconnectAttempts}`);
        console.error(`错误:`, error);
      });
    }, backoffDelay);
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      // 只对非心跳消息输出日志
      if (message.type !== 'ping') {
        console.log(`📤 WebSocket发送: ${message.type}`);
      }
      this.ws.send(messageStr);
    } else {
      console.warn(`📤 WebSocket发送失败 (${message.type}): 状态 ${this.ws?.readyState}`);
    }
  }

  on<T extends WebSocketMessage['type']>(
    type: T, 
    listener: (message: WebSocketMessage & { type: T }) => void
  ): void;
  on(
    type: 'connection:open' | 'connection:close', 
    listener: () => void
  ): void;
  on(
    type: 'connection:error', 
    listener: (error: Event) => void
  ): void;
  on(type: string, listener: any): void {
    if (type.startsWith('connection:')) {
      const eventType = type.split(':')[1] as keyof typeof this.connectionListeners;
      if (eventType in this.connectionListeners) {
        this.connectionListeners[eventType].push(listener);
      }
    } else {
      const messageType = type as WebSocketMessage['type'];
      if (!this.listeners[messageType]) {
        this.listeners[messageType] = [];
      }
      this.listeners[messageType]!.push(listener);
    }
  }

  off<T extends WebSocketMessage['type']>(
    type: T, 
    listener: (message: WebSocketMessage & { type: T }) => void
  ): void;
  off(
    type: 'connection:open' | 'connection:close', 
    listener: () => void
  ): void;
  off(
    type: 'connection:error', 
    listener: (error: Event) => void
  ): void;
  off(type: string, listener: any): void {
    if (type.startsWith('connection:')) {
      const eventType = type.split(':')[1] as keyof typeof this.connectionListeners;
      if (eventType in this.connectionListeners) {
        const listeners = this.connectionListeners[eventType];
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      const messageType = type as WebSocketMessage['type'];
      const listeners = this.listeners[messageType];
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}