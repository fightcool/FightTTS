import { Theme } from '../../../types/audio';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  updateTheme: (customTheme: Partial<Theme>) => void;
  registerTheme: (id: string, theme: Theme) => void;
  getTheme: (id: string) => Theme | null;
  removeTheme: (id: string) => void;
  listThemes: () => Theme[];
}