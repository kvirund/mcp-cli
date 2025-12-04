/**
 * Plugin Manager - loads, manages, and coordinates plugins
 */

import { EventEmitter } from 'events';
import type { Plugin, PluginModule, McpTool } from './types.js';
import type { RegisteredCommand } from '../commands/types.js';
import { createPluginContext } from './context.js';

export interface PluginManagerEvents {
  pluginLoaded: (name: string) => void;
  pluginUnloaded: (name: string) => void;
  pluginEnabled: (name: string) => void;
  pluginDisabled: (name: string) => void;
  stateChange: (pluginName: string) => void;
}

export interface PluginInfo {
  plugin: Plugin;
  enabled: boolean;
  /** Set of disabled tool names (without plugin prefix) */
  disabledTools: Set<string>;
}

export interface PluginManagerConfig {
  plugins?: Record<string, Record<string, unknown>>;
  /** Disabled tools per plugin (plugin name -> array of tool names without prefix) */
  disabledTools?: Record<string, string[]>;
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, PluginInfo> = new Map();
  private config: PluginManagerConfig;

  constructor(config: PluginManagerConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Load a plugin from an npm package with a specific name
   * @param pluginName - The name to register the plugin under (from config key)
   * @param packageName - The npm package name to import
   */
  async loadPlugin(pluginName: string, packageName: string): Promise<void> {
    try {
      // Dynamic import
      const module = (await import(packageName)) as PluginModule;
      const plugin = module.default;

      // Validate
      this.validatePlugin(plugin, packageName);

      // Check for duplicates
      if (this.plugins.has(pluginName)) {
        throw new Error(`Plugin already loaded: ${pluginName}`);
      }

      // Create context with the config-provided name
      const pluginConfig = this.config.plugins?.[pluginName] ?? {};
      const context = createPluginContext({
        pluginName: pluginName,
        config: pluginConfig,
        onStateChange: (pName) => this.emit('stateChange', pName),
      });

      // Initialize
      await plugin.init(context);

      // Get disabled tools from config
      const disabledToolsArray = this.config.disabledTools?.[pluginName] ?? [];
      const disabledTools = new Set(disabledToolsArray);

      // Store plugin under the config-provided name
      this.plugins.set(pluginName, { plugin, enabled: true, disabledTools });

      this.emit('pluginLoaded', pluginName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load plugin ${pluginName} from ${packageName}: ${message}`);
    }
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: Plugin, packageName: string): void {
    if (!plugin) {
      throw new Error(`Package ${packageName} does not export a default plugin`);
    }

    if (!plugin.manifest) {
      throw new Error(`Plugin from ${packageName} missing manifest`);
    }

    const { name, version, description } = plugin.manifest;

    if (!name || typeof name !== 'string') {
      throw new Error(`Plugin from ${packageName} has invalid manifest.name`);
    }

    if (!version || typeof version !== 'string') {
      throw new Error(`Plugin ${name} has invalid manifest.version`);
    }

    if (!description || typeof description !== 'string') {
      throw new Error(`Plugin ${name} has invalid manifest.description`);
    }

    if (!Array.isArray(plugin.commands)) {
      throw new Error(`Plugin ${name} must have commands array`);
    }

    if (typeof plugin.init !== 'function') {
      throw new Error(`Plugin ${name} must have init() method`);
    }

    if (typeof plugin.destroy !== 'function') {
      throw new Error(`Plugin ${name} must have destroy() method`);
    }

    if (typeof plugin.getStatus !== 'function') {
      throw new Error(`Plugin ${name} must have getStatus() method`);
    }

    if (typeof plugin.getHelp !== 'function') {
      throw new Error(`Plugin ${name} must have getHelp() method`);
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<void> {
    const info = this.plugins.get(name);
    if (!info) {
      throw new Error(`Plugin not found: ${name}`);
    }

    await info.plugin.destroy();
    this.plugins.delete(name);

    this.emit('pluginUnloaded', name);
  }

  /**
   * Enable a plugin at runtime
   */
  async enablePlugin(name: string): Promise<void> {
    const info = this.plugins.get(name);
    if (!info) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (info.enabled) {
      return; // Already enabled
    }

    if (info.plugin.onEnable) {
      await info.plugin.onEnable();
    }

    info.enabled = true;
    this.emit('pluginEnabled', name);
  }

  /**
   * Disable a plugin at runtime
   */
  async disablePlugin(name: string): Promise<void> {
    const info = this.plugins.get(name);
    if (!info) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (!info.enabled) {
      return; // Already disabled
    }

    if (info.plugin.onDisable) {
      await info.plugin.onDisable();
    }

    info.enabled = false;
    this.emit('pluginDisabled', name);
  }

  /**
   * Get all plugins
   */
  getAll(): Map<string, PluginInfo> {
    return new Map(this.plugins);
  }

  /**
   * Get a specific plugin
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * Check if plugin exists
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Check if plugin is enabled
   */
  isEnabled(name: string): boolean {
    return this.plugins.get(name)?.enabled ?? false;
  }

  /**
   * Get all plugin names
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all enabled plugin names
   */
  getEnabledPluginNames(): string[] {
    return Array.from(this.plugins.entries())
      .filter(([_, info]) => info.enabled)
      .map(([name]) => name);
  }

  /**
   * Get all commands from enabled plugins
   */
  getCommands(): RegisteredCommand[] {
    const commands: RegisteredCommand[] = [];

    for (const [name, info] of this.plugins) {
      if (!info.enabled) continue;

      for (const cmd of info.plugin.commands) {
        commands.push({
          ...cmd,
          _plugin: name,
        });
      }
    }

    return commands;
  }

  /**
   * Get all MCP tools from enabled plugins (excluding disabled tools)
   */
  getMcpTools(): Array<McpTool & { _plugin: string }> {
    const tools: Array<McpTool & { _plugin: string }> = [];

    for (const [name, info] of this.plugins) {
      if (!info.enabled) continue;

      const pluginTools = info.plugin.getMcpTools?.() ?? [];
      for (const tool of pluginTools) {
        // Skip disabled tools
        if (info.disabledTools.has(tool.name)) continue;

        tools.push({
          ...tool,
          // Prefix tool name with plugin name
          name: `${name}_${tool.name}`,
          _plugin: name,
        });
      }
    }

    return tools;
  }

  /**
   * Get all tools for a specific plugin (including disabled status)
   */
  getPluginTools(pluginName: string): Array<{ name: string; enabled: boolean }> {
    const info = this.plugins.get(pluginName);
    if (!info) return [];

    const pluginTools = info.plugin.getMcpTools?.() ?? [];
    return pluginTools.map((tool) => ({
      name: tool.name,
      enabled: !info.disabledTools.has(tool.name),
    }));
  }

  /**
   * Enable a specific tool for a plugin
   */
  enableTool(pluginName: string, toolName: string): void {
    const info = this.plugins.get(pluginName);
    if (!info) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    info.disabledTools.delete(toolName);
    this.emit('stateChange', pluginName);
  }

  /**
   * Disable a specific tool for a plugin
   */
  disableTool(pluginName: string, toolName: string): void {
    const info = this.plugins.get(pluginName);
    if (!info) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    // Verify tool exists
    const pluginTools = info.plugin.getMcpTools?.() ?? [];
    const toolExists = pluginTools.some((t) => t.name === toolName);
    if (!toolExists) {
      throw new Error(`Tool not found: ${toolName} in plugin ${pluginName}`);
    }

    info.disabledTools.add(toolName);
    this.emit('stateChange', pluginName);
  }

  /**
   * Check if a tool is enabled
   */
  isToolEnabled(pluginName: string, toolName: string): boolean {
    const info = this.plugins.get(pluginName);
    if (!info) return false;
    return !info.disabledTools.has(toolName);
  }

  /**
   * Get disabled tools for a plugin
   */
  getDisabledTools(pluginName: string): string[] {
    const info = this.plugins.get(pluginName);
    if (!info) return [];
    return Array.from(info.disabledTools);
  }

  /**
   * Load plugins from config
   * @param plugins - Map of plugin name -> package name
   */
  async loadFromConfig(plugins: Record<string, string>): Promise<void> {
    for (const [pluginName, packageName] of Object.entries(plugins)) {
      await this.loadPlugin(pluginName, packageName);
    }
  }

  /**
   * Destroy all plugins
   */
  async destroyAll(): Promise<void> {
    const names = Array.from(this.plugins.keys());
    for (const name of names) {
      await this.unloadPlugin(name);
    }
  }
}
