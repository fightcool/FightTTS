/**
 * 应用配置管理
 * 根据环境变量提供不同的配置
 */

export const APP_CONFIG = {
  development: {
    apiBaseURL: '',
    wsBaseURL: 'ws://localhost:5173',
    enableDebugLogs: true,
    enableMockData: false,
    requestTimeout: 30000,
    websocketTimeout: 10000,
    maxReconnectAttempts: 3,
    heartbeatInterval: 30000,
    logLevel: 'debug' as const,
  },
  production: {
    apiBaseURL: '',
    wsBaseURL: '',
    enableDebugLogs: false,
    enableMockData: false,
    requestTimeout: 10000,
    websocketTimeout: 5000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    logLevel: 'error' as const,
  }
} as const;

export const config = APP_CONFIG[import.meta.env.MODE as keyof typeof APP_CONFIG] || APP_CONFIG.development;

// 日志工具
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (config.enableDebugLogs && config.logLevel === 'debug') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (config.enableDebugLogs && ['debug', 'info'].includes(config.logLevel)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (config.enableDebugLogs && ['debug', 'info', 'warn'].includes(config.logLevel)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

// API配置
export const API_CONFIG = {
  baseURL: config.apiBaseURL,
  timeout: config.requestTimeout,
  headers: {
    'Content-Type': 'application/json',
  }
};

// WebSocket配置
export const WS_CONFIG = {
  baseURL: config.wsBaseURL,
  timeout: config.websocketTimeout,
  maxReconnectAttempts: config.maxReconnectAttempts,
  heartbeatInterval: config.heartbeatInterval
};