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
  // TTS生成 - 支持文件上传或样本ID
  generateTTS: (
    data: TTSRequest,
    clientId: string,
    options: {
      promptAudio?: File;
      emoAudio?: File;
      voiceSampleId?: string;
      emotionSampleId?: string;
      taskId?: string;
    }
  ) => {
    const formData = new FormData();

    // 添加必需的文本参数到FormData
    formData.append('text', data.text || '');
    formData.append('client_id', clientId);
    formData.append('task_id', options.taskId || `task_${Date.now()}`);

    // 添加文件（如果提供）
    if (options.promptAudio) {
      formData.append('prompt_audio', options.promptAudio);
    }
    if (options.emoAudio) {
      formData.append('emo_audio', options.emoAudio);
    }

    // 添加样本ID（如果提供）
    if (options.voiceSampleId) {
      formData.append('voice_sample_id', options.voiceSampleId);
    }
    if (options.emotionSampleId) {
      formData.append('emotion_sample_id', options.emotionSampleId);
    }

    // 添加所有TTS参数到FormData（而不是query参数）
    formData.append('emo_control_method', String(data.emo_control_method));
    formData.append('emo_weight', String(data.emo_weight));
    formData.append('emo_random', String(data.emo_random));
    formData.append('max_text_tokens_per_segment', String(data.max_text_tokens_per_segment));
    formData.append('do_sample', String(data.do_sample));
    formData.append('top_p', String(data.top_p));
    formData.append('top_k', String(data.top_k));
    formData.append('temperature', String(data.temperature));
    formData.append('length_penalty', String(data.length_penalty));
    formData.append('num_beams', String(data.num_beams));
    formData.append('repetition_penalty', String(data.repetition_penalty));
    formData.append('max_mel_tokens', String(data.max_mel_tokens));

    // 添加可选的文本和向量参数
    if (data.emo_text) {
      formData.append('emo_text', data.emo_text);
    }
    if (data.emo_vec) {
      formData.append('emo_vec', JSON.stringify(data.emo_vec));
    }

    // 直接发送FormData，不使用query参数
    return alovaInstance.Post('/api/tts/generate', formData, {
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
  },

  // ==================== 音频样本管理API ====================

  // 扫描音频样本
  scanAudioSamples: () => {
    return alovaInstance.Get<{
      voice_samples: any[];
      emotion_samples: any[];
      total: number;
    }>('/api/audio-samples/scan');
  },

  // 上传音频样本
  uploadAudioSample: (file: File, category: 'voice' | 'emotion', name?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (name) {
      formData.append('name', name);
    }

    return alovaInstance.Post('/api/audio-samples/upload', formData);
  },

  // 删除音频样本
  deleteAudioSample: (sampleId: string) => {
    return alovaInstance.Delete(`/api/audio-samples/${sampleId}`);
  },

  // 更新音频样本（重命名）
  updateAudioSample: (sampleId: string, newName: string) => {
    const formData = new FormData();
    formData.append('new_name', newName);

    return alovaInstance.Put(`/api/audio-samples/${sampleId}`, formData);
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