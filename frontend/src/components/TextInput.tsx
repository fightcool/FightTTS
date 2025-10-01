import React, { useState, useRef } from 'react';
import { Type, Upload, FileText, Scissors, AlertCircle } from 'lucide-react';
import { useTTSStore } from '../store/ttsStore';
import { api } from '../utils/api';

export const TextInput: React.FC = () => {
  const {
    inputText,
    setInputText,
    ttsParams,
    textSegments,
    setTextSegments,
    isLoading,
    setIsLoading
  } = useTTSStore();
  
  const [segmentError, setSegmentError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文本变化
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    
    // 清除之前的分段结果
    if (textSegments.length > 0) {
      setTextSegments([]);
    }
  };

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
      setSegmentError('请选择文本文件 (.txt)');
      return;
    }

    // 检查文件大小 (最大 1MB)
    if (file.size > 1024 * 1024) {
      setSegmentError('文件大小不能超过 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      setTextSegments([]);
      setSegmentError('');
    };
    reader.onerror = () => {
      setSegmentError('文件读取失败');
    };
    reader.readAsText(file, 'utf-8');
  };

  // 文本分段
  const handleSegmentText = async () => {
    if (!inputText.trim()) {
      setSegmentError('请先输入文本');
      return;
    }

    setIsLoading(true);
    setSegmentError('');

    try {
      const response = await api.segmentText({ 
        text: inputText.trim(),
        max_tokens: ttsParams.max_text_tokens_per_segment 
      });
      
      if (response.segments && response.segments.length > 0) {
        setTextSegments(response.segments);
        setSegmentError('');
      } else {
        setSegmentError('文本分段失败，请检查文本内容');
      }
    } catch (error) {
      console.error('文本分段错误:', error);
      setSegmentError('文本分段失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 清除文本
  const handleClearText = () => {
    setInputText('');
    setTextSegments([]);
    setSegmentError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900 flex items-center space-x-2">
          <Type className="w-5 h-5 text-primary-600" />
          <span>文本输入</span>
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* 文件上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-sm flex items-center space-x-1"
            disabled={isLoading}
          >
            <Upload className="w-4 h-4" />
            <span>上传文件</span>
          </button>
          
          {/* 清除按钮 */}
          {inputText && (
            <button
              onClick={handleClearText}
              className="btn-secondary text-sm"
              disabled={isLoading}
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 文本输入区域 */}
      <div className="space-y-4">
        <textarea
          value={inputText}
          onChange={handleTextChange}
          placeholder="请输入要合成语音的文本内容，或点击上传文件按钮选择文本文件..."
          className="w-full h-32 p-3 border border-secondary-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isLoading}
        />

        {/* 文本统计信息 */}
        <div className="flex items-center justify-between text-sm text-secondary-600">
          <span>字符数: {inputText.length}</span>
          <span>预估时长: ~{Math.ceil(inputText.length / 10)}秒</span>
        </div>

        {/* 分段按钮和状态 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSegmentText}
            disabled={!inputText.trim() || isLoading}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            <Scissors className="w-4 h-4" />
            <span>{isLoading ? '分段中...' : '智能分段'}</span>
          </button>

          {textSegments.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <FileText className="w-4 h-4" />
              <span>已分为 {textSegments.length} 段</span>
            </div>
          )}
        </div>

        {/* 错误信息 */}
        {segmentError && (
          <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{segmentError}</span>
          </div>
        )}

        {/* 分段预览 */}
        {textSegments.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-medium text-secondary-800 mb-3">文本分段预览</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {textSegments.map((segment, index) => (
                <div
                  key={index}
                  className="p-3 bg-secondary-50 rounded-lg border-l-4 border-primary-500"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary-600">
                      段落 {index + 1}
                    </span>
                    <span className="text-xs text-secondary-500">
                      {segment.content.length} 字符 | {segment.tokens} tokens
                    </span>
                  </div>
                  <p className="text-sm text-secondary-700 line-clamp-2">
                    {segment.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};