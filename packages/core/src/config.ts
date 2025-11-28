/**
 * Configuration loading
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface Config {
  plugins: string[];
  pluginConfig?: Record<string, Record<string, unknown>>;
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
