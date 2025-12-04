/**
 * Configuration loading
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Plugin entry in the new dictionary format
 */
export interface PluginEntry {
  /** npm package name to load */
  package: string;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** List of tool names to disable (without plugin prefix) */
  disabledTools?: string[];
}

export interface McpConfig {
  port?: number;
}

/**
 * Config format where plugins is a dictionary.
 * Key = plugin name (used for tool prefixes, commands, etc.)
 * Value = plugin entry with package name and optional config
 */
export interface Config {
  plugins: Record<string, PluginEntry>;
  mcp?: McpConfig;
}

export const DEFAULT_MCP_PORT = 3000;

/**
 * Normalized config with plugin data extracted for PluginManager
 */
export interface NormalizedConfig {
  /** Map of plugin name -> package name to load */
  plugins: Record<string, string>;
  /** Map of plugin name -> config */
  pluginConfigs: Record<string, Record<string, unknown>>;
  /** Disabled tools per plugin (plugin name -> array of tool names without prefix) */
  disabledTools: Record<string, string[]>;
}

const DEFAULT_CONFIG: Config = {
  plugins: {},
};

export function getConfigDir(): string {
  return join(homedir(), '.mcp-cli');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export async function loadConfig(): Promise<Config> {
  try {
    const configPath = getConfigPath();
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as Partial<Config>;

    return {
      ...DEFAULT_CONFIG,
      ...config,
    };
  } catch {
    // Config doesn't exist or is invalid, return defaults
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function ensureConfigExists(): Promise<Config> {
  try {
    return await loadConfig();
  } catch {
    const config = DEFAULT_CONFIG;
    await saveConfig(config);
    return config;
  }
}

/**
 * Normalize config by extracting plugin data for PluginManager
 */
export function normalizeConfig(config: Config): NormalizedConfig {
  const plugins: Record<string, string> = {};
  const pluginConfigs: Record<string, Record<string, unknown>> = {};
  const disabledTools: Record<string, string[]> = {};

  for (const [pluginName, entry] of Object.entries(config.plugins)) {
    plugins[pluginName] = entry.package;

    if (entry.config) {
      pluginConfigs[pluginName] = entry.config;
    }

    if (entry.disabledTools && entry.disabledTools.length > 0) {
      disabledTools[pluginName] = entry.disabledTools;
    }
  }

  return { plugins, pluginConfigs, disabledTools };
}
