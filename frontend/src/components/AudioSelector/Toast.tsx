import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(message.id);
    }, message.duration || 3000);

    return () => clearTimeout(timer);
  }, [message.id, message.duration, onClose]);

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStyles = () => {
    switch (message.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div
      className={`max-w-sm w-full rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out ${getStyles()}`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium">{message.title}</h4>
          {message.message && (
            <p className="mt-1 text-sm opacity-90">{message.message}</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => onClose(message.id)}
            className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast容器组件
interface ToastContainerProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ messages, onRemove }) => {
  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((message) => (
        <Toast key={message.id} message={message} onClose={onRemove} />
      ))}
    </div>
  );
};

// Toast hook
export const useToast = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addMessage = (message: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    const newMessage: ToastMessage = {
      ...message,
      id,
    };
    setMessages((prev) => [...prev, newMessage]);
    return id;
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const toast = {
    success: (title: string, message?: string, duration?: number) =>
      addMessage({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      addMessage({ type: 'error', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
      addMessage({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      addMessage({ type: 'info', title, message, duration }),
  };

  return {
    messages,
    addMessage,
    removeMessage,
    toast,
  };
};

export default useToast;