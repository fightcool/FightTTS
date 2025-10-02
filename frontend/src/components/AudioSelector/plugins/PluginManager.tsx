import { AudioConfig, AudioSample, AudioPlugin, PluginError, PluginState, PluginEvent } from './PluginTypes';
import { Theme } from '../../../types/audio';

export class AudioPluginManager {
  private plugins: Map<string, AudioPlugin> = new Map();
  private pluginFactories: Map<string, () => AudioPlugin> = new Map();
  private eventListeners: Map<string, ((event: PluginEvent) => void)[]> = new Map();
  private config: AudioConfig;
  private currentTheme: Theme;

  constructor(config: AudioConfig) {
    this.config = config;
    this.currentTheme = lightTheme;
  }

  // 注册插件
  registerPlugin(plugin: AudioPlugin): void {
    if (!isValidPlugin(plugin)) {
      throw new PluginError(
        `Invalid plugin: ${plugin.metadata.name}`,
        plugin.metadata.id
      );
    }

    if (this.plugins.has(plugin.metadata.id)) {
      throw new PluginError(
        `Plugin ${plugin.metadata.id} is already registered`,
        plugin.metadata.id
      );
    }

    this.plugins.set(plugin.metadata.id, plugin);
    this.emit('plugin-loaded', {
      type: 'plugin-loaded',
      pluginId: plugin.metadata.id,
      data: plugin
    });
  }

  // 注册插件工厂
  registerPluginFactory(id: string, factory: () => AudioPlugin): void {
    this.pluginFactories.set(id, factory);
  }

  // 创建插件实例
  async createPluginInstance(id: string, config?: Partial<AudioConfig>): Promise<AudioPlugin> {
    let plugin: AudioPlugin;

    if (this.plugins.has(id)) {
      plugin = this.plugins.get(id);
    } else if (this.pluginFactories.has(id)) {
      plugin = this.pluginFactories.get(id)();
    } else {
      throw new PluginError(`Plugin not found: ${id}`);
    }

    if (config) {
      plugin.config = { ...plugin.config, ...config };
    }

    plugin.state = PluginState.LOADED;

    try {
      await plugin.initialize(this.config);
      plugin.state = PluginState.LOADED;
      this.emit('plugin-loaded', {
        type: 'plugin-loaded',
        pluginId: plugin.metadata.id,
        data: plugin
      });
    } catch (error) {
      plugin.state = PluginState.ERROR;
      this.emit('plugin-error', {
        type: 'plugin-error',
        pluginId: plugin.metadata.id,
        error: error instanceof Error ? new PluginError(error.message, plugin.metadata.id, error.code, error) : new Error('Unknown error')
      });
    }

    return plugin;
  }

  // 启用插件
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.state === PluginState.ERROR) {
      plugin.state = PluginState.LOADED;
      try {
        await plugin.initialize(this.config);
        plugin.state = PluginState.LOADED;
        plugin.enabled = true;
        this.emit('plugin-enabled', {
          type: 'plugin-enabled',
          pluginId: pluginId
        });
      } catch (error) {
        plugin.state = PluginState.ERROR;
        throw new PluginError(`Failed to enable plugin ${pluginId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    plugin.enabled = true;
  }

  // 禁用插件
  disablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      this.emit('plugin-disabled', {
        type: 'plugin-disabled',
        pluginId
      });
    }
  }

  // 获取插件
  getPlugin(pluginId: string): AudioPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  // 获取所有插件
  getAllPlugins(): AudioPlugin[] {
    return Array.from(this.plugins.values());
  }

  // 销毁插件
  async destroyPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    try {
      await plugin.destroy();
      this.plugins.delete(pluginId);
      this.emit('plugin-unloaded', {
        type: 'plugin-unloaded',
        pluginId
      });
    } catch (error) {
      console.error(`Error destroying plugin ${pluginId}:`, error);
    }
  }

  // 获取所有启用的插件
  getEnabledPlugins(): AudioPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.enabled);
  }

  // 设置主题（通知所有插件）
  async setTheme(theme: Theme): Promise<void> {
    this.currentTheme = theme;

    const enabledPlugins = this.getEnabledPlugins();
    await Promise.all(
      enabledPlugins.map(plugin =>
        plugin.onThemeChange?.(theme) || Promise.resolve()
      )
    );
  }

  // 事件系统
  on(eventType: string, listener: (event: PluginEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  off(eventType: string, listener: (event: PluginEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: PluginEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        listener(event);
      });
    }
  }

  // 配置更新
  updateConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };

    // 通知所有插件配置变化
    const enabledPlugins = this.getEnabledPlugins();
    enabledPlugins.forEach(plugin => {
      plugin.updateConfig?.(config);
    });
  }

  // 清理所有插件
  async destroyAll(): Promise<void> {
    const plugins = Array.from(this.plugins.values());
    await Promise.all(
      plugins.map(plugin => this.destroyPlugin(plugin.metadata.id))
    );
    this.plugins.clear();
    this.eventListeners.clear();
    this.pluginFactories.clear();
  }
}