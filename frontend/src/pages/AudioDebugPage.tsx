/**
 * 音频调试页面
 * 用于诊断音频采样选择和播放问题
 */

import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { AudioSample } from '../types/audio';

export const AudioDebugPage: React.FC = () => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [selectedSample, setSelectedSample] = useState<AudioSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [playStatus, setPlayStatus] = useState<string>('未播放');

  // 加载音频样本
  const loadSamples = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.scanAudioSamples();
      const allSamples = [...result.voice_samples, ...result.emotion_samples];
      setSamples(allSamples);
      console.log('加载的样本:', allSamples);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载失败';
      setError(errorMsg);
      console.error('加载样本失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, []);

  // 测试音频播放
  const testAudioPlay = (sample: AudioSample) => {
    setSelectedSample(sample);
    setPlayStatus('准备播放...');
    
    console.log('=== 音频播放测试 ===');
    console.log('样本ID:', sample.id);
    console.log('样本名称:', sample.name);
    console.log('文件路径:', sample.filePath);
    console.log('文件名:', sample.fileName);
    console.log('完整样本对象:', sample);

    // 创建新的audio元素
    const audio = new Audio();
    
    audio.addEventListener('loadstart', () => {
      console.log('✓ 开始加载音频');
      setPlayStatus('开始加载...');
    });

    audio.addEventListener('loadedmetadata', () => {
      console.log('✓ 元数据加载完成');
      console.log('  时长:', audio.duration);
      setPlayStatus(`元数据加载完成 (时长: ${audio.duration.toFixed(2)}s)`);
    });

    audio.addEventListener('canplay', () => {
      console.log('✓ 可以播放');
      setPlayStatus('可以播放');
    });

    audio.addEventListener('playing', () => {
      console.log('✓ 正在播放');
      setPlayStatus('正在播放');
    });

    audio.addEventListener('error', (e) => {
      console.error('✗ 音频加载错误:', e);
      console.error('  错误代码:', audio.error?.code);
      console.error('  错误消息:', audio.error?.message);
      setPlayStatus(`错误: ${audio.error?.message || '未知错误'}`);
    });

    audio.addEventListener('ended', () => {
      console.log('✓ 播放结束');
      setPlayStatus('播放结束');
    });

    // 设置音频源并播放
    audio.src = sample.filePath;
    console.log('设置音频源:', audio.src);
    
    audio.play()
      .then(() => {
        console.log('✓ 播放开始');
        setAudioElement(audio);
      })
      .catch((err) => {
        console.error('✗ 播放失败:', err);
        setPlayStatus(`播放失败: ${err.message}`);
      });
  };

  // 停止播放
  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setPlayStatus('已停止');
    }
  };

  // 测试直接访问URL
  const testDirectAccess = (sample: AudioSample) => {
    console.log('=== 测试直接访问 ===');
    console.log('URL:', sample.filePath);
    
    fetch(sample.filePath)
      .then(response => {
        console.log('✓ HTTP响应状态:', response.status);
        console.log('  Content-Type:', response.headers.get('Content-Type'));
        console.log('  Content-Length:', response.headers.get('Content-Length'));
        return response.blob();
      })
      .then(blob => {
        console.log('✓ Blob大小:', blob.size, 'bytes');
        console.log('  Blob类型:', blob.type);
      })
      .catch(err => {
        console.error('✗ 访问失败:', err);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔧 音频调试工具
          </h1>
          <p className="text-gray-600 mb-4">
            用于诊断音频采样选择和播放问题
          </p>

          <div className="flex space-x-4 mb-4">
            <button
              onClick={loadSamples}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '加载中...' : '重新加载样本'}
            </button>
            
            {audioElement && (
              <button
                onClick={stopAudio}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                停止播放
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <p className="text-red-800">错误: {error}</p>
            </div>
          )}

          {selectedSample && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">当前选中:</h3>
              <p className="text-sm text-blue-800">名称: {selectedSample.name}</p>
              <p className="text-sm text-blue-800">路径: {selectedSample.filePath}</p>
              <p className="text-sm text-blue-800">状态: {playStatus}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            音频样本列表 ({samples.length})
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">加载中...</p>
            </div>
          ) : samples.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>没有找到音频样本</p>
            </div>
          ) : (
            <div className="space-y-2">
              {samples.map((sample) => (
                <div
                  key={sample.id}
                  className={`border rounded-lg p-4 ${
                    selectedSample?.id === sample.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{sample.name}</h3>
                      <p className="text-sm text-gray-600">ID: {sample.id}</p>
                      <p className="text-sm text-gray-600">分类: {sample.category} / {sample.subcategory}</p>
                      <p className="text-sm text-gray-600 break-all">路径: {sample.filePath}</p>
                      <p className="text-sm text-gray-600">文件名: {sample.fileName}</p>
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => testAudioPlay(sample)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm whitespace-nowrap"
                      >
                        🎵 播放测试
                      </button>
                      
                      <button
                        onClick={() => testDirectAccess(sample)}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm whitespace-nowrap"
                      >
                        🔗 URL测试
                      </button>
                      
                      <a
                        href={sample.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm text-center whitespace-nowrap"
                      >
                        🌐 浏览器打开
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            环境信息
          </h2>
          <div className="space-y-2 text-sm">
            <p><strong>开发模式:</strong> {import.meta.env.DEV ? '是' : '否'}</p>
            <p><strong>生产模式:</strong> {import.meta.env.PROD ? '是' : '否'}</p>
            <p><strong>Base URL:</strong> {import.meta.env.BASE_URL}</p>
            <p><strong>当前URL:</strong> {window.location.href}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioDebugPage;

