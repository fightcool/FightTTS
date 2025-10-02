import { Theme } from '../../../types/audio';

// 浅色主题
export const lightTheme: Theme = {
  name: 'light',
  displayName: '浅色主题',
  colors: {
    primary: '#3b82f6',
    secondary: '#e2e8f0',
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    text: '#1f2937',
    textSecondary: '#6b7280',
    accent: '#10b981',
    accentHover: '#059669',
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12
  },
  typography: {
    xs: {
      heading: 'text-xl font-semibold',
      body: 'text-sm',
      caption: 'text-xs'
    },
    sm: {
      heading: 'text-2xl font-semibold',
      body: 'text-base',
      caption: 'text-sm'
    },
    md: {
      heading: 'text-3xl font-semibold',
      body: 'text-lg',
      caption: 'text-base'
    },
    lg: {
      heading: 'text-4xl font-semibold',
      body: 'text-xl',
      caption: 'text-lg'
    },
    xl: {
      heading: 'text-5xl font-semibold',
      body: 'text-2xl',
      caption: 'text-xl'
    }
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  }
};

// 深色主题
export const darkTheme: Theme = {
  name: 'dark',
  displayName: '深色主题',
  colors: {
    primary: '#60a5fa',
    secondary: '#475569',
    background: '#1f2937',
    backgroundSecondary: '#374151',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    accent: '#34d399',
    accentHover: '#10b981',
    border: '#4b5563',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12
  },
  typography: {
    xs: {
      heading: 'text-xl font-semibold',
      body: 'text-sm',
      caption: 'text-xs'
    },
    sm: {
      heading: 'text-2xl font-semibold',
      body: 'text-base',
      caption: 'text-sm'
    },
    md: {
      heading: 'text-3xl font-semibold',
      body: 'text-lg',
      caption: 'text-base'
    },
    lg: {
      heading: 'text-4xl font-semibold',
      body: 'text-xl',
      caption: 'text-lg'
    },
    xl: {
      heading: 'text-5xl font-semibold',
      body: 'text-2xl',
      caption: 'text-xl'
    }
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  }
};

// 系统主题映射
export const systemThemes: Record<string, Theme> = {
  light: lightTheme,
  dark: darkTheme
};

// CSS 变量生成函数
export const generateThemeCSS = (theme: Theme): string => {
  const cssVars: string[] = [];

  // 生成颜色变量
  Object.entries(theme.colors).forEach(([key, value]) => {
    cssVars.push(`--color-${key}: ${value};`);
  });

  // 生成间距变量
  Object.entries(theme.spacing).forEach(([key, value]) => {
    cssVars.push(`--spacing-${key}: ${value}px;`);
  });

  // 生成圆角变量
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    cssVars.push(`--border-radius-${key}: ${value}px;`);
  });

  // 生成阴影变量
  Object.entries(theme.shadows).forEach(([key, value]) => {
    cssVars.push(`--shadow-${key}: ${value};`);
  });

  // 生成字体变量
  Object.entries(theme.typography).forEach(([size, fonts]) => {
    Object.entries(fonts).forEach(([type, className]) => {
      cssVars.push(`--font-${size}-${type}: ${className};`);
    });
  });

  return cssVars.join('\n');
};

// 应用主题到文档
export const applyThemeToDocument = (theme: Theme): void => {
  const root = document.documentElement;
  const cssVars = generateThemeCSS(theme);

  // 创建style元素
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    :root {
      ${cssVars}
    }
    body {
      background-color: ${theme.colors.background};
      color: ${theme.colors.text};
    }
    ${theme.name === 'dark' ? 'color-scheme: dark;' : ''}
  `;

  document.head.appendChild(styleElement);

  // 设置data属性供JS使用
  root.setAttribute('data-theme', theme.name);
};

// 检测系统主题偏好
export const getSystemTheme = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};