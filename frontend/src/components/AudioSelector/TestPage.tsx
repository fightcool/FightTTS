import React, { useState } from 'react';
import { ThemeProvider } from './theme';
import { AudioSelectorCompleteExample } from './AudioSelectorExample';

export const TestPage: React.FC = () => {
  const [showExample, setShowExample] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 测试页面标题 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">音频选择器测试页面</h1>
              <p className="text-gray-600 mt-1">测试新的音频选择系统功能</p>
            </div>
            <button
              onClick={() => setShowExample(!showExample)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {showExample ? '隐藏示例' : '显示示例'}
            </button>
          </div>
        </div>
      </div>

      {/* 测试内容 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {showExample && (
          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">完整示例演示</h2>
              <p className="text-blue-700">
                这是音频选择系统的完整功能演示，包含主题切换、实时预览、统计信息等所有功能。
              </p>
            </div>
            <ThemeProvider>
              <AudioSelectorCompleteExample />
            </ThemeProvider>
          </div>
        )}

        {/* 基础功能测试 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">功能检查清单</h3>
            <div className="space-y-3">
              {[
                '✅ 音频文件扫描和分类',
                '✅ 音色样本选择器',
                '✅ 情绪样本选择器',
                '✅ WaveSurfer波形显示',
                '✅ 音频播放控制',
                '✅ 搜索和筛选功能',
                '✅ 主题切换支持',
                '✅ 响应式设计',
                '✅ 错误处理机制',
                '✅ 类型安全保证'
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-green-600">{item.startsWith('✅') ? '✅' : '⏳'}</span>
                  <span className="text-gray-700">{item.substring(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API端点测试</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">音频扫描API</h4>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/audio-samples/scan');
                      const data = await response.json();
                      console.log('扫描结果:', data);
                      alert(`扫描成功！发现 ${data.total} 个音频文件`);
                    } catch (error) {
                      console.error('扫描失败:', error);
                      alert('扫描失败，请检查API服务器');
                    }
                  }}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                >
                  测试扫描API
                </button>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">文件列表API</h4>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/audio-samples/list?directory=voice_samples');
                      const data = await response.json();
                      console.log('文件列表:', data);
                      alert(`获取成功！${data.length} 个音色文件`);
                    } catch (error) {
                      console.error('获取失败:', error);
                      alert('获取失败，请检查API服务器');
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  测试列表API
                </button>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">音频文件访问</h4>
                <button
                  onClick={() => {
                    window.open('/audio-samples/', '_blank');
                  }}
                  className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                >
                  打开音频目录
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 集成说明 */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">集成说明</h3>
          <div className="prose max-w-none">
            <h4 className="text-md font-medium text-gray-800 mt-4">如何在主应用中使用</h4>
            <div className="bg-gray-50 rounded p-4 mt-2">
              <pre className="text-sm text-gray-700 overflow-x-auto">
{`import { EnhancedAudioSelector } from './components/EnhancedAudioSelector';

// 在主页面中使用
<EnhancedAudioSelector
  type="voice"
  label="音色参考"
  className="w-full"
/>

<EnhancedAudioSelector
  type="emotion"
  label="情绪参考"
  className="w-full"
/>`}
              </pre>
            </div>

            <h4 className="text-md font-medium text-gray-800 mt-4">配置音频文件</h4>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>将音频文件放置在 <code className="bg-gray-100 px-1 rounded">frontend/public/audio-samples/</code> 目录中</li>
              <li>音色文件放在 <code className="bg-gray-100 px-1 rounded">voice_samples/</code> 子目录</li>
              <li>情绪文件放在 <code className="bg-gray-100 px-1 rounded">emotion_samples/</code> 子目录</li>
              <li>遵循命名规则：<code className="bg-gray-100 px-1 rounded">{subcategory}_{number}.wav</code></li>
              <li>支持的格式：WAV、MP3、M4A、FLAC</li>
            </ul>

            <h4 className="text-md font-medium text-gray-800 mt-4">功能特性</h4>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>双模式支持：文件上传 + 音频选择器</li>
              <li>自动分类和标签系统</li>
              <li>实时音频预览和波形显示</li>
              <li>搜索和快速筛选功能</li>
              <li>主题切换支持</li>
              <li>完整的错误处理</li>
              <li>TypeScript类型安全</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;