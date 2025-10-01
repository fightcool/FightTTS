/**
 * 用户友好的Toast提示组件
 * 替代原生alert，提供更好的用户体验
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose?: () => void;
  showProgress?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  type,
  title,
  message,
  duration = 5000,
  onClose,
  showProgress = true
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          return Math.max(0, newProgress);
        });
      }, 100);

      const timeout = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const getIcon = () => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertCircle className={`${iconClass} text-amber-500`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-300 ease-in-out
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className={`
        border rounded-lg shadow-lg p-4
        ${getStyles()}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>

          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium">
              {title}
            </h3>
            {message && (
              <p className="text-sm mt-1 opacity-90">
                {message}
              </p>
            )}
          </div>

          <button
            onClick={handleClose}
            className="ml-3 flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showProgress && duration > 0 && (
          <div className="mt-3">
            <div className="w-full bg-black/20 rounded-full h-1">
              <div
                className="h-1 bg-current rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Toast容器组件
export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // 暴露给全局使用
  useEffect(() => {
    (window as any).toast = {
      success: (title: string, message?: string, duration?: number) =>
        addToast({ type: 'success', title, message, duration }),
      error: (title: string, message?: string, duration?: number) =>
        addToast({ type: 'error', title, message, duration }),
      warning: (title: string, message?: string, duration?: number) =>
        addToast({ type: 'warning', title, message, duration }),
      info: (title: string, message?: string, duration?: number) =>
        addToast({ type: 'info', title, message, duration })
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Hook for using toast
export const useToast = () => {
  return {
    success: (title: string, message?: string, duration?: number) => {
      (window as any).toast?.success(title, message, duration);
    },
    error: (title: string, message?: string, duration?: number) => {
      (window as any).toast?.error(title, message, duration);
    },
    warning: (title: string, message?: string, duration?: number) => {
      (window as any).toast?.warning(title, message, duration);
    },
    info: (title: string, message?: string, duration?: number) => {
      (window as any).toast?.info(title, message, duration);
    }
  };
};