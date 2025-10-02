import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TTSRequest, ExampleCase, AppConfig } from '../utils/api';
import { AudioSample } from '../types/audio';

// TTS任务状态
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

// 应用状态接口
interface TTSState {
  // 基础状态
  clientId: string;
  isLoading: boolean;

  // 输入文本
  inputText: string;

  // TTS参数
  ttsParams: TTSRequest;

  // 音频文件（保持向后兼容）
  promptAudio: File | null;
  emoAudio: File | null;

  // 音频选择器状态
  selectedVoiceSample: AudioSample | null;
  selectedEmotionSample: AudioSample | null;
  audioSelectorMode: 'upload' | 'selector'; // 音频选择模式

  // 任务管理
  currentTask: TTSTask | null;
  taskHistory: TTSTask[];

  // 应用配置
  config: AppConfig | null;
  examples: ExampleCase[];

  // UI状态
  isGenerating: boolean;
  showAdvanced: boolean;
  selectedExample: ExampleCase | null;

  // 文本分段
  textSegments: Array<{ index: number; content: string; tokens: number }>;

  // Actions
  setClientId: (clientId: string) => void;
  setIsLoading: (loading: boolean) => void;
  setInputText: (text: string) => void;
  updateTTSParams: (params: Partial<TTSRequest>) => void;
  setPromptAudio: (file: File | null) => void;
  setEmoAudio: (file: File | null) => void;
  setSelectedVoiceSample: (sample: AudioSample | null) => void;
  setSelectedEmotionSample: (sample: AudioSample | null) => void;
  setAudioSelectorMode: (mode: 'upload' | 'selector') => void;
  setCurrentTask: (task: TTSTask | null) => void;
  updateTaskProgress: (taskId: string, progress: number, message: string) => void;
  completeTask: (taskId: string, result: string) => void;
  failTask: (taskId: string, error: string) => void;
  addTaskToHistory: (task: TTSTask) => void;
  clearTaskHistory: () => void;
  removeTaskFromHistory: (taskId: string) => void;
  setConfig: (config: AppConfig) => void;
  setExamples: (examples: ExampleCase[]) => void;
  setGenerating: (generating: boolean) => void;
  setShowAdvanced: (show: boolean) => void;
  setSelectedExample: (example: ExampleCase | null) => void;
  setTextSegments: (segments: Array<{ index: number; content: string; tokens: number }>) => void;
  clearCurrentTask: () => void;
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

export const useTTSStore = create<TTSState>()(
  devtools(
    (set) => ({
      // 初始状态
      clientId: '',
      isLoading: false,
      inputText: '',
      ttsParams: { ...defaultTTSParams },
      promptAudio: null,
      emoAudio: null,
      selectedVoiceSample: null,
      selectedEmotionSample: null,
      audioSelectorMode: 'selector',
      currentTask: null,
      taskHistory: [],
      config: null,
      examples: [],
      isGenerating: false,
      showAdvanced: false,
      selectedExample: null,
      textSegments: [],

      // Actions
      setClientId: (clientId) => set({ clientId }),
      
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      setInputText: (text) => set({ inputText: text }),
      
      updateTTSParams: (params) => 
        set((state) => ({
          ttsParams: { ...state.ttsParams, ...params }
        })),
      
      setPromptAudio: (file) => set({ promptAudio: file }),
      
      setEmoAudio: (file) => set({ emoAudio: file }),

      setSelectedVoiceSample: (sample) => set({ selectedVoiceSample: sample }),

      setSelectedEmotionSample: (sample) => set({ selectedEmotionSample: sample }),

      setAudioSelectorMode: (mode) => set({ audioSelectorMode: mode }),

      setCurrentTask: (task) => {
      console.log('📝 Store设置当前任务:', task);
      set({ currentTask: task });
    },
      
      updateTaskProgress: (taskId, progress, message) =>
        set((state) => {
          console.log('📊 Store更新进度:', { taskId, progress, message, currentTaskId: state.currentTask?.id });
          if (state.currentTask?.id === taskId) {
            const updatedTask = {
              ...state.currentTask,
              progress,
              message,
              status: 'processing' as const
            };
            console.log('✅ Store进度更新成功:', updatedTask);
            return {
              currentTask: updatedTask
            };
          } else {
            console.log('❌ Store进度更新失败: 任务ID不匹配');
            return state;
          }
        }),
      
      completeTask: (taskId, result) =>
        set((state) => {
          if (state.currentTask?.id === taskId) {
            // 构建完整的音频URL
            const audioUrl = result.startsWith('/') ? `http://127.0.0.1:8000${result}` : result;

            const completedTask: TTSTask = {
              ...state.currentTask,
              status: 'completed',
              progress: 100,
              result,
              audioUrl, // 添加完整的音频URL
              message: '生成完成'
            };

            // 延迟清理任务，给用户足够时间查看结果
            setTimeout(() => {
              set((currentState) => {
                if (currentState.currentTask?.id === taskId) {
                  console.log('自动清理已完成的任务:', taskId);
                  return { currentTask: null };
                }
                return currentState;
              });
            }, 30000); // 30秒后自动清理

            return {
              currentTask: completedTask, // 保持当前任务显示，显示完成状态
              taskHistory: [completedTask, ...state.taskHistory.slice(0, 9)], // 保留最近10个任务
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
              message: error
            };

            // 错误任务也延迟清理，让用户有时间查看错误信息
            setTimeout(() => {
              set((currentState) => {
                if (currentState.currentTask?.id === taskId) {
                  console.log('自动清理失败的任务:', taskId);
                  return { currentTask: null };
                }
                return currentState;
              });
            }, 10000); // 10秒后自动清理错误任务

            return {
              currentTask: failedTask, // 保留失败任务显示一段时间
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
      
      setConfig: (config) => set({ config }),
      
      setExamples: (examples) => set({ examples }),
      
      setGenerating: (generating) => set({ isGenerating: generating }),
      
      setShowAdvanced: (show) => set({ showAdvanced: show }),
      
      setSelectedExample: (example) => 
        set((state) => {
          if (example) {
            // 当选择示例时，更新TTS参数
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
      
      setTextSegments: (segments) => set({ textSegments: segments }),
      
      clearCurrentTask: () => set({ currentTask: null, isGenerating: false }),

      reset: () => set({
        ttsParams: { ...defaultTTSParams },
        promptAudio: null,
        emoAudio: null,
        selectedVoiceSample: null,
        selectedEmotionSample: null,
        audioSelectorMode: 'selector',
        currentTask: null,
        isGenerating: false,
        selectedExample: null,
        textSegments: []
      })
    }),
    {
      name: 'tts-store',
      partialize: (state: TTSState) => ({
        // 只持久化部分状态
        ttsParams: state.ttsParams,
        showAdvanced: state.showAdvanced,
        taskHistory: state.taskHistory.slice(0, 5) // 只保存最近5个任务历史
      })
    }
  )
);