/**
 * 优化的TTS状态管理
 * 分离关注点，减少调试日志，提高性能
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { TTSRequest, ExampleCase, AppConfig } from '../utils/api';

// 任务状态
export interface TTSTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  result?: string;
  startTime: number;
  createdAt: number;
  error?: string;
  audioUrl?: string;
}

// 分离的状态接口
interface AppState {
  clientId: string;
  isLoading: boolean;
  config: AppConfig | null;
  examples: ExampleCase[];
}

interface TaskState {
  currentTask: TTSTask | null;
  taskHistory: TTSTask[];
}

interface InputState {
  inputText: string;
  textSegments: Array<{ index: number; content: string; tokens: number }>;
  ttsParams: TTSRequest;
  promptAudio: File | null;
  emoAudio: File | null;
}

interface UIState {
  isGenerating: boolean;
  showAdvanced: boolean;
  selectedExample: ExampleCase | null;
}

// 合并的完整状态接口
interface OptimizedTTSState extends AppState, TaskState, InputState, UIState {
  // Actions
  setClientId: (clientId: string) => void;
  setIsLoading: (loading: boolean) => void;
  setConfig: (config: AppConfig) => void;
  setExamples: (examples: ExampleCase[]) => void;

  setCurrentTask: (task: TTSTask | null) => void;
  updateTaskProgress: (taskId: string, progress: number, message: string) => void;
  completeTask: (taskId: string, result: string) => void;
  failTask: (taskId: string, error: string) => void;
  addTaskToHistory: (task: TTSTask) => void;
  clearTaskHistory: () => void;
  removeTaskFromHistory: (taskId: string) => void;

  setInputText: (text: string) => void;
  updateTTSParams: (params: Partial<TTSRequest>) => void;
  setPromptAudio: (file: File | null) => void;
  setEmoAudio: (file: File | null) => void;
  setTextSegments: (segments: Array<{ index: number; content: string; tokens: number }>) => void;

  setGenerating: (generating: boolean) => void;
  setShowAdvanced: (show: boolean) => void;
  setSelectedExample: (example: ExampleCase | null) => void;

  reset: () => void;
}

// 默认TTS参数
const defaultTTSParams: TTSRequest = {
  text: '',
  emo_control_method: 0,
  emo_weight: 0.65,
  emo_text: '',
  emo_random: false,
  max_text_tokens_per_segment: 120,
  do_sample: true,
  top_p: 0.8,
  top_k: 30,
  temperature: 0.8,
  length_penalty: 0.0,
  num_beams: 3,
  repetition_penalty: 10.0,
  max_mel_tokens: 1500,
  emo_vec: undefined
};

export const useOptimizedTTSStore = create<OptimizedTTSState>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // 初始状态
        clientId: '',
        isLoading: false,
        config: null,
        examples: [],

        currentTask: null,
        taskHistory: [],

        inputText: '',
        textSegments: [],
        ttsParams: { ...defaultTTSParams },
        promptAudio: null,
        emoAudio: null,

        isGenerating: false,
        showAdvanced: false,
        selectedExample: null,

        // App Actions
        setClientId: (clientId) => set({ clientId }),
        setIsLoading: (loading) => set({ isLoading: loading }),
        setConfig: (config) => set({ config }),
        setExamples: (examples) => set({ examples }),

        // Task Actions
        setCurrentTask: (task) => set({ currentTask: task }),

        updateTaskProgress: (taskId, progress, message) =>
          set((state) => {
            if (state.currentTask?.id === taskId) {
              const updatedTask = {
                ...state.currentTask,
                progress,
                message,
                status: 'processing' as const
              };
              return { currentTask: updatedTask };
            }
            return state;
          }),

        completeTask: (taskId, result) =>
          set((state) => {
            if (state.currentTask?.id === taskId) {
              const audioUrl = result.startsWith('/') ? `http://127.0.0.1:8000${result}` : result;
              const completedTask: TTSTask = {
                ...state.currentTask,
                status: 'completed',
                progress: 100,
                result,
                audioUrl,
                message: '生成完成'
              };

              return {
                currentTask: completedTask,
                taskHistory: [completedTask, ...state.taskHistory.slice(0, 9)],
                isGenerating: false
              };
            }
            return state;
          }),

        failTask: (taskId, error) =>
          set((state) => {
            if (state.currentTask?.id === taskId) {
              const failedTask: TTSTask = {
                ...state.currentTask,
                status: 'error',
                error,
                message: '生成失败'
              };

              return {
                currentTask: null,
                taskHistory: [failedTask, ...state.taskHistory.slice(0, 9)],
                isGenerating: false
              };
            }
            return state;
          }),

        addTaskToHistory: (task) =>
          set((state) => ({
            taskHistory: [{ ...task, createdAt: Date.now() }, ...state.taskHistory.slice(0, 9)]
          })),

        clearTaskHistory: () => set({ taskHistory: [] }),
        removeTaskFromHistory: (taskId) =>
          set((state) => ({
            taskHistory: state.taskHistory.filter(task => task.id !== taskId)
          })),

        // Input Actions
        setInputText: (text) => set({ inputText: text }),
        updateTTSParams: (params) =>
          set((state) => ({
            ttsParams: { ...state.ttsParams, ...params }
          })),
        setPromptAudio: (file) => set({ promptAudio: file }),
        setEmoAudio: (file) => set({ emoAudio: file }),
        setTextSegments: (segments) => set({ textSegments: segments }),

        // UI Actions
        setGenerating: (generating) => set({ isGenerating: generating }),
        setShowAdvanced: (show) => set({ showAdvanced: show }),
        setSelectedExample: (example) =>
          set((state) => {
            if (example) {
              return {
                selectedExample: example,
                ttsParams: {
                  ...state.ttsParams,
                  text: example.text
                }
              };
            }
            return { selectedExample: example };
          }),

        // Reset Action
        reset: () => set({
          ttsParams: { ...defaultTTSParams },
          promptAudio: null,
          emoAudio: null,
          currentTask: null,
          isGenerating: false,
          selectedExample: null,
          textSegments: []
        })
      })
    ),
    {
      name: 'optimized-tts-store',
      // 只持久化必要的状态
      partialize: (state) => ({
        ttsParams: state.ttsParams,
        showAdvanced: state.showAdvanced,
        taskHistory: state.taskHistory.slice(0, 5)
      })
    }
  )
);

// 选择器hooks - 提高性能
export const useAppState = () => {
  const store = useOptimizedTTSStore();
  return {
    clientId: store.clientId,
    isLoading: store.isLoading,
    config: store.config,
    examples: store.examples,
    setClientId: store.setClientId,
    setIsLoading: store.setIsLoading,
    setConfig: store.setConfig,
    setExamples: store.setExamples
  };
};

export const useTaskState = () => {
  const store = useOptimizedTTSStore();
  return {
    currentTask: store.currentTask,
    taskHistory: store.taskHistory,
    setCurrentTask: store.setCurrentTask,
    updateTaskProgress: store.updateTaskProgress,
    completeTask: store.completeTask,
    failTask: store.failTask,
    addTaskToHistory: store.addTaskToHistory,
    clearTaskHistory: store.clearTaskHistory,
    removeTaskFromHistory: store.removeTaskFromHistory
  };
};

export const useInputState = () => {
  const store = useOptimizedTTSStore();
  return {
    inputText: store.inputText,
    textSegments: store.textSegments,
    ttsParams: store.ttsParams,
    promptAudio: store.promptAudio,
    emoAudio: store.emoAudio,
    setInputText: store.setInputText,
    updateTTSParams: store.updateTTSParams,
    setPromptAudio: store.setPromptAudio,
    setEmoAudio: store.setEmoAudio,
    setTextSegments: store.setTextSegments
  };
};

export const useUIState = () => {
  const store = useOptimizedTTSStore();
  return {
    isGenerating: store.isGenerating,
    showAdvanced: store.showAdvanced,
    selectedExample: store.selectedExample,
    setGenerating: store.setGenerating,
    setShowAdvanced: store.setShowAdvanced,
    setSelectedExample: store.setSelectedExample
  };
};