import { createAlova } from 'alova';
import adapterFetch from 'alova/fetch';
import ReactHook from 'alova/react';

// API基础配置
export const alovaInstance = createAlova({
  // 在开发环境中，使用相对路径，让Vite代理处理
  // 在生产环境中，使用完整的URL
  baseURL: import.meta.env.DEV ? '' : 'http://localhost:8000',
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  timeout: 30000,
  beforeRequest(method) {
    // 请求拦截器 - 只在开发环境输出关键请求
    if (import.meta.env.DEV && !method.url.includes('/api/stats')) {
      console.log('API Request:', method.url);
    }
  },
  responded: {
    onSuccess: async (response) => {
      // 响应成功拦截器
      if (response.status >= 400) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      return response.json();
    },
    onError: (error) => {
      // 响应错误拦截器
      console.error('API Error:', error);
      throw error;
    }
  }
});

// TTS请求参数接口
export interface TTSRequest {
  text: string;
  emo_control_method: number;
  emo_weight: number;
  emo_text?: string;
  emo_random: boolean;
  max_text_tokens_per_segment: number;
  // GPT2 采样参数
  do_sample: boolean;
  top_p: number;
  top_k: number;
  temperature: number;
  length_penalty: number;
  num_beams: number;
  repetition_penalty: number;
  max_mel_tokens: number;
  // 情感向量参数
  emo_vec?: number[];
}

// 文本分段参数
export interface TextSegmentRequest {
  text: string;
  max_tokens: number;
}

// 示例数据接口
export interface ExampleCase {
  id: string;
  title: string;
  text: string;
  prompt_audio?: string;
  emo_audio?: string;
  description?: string;
  params?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    emotion_weight?: number;
  };
  tags?: string[];
}

// 配置信息接口
export interface AppConfig {
  model_version: string;
  max_mel_tokens: number;
  max_text_tokens: number;
  languages: string[];
  emotion_choices: string[];
  model_name: string;
  device: string;
}

// API方法定义
export const api = {
  // TTS生成
  generateTTS: (data: TTSRequest, clientId: string, promptAudio: File, emoAudio?: File, taskId?: string) => {
    const formData = new FormData();

    // 添加文件
    formData.append('prompt_audio', promptAudio);
    if (emoAudio) {
      formData.append('emo_audio', emoAudio);
    }

    // 构建query参数
    const queryParams = new URLSearchParams({
      text: data.text || '',
      voice_name: 'default',
      client_id: clientId,
      // 添加可选参数
      temperature: String(data.temperature),
      top_p: String(data.top_p),
      top_k: String(data.top_k),
      emo_control_method: String(data.emo_control_method),
      emo_weight: String(data.emo_weight),
      emo_random: String(data.emo_random),
      max_text_tokens_per_segment: String(data.max_text_tokens_per_segment),
      do_sample: String(data.do_sample),
      length_penalty: String(data.length_penalty),
      num_beams: String(data.num_beams),
      repetition_penalty: String(data.repetition_penalty),
      max_mel_tokens: String(data.max_mel_tokens),
      // 添加可选的文本和向量参数
      ...(data.emo_text && { emo_text: data.emo_text }),
      ...(data.emo_vec && { emo_vec: JSON.stringify(data.emo_vec) })
    });

    // 发送FormData与query参数
    return alovaInstance.Post(`/api/tts/generate?${queryParams.toString()}`, formData, {
      headers: {
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      }
    });
  },

  // 文本分段
  segmentText: (data: TextSegmentRequest) => {
    const formData = new FormData();
    formData.append('text', data.text);
    formData.append('max_tokens', String(data.max_tokens));
    
    return alovaInstance.Post<{ segments: Array<{ index: number; content: string; tokens: number }> }>('/api/text/segment', formData);
  },

  // 获取示例
  getExamples: () => {
    return alovaInstance.Get<{ examples: ExampleCase[] }>('/api/examples');
  },

  // 获取配置
  getConfig: () => {
    return alovaInstance.Get<AppConfig>('/api/config');
  },

  // 健康检查
  healthCheck: () => {
    return alovaInstance.Get<{ message: string; version: string }>('/api/stats');
  }
};

// 工具函数
export const createClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getWebSocketUrl = (clientId: string): string => {
  // 在开发环境中，使用Vite代理连接WebSocket
  // 在生产环境中，使用相同的主机和协议
  const isDevelopment = import.meta.env.DEV;

  if (isDevelopment) {
    // 开发环境：使用Vite的WebSocket代理
    const wsUrl = `ws://localhost:5173/ws/${clientId}`;
    console.log(`构建WebSocket URL (开发环境): ${wsUrl}`);
    return wsUrl;
  } else {
    // 生产环境：动态获取当前页面的协议和主机
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${clientId}`;
    console.log(`构建WebSocket URL (生产环境): ${wsUrl}`);
    return wsUrl;
  }
};