import React, { useEffect, useState } from 'react';
import { BookOpen, Play, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';
import { api, ExampleCase } from '../utils/api';

export const ExampleCases: React.FC = () => {
  const { 
    examples, 
    setExamples, 
    setInputText, 
    updateTTSParams,
    isLoading,
    setIsLoading 
  } = useTTSStore();
  
  const [loadError, setLoadError] = useState<string>('');
  const [selectedExample, setSelectedExample] = useState<string>('');

  // 加载示例案例
  const loadExamples = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await api.getExamples();
      if (response.examples && Array.isArray(response.examples)) {
        setExamples(response.examples);
      } else {
        setLoadError('示例数据格式错误');
      }
    } catch (error) {
      console.error('加载示例失败:', error);
      setLoadError('加载示例失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载示例
  useEffect(() => {
    if (examples.length === 0) {
      loadExamples();
    }
  }, []);

  // 应用示例
  const applyExample = (example: ExampleCase) => {
    // 设置文本
    setInputText(example.text);
    
    // 应用参数（如果有）
    if (example.params) {
      updateTTSParams(example.params);
    }
    
    setSelectedExample(example.id);
    
    // 3秒后清除选中状态
    setTimeout(() => {
      setSelectedExample('');
    }, 3000);
  };

  // 复制文本
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加一个toast提示
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 获取标签颜色
  const getTagColor = (tag: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
    ];
    
    // 基于标签内容选择颜色
    const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="card">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <span>示例案例</span>
          {examples.length > 0 && (
            <span className="text-sm font-normal text-secondary-500">
              ({examples.length})
            </span>
          )}
        </h3>

        <button
          onClick={loadExamples}
          disabled={isLoading}
          className="btn-secondary text-sm flex items-center space-x-1"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && examples.length === 0 && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-secondary-400 animate-spin" />
          <p className="text-secondary-600">加载示例中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {loadError && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* 示例列表 */}
      {examples.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {examples.map((example) => (
            <div
              key={example.id}
              className={`border rounded-lg p-4 transition-all duration-200 ${
                selectedExample === example.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-secondary-200 hover:border-secondary-300 hover:shadow-sm'
              }`}
            >
              {/* 标题和描述 */}
              <div className="mb-3">
                <h4 className="font-medium text-secondary-900 mb-1">
                  {example.title}
                </h4>
                {example.description && (
                  <p className="text-sm text-secondary-600">
                    {example.description}
                  </p>
                )}
              </div>

              {/* 文本内容 */}
              <div className="mb-3">
                <p className="text-sm text-secondary-700 bg-secondary-50 p-3 rounded border-l-4 border-primary-500 line-clamp-3">
                  {example.text}
                </p>
              </div>

              {/* 标签 */}
              {example.tags && example.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {example.tags.map((tag, index) => (
                    <span
                      key={`${example.id}-tag-${index}-${tag}`}
                      className={`text-xs px-2 py-1 rounded-full ${getTagColor(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 参数信息 */}
              {example.params && (
                <div className="mb-3 text-xs text-secondary-600">
                  <span className="font-medium">推荐参数: </span>
                  {Object.entries(example.params).map(([key, value], index) => (
                    <React.Fragment key={`${example.id}-param-${key}`}>
                      {index > 0 && ', '}
                      <span>{key}: {String(value)}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => applyExample(example)}
                    className="btn-primary text-sm flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>使用此示例</span>
                  </button>
                  
                  <button
                    onClick={() => copyText(example.text)}
                    className="btn-secondary text-sm flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>复制文本</span>
                  </button>
                </div>

                <span className="text-xs text-secondary-500">
                  {example.text.length} 字符
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !loadError && examples.length === 0 && (
        <div className="text-center py-8 text-secondary-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-secondary-300" />
          <p>暂无示例案例</p>
          <p className="text-sm mt-1">点击刷新按钮重新加载</p>
        </div>
      )}
    </div>
  );
};