/**
 * Plugin system types for MCP CLI
 */

import type { CommandArg, CommandResult, AppState } from '../commands/types.js';
// Re-export command types for plugin authors
export type { CommandArg, CommandResult, AppState };

/**
 * Plugin manifest - basic information about the plugin
 */
export interface PluginManifest {
  /** Unique plugin identifier, e.g. "browser-control" */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
}

/**
 * Plugin status for StatusBar display
 */
export interface PluginStatus {
  /** Status indicator color */
  indicator: 'green' | 'yellow' | 'red' | 'gray';
  /** Status text to display */
  text: string;
}

/**
 * Plugin help information for "help <plugin>" command
 */
export interface PluginHelp {
  /** Brief description of what the plugin does */
  description: string;
  /** Usage examples */
  usage?: string;
  /** Additional help sections */
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  /** Notify core that plugin state has changed (triggers StatusBar update) */
  notifyStateChange(): void;

  /** Log a message (will be prefixed with plugin name) */
  log(message: string): void;

  /** Plugin configuration from config file */
  config: Record<string, unknown>;
}

/**
 * CLI command exported by a plugin
 */
export interface PluginCliCommand {
  type: 'cli';
  /** Command name */
  name: string;
  /** Description for help */
  description: string;
  /** Argument definitions */
  args?: CommandArg[];
  /** Subcommands for autocomplete (static list or dynamic function) */
  subcommands?: string[] | (() => string[]);
  /** Execute the command */
  execute: (args: string[], state?: AppState) => Promise<CommandResult>;
}

/**
 * MCP Tool exported by a plugin
 */
export interface PluginMcpTool {
  type: 'tool';
  /** Tool name (will be prefixed with plugin name) */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: {
    type: 'object';
    properties?: Record<string, object>;
    required?: string[];
  };
  /** Handler function */
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Union type for plugin exports
 */
export type PluginExport = PluginCliCommand | PluginMcpTool;

/**
 * Plugin interface that all plugins must implement
 */
export interface Plugin {
  /** Plugin manifest with name, version, description */
  manifest: PluginManifest;

  /**
   * Initialize the plugin
   * Called once when plugin is loaded
   */
  init(context: PluginContext): Promise<void>;

  /**
   * Cleanup when plugin is unloaded
   * Called when CLI exits or plugin is removed
   */
  destroy(): Promise<void>;

  /**
   * Called when plugin is enabled at runtime
   * Optional - if not implemented, plugin is always active after init
   */
  onEnable?(): Promise<void>;

  /**
   * Called when plugin is disabled at runtime
   * Should pause/cleanup without full destruction
   */
  onDisable?(): Promise<void>;

  /**
   * Get exports: CLI commands and MCP tools
   * Key is the export name (used for registration)
   */
  getExports(): Record<string, PluginExport>;

  /**
   * Get current status for StatusBar display
   * Called periodically (every ~1 second)
   */
  getStatus(): PluginStatus;

  /**
   * Get help information for "help <plugin>" command
   */
  getHelp(): PluginHelp;
}

/**
 * Plugin factory function type
 * Used when a plugin needs multiple independent instances (e.g., proxy plugin)
 */
export type PluginFactory = () => Plugin;

/**
 * Plugin module default export type
 * Can be either a Plugin object or a factory function that creates Plugin instances
 */
export type PluginModule = {
  default: Plugin | PluginFactory;
};
