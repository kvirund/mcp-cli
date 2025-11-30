/**
 * Configuration loading
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Plugin entry can be:
 * - string: just the package name
 * - object: package name with config
 */
export type PluginEntry =
  | string
  | {
      name: string;
      config?: Record<string, unknown>;
    };

export interface Config {
  plugins: PluginEntry[];
}

/**
 * Normalized config with plugin configs extracted
 */
export interface NormalizedConfig {
  pluginPackages: string[];
  pluginConfigs: Record<string, Record<string, unknown>>;
}

const DEFAULT_CONFIG: Config = {
  plugins: [],
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
 * Normalize config by extracting plugin package names and their configs
 */
export function normalizeConfig(config: Config): NormalizedConfig {
  const pluginPackages: string[] = [];
  const pluginConfigs: Record<string, Record<string, unknown>> = {};

  for (const entry of config.plugins) {
    if (typeof entry === 'string') {
      // Simple string entry - just the package name
      pluginPackages.push(entry);
    } else {
      // Object entry with name and optional config
      pluginPackages.push(entry.name);
      if (entry.config) {
        // Extract plugin name from package name for config mapping
        // e.g., "@anthropic/mcp-cli-plugin-nasa-apod" -> "nasa-apod"
        const pluginName = extractPluginName(entry.name);
        pluginConfigs[pluginName] = entry.config;
      }
    }
  }

  return { pluginPackages, pluginConfigs };
}

/**
 * Extract plugin name from package name
 * e.g., "@anthropic/mcp-cli-plugin-nasa-apod" -> "nasa-apod"
 * or "my-plugin" -> "my-plugin"
 */
function extractPluginName(packageName: string): string {
  // Handle scoped packages: @scope/mcp-cli-plugin-name -> name
  const scopedMatch = packageName.match(/@[^/]+\/mcp-cli-plugin-(.+)$/);
  if (scopedMatch) {
    return scopedMatch[1];
  }

  // Handle unscoped packages: mcp-cli-plugin-name -> name
  const unscopedMatch = packageName.match(/^mcp-cli-plugin-(.+)$/);
  if (unscopedMatch) {
    return unscopedMatch[1];
  }

  // Fallback: use package name as-is (for custom naming)
  return packageName;
}
