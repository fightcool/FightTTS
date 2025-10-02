import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Theme, ThemeMode } from '../../../types/audio';
import { lightTheme, darkTheme, systemThemes } from './themes';
import { generateThemeCSS, applyThemeToDocument, getSystemTheme } from './themes';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  updateTheme: (customTheme: Partial<Theme>) => void;
  registerTheme: (id: string, theme: Theme) => void;
  getTheme: (id: string) => Theme | null;
  removeTheme: (id: string) => void;
  listThemes: () => Theme[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultTheme?: Theme;
  onThemeChange?: (theme: Theme, mode: ThemeMode) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'auto',
  defaultTheme,
  onThemeChange
}) => {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const [theme, setTheme] = useState<Theme>(() => defaultTheme || (defaultMode === 'dark' ? darkTheme : lightTheme));
  const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({});

  // 确定初始主题
  useEffect(() => {
    if (!defaultTheme && mode === 'auto') {
      const systemTheme = getSystemTheme();
      setTheme(systemThemes[systemTheme]);
    }
  }, [defaultTheme, mode]);

  // 初始化自定义主题
  useEffect(() => {
    const initialThemes: Record<string, Theme> = {};
    if (defaultTheme) {
      initialThemes['custom'] = { ...defaultTheme };
      setCustomThemes(initialThemes);
    }
    setCustomThemes(initialThemes);
  }, [defaultTheme]);

  // 处理模式变化
  const handleModeChange = useCallback((newMode: ThemeMode) => {
    setMode(newMode);

    if (newMode === 'auto') {
      const systemTheme = getSystemTheme();
      setTheme(systemThemes[systemTheme]);
    } else {
      setTheme(systemThemes[newMode]);
    }

    // 保存到本地存储
    localStorage.setItem('audio-theme-mode', newMode);
  }, []);

  // 处理主题变化
  const handleThemeUpdate = useCallback((customTheme: Partial<Theme>) => {
    const updatedTheme = { ...theme, ...customTheme };
    setTheme(updatedTheme);
    setCustomThemes(prev => ({ ...prev, custom: { ...prev.custom, ...customTheme } }));

    // 保存到本地存储
    localStorage.setItem('audio-theme-custom', JSON.stringify(updatedTheme));
  }, [theme]);

  // 注册新主题
  const registerTheme = useCallback((id: string, newTheme: Theme) => {
    setCustomThemes(prev => ({ ...prev, [id]: newTheme }));
    localStorage.setItem(`audio-theme-${id}`, JSON.stringify(newTheme));
  }, []);

  // 获取主题
  const getRegisteredTheme = useCallback((id: string): Theme | null => {
    return customThemes[id] || null;
  }, [customThemes]);

  // 移除主题
  const removeTheme = useCallback((id: string) => {
    setCustomThemes(prev => {
      const newThemes = { ...prev };
      delete newThemes[id];
      return newThemes;
    });
    localStorage.removeItem(`audio-theme-${id}`);
  }, []);

  // 列出所有主题
  const listAllThemes = useCallback((): Theme[] => {
    return [
      ...Object.values(systemThemes),
      ...Object.values(customThemes)
    ];
  }, [customThemes]);

  // 应用主题到文档
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // 监听系统主题变化（仅在auto模式下）
  useEffect(() => {
    if (mode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        setTheme(systemThemes[systemTheme]);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  // 从本地存储恢复设置
  useEffect(() => {
    const savedMode = localStorage.getItem('audio-theme-mode') as ThemeMode | null;
    if (savedMode) {
      setMode(savedMode);
    }

    const savedCustomTheme = localStorage.getItem('audio-theme-custom');
    if (savedCustomTheme) {
      try {
        const parsed = JSON.parse(savedCustomTheme);
        setCustomThemes(parsed);

        // 恢复最后使用的自定义主题
        const lastUsedThemeId = localStorage.getItem('audio-theme-last-custom');
        if (lastUsedThemeId && parsed[lastUsedThemeId]) {
          setTheme(parsed[lastUsedId]);
        }
      } catch (error) {
        console.warn('Failed to load custom theme:', error);
      }
    }
  }, []);

  // 保存主题变化
  useEffect(() => {
    onThemeChange?.(theme, mode);
  }, [theme, mode, onThemeChange]);

  const value: ThemeContextValue = {
    theme,
    mode,
    setTheme: handleModeChange,
    updateTheme: handleThemeUpdate,
    registerTheme,
    getTheme: getRegisteredTheme,
    removeTheme,
    listThemes: listAllThemes
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;