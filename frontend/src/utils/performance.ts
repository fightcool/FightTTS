/**
 * 性能优化工具
 * 提供防抖、节流、记忆化等性能优化功能
 */

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 简单的记忆化函数
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// 异步记忆化函数
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  const pending = new Map<string, Promise<ReturnType<T>>>();

  return (async (...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    if (pending.has(key)) {
      return pending.get(key);
    }

    const promise = func(...args).then(result => {
      cache.set(key, result);
      pending.delete(key);
      return result;
    }).catch(error => {
      pending.delete(key);
      throw error;
    });

    pending.set(key, promise);
    return promise;
  }) as T;
}

// 文件大小格式化
export const formatFileSize = memoize((bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// 时间格式化
export const formatTime = memoize((time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// 音频URL生成（带缓存破坏）
export const generateAudioUrl = memoize(
  (baseUrl: string): string => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${Date.now()}`;
  }
);

// 深度比较对象
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// React Hook: 使用防抖值
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// React Hook: 使用节流值
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);

  useEffect(() => {
    const handler = throttle(() => {
      setThrottledValue(value);
    }, limit);

    handler();

    return () => {
      // 清理函数
    };
  }, [value, limit]);

  return throttledValue;
}

// 虚拟化列表计算
export function calculateVisibleItems<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
): { visibleItems: T[]; startIndex: number; endIndex: number; offsetY: number } {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length - 1
  );
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems: items.slice(startIndex, endIndex + 1),
    startIndex,
    endIndex,
    offsetY
  };
}

// 批量处理函数
export function batchProcess<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    let index = 0;

    const processBatch = async () => {
      try {
        if (index >= items.length) {
          resolve();
          return;
        }

        const batch = items.slice(index, index + batchSize);
        await processor(batch);
        index += batchSize;

        // 使用 setTimeout 让出控制权
        setTimeout(processBatch, 0);
      } catch (error) {
        reject(error);
      }
    };

    processBatch();
  });
}

// 内存使用监控
export function getMemoryUsage(): { used: number; total: number } {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize
    };
  }
  return { used: 0, total: 0 };
}

// 缓存管理
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 重新插入以更新访问顺序
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的项
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}