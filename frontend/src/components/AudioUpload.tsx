import React, { useRef, useState } from 'react';
import { Upload, X, FileAudio } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';

interface AudioUploadProps {
  label: string;
  accept?: string;
  maxSize?: number; // MB
  value?: File | null;
  onChange: (file: File | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({
  label,
  accept = '.wav,.mp3,.m4a,.flac',
  maxSize = 50,
  value,
  onChange,
  placeholder = '点击上传或拖拽音频文件到此处',
  required = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>('');

  const validateFile = (file: File): string | null => {
    // 检查文件类型
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/x-flac'];
    if (!allowedTypes.includes(file.type) && !accept.split(',').some(ext => file.name.toLowerCase().endsWith(ext.trim()))) {
      return '不支持的音频格式，请上传 WAV、MP3、M4A 或 FLAC 文件';
    }

    // 检查文件大小
    if (file.size > maxSize * 1024 * 1024) {
      return `文件大小不能超过 ${maxSize}MB`;
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    onChange(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    onChange(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 标签 */}
      <label className="block text-sm font-medium text-secondary-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 上传区域 */}
      {!value ? (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200
            ${isDragOver 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-secondary-300 hover:border-primary-400 hover:bg-secondary-50'
            }
            ${error ? 'border-red-300 bg-red-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <div className="space-y-3">
            <div className="flex justify-center">
              <Upload className={`w-8 h-8 ${error ? 'text-red-400' : 'text-secondary-400'}`} />
            </div>
            
            <div>
              <p className={`text-sm ${error ? 'text-red-600' : 'text-secondary-600'}`}>
                {placeholder}
              </p>
              <p className="text-xs text-secondary-500 mt-1">
                支持格式：{accept} | 最大大小：{maxSize}MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 文件预览区域 */
        <div className="space-y-4">
          {/* 文件信息 */}
          <div className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg border border-secondary-200">
            <div className="flex items-center space-x-3">
              <FileAudio className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-secondary-900">{value.name}</p>
                <p className="text-xs text-secondary-500">{formatFileSize(value.size)}</p>
              </div>
            </div>
            
            <button
              onClick={handleRemoveFile}
              className="flex items-center justify-center w-6 h-6 text-secondary-400 hover:text-red-500 transition-colors duration-200"
              title="移除文件"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* 音频波形预览 */}
          <AudioWaveform
            audioFile={value}
            height={60}
            className="bg-white"
            showControls={true}
          />
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <p className="text-sm text-red-600 flex items-center space-x-1">
          <span>⚠️</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};