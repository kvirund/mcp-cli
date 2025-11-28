/**
 * Plugin context factory
 */

import type { PluginContext } from './types.js';

export interface ContextOptions {
  pluginName: string;
  config: Record<string, unknown>;
  onStateChange: (pluginName: string) => void;
}

/**
 * Create a plugin context
 */
export function createPluginContext(options: ContextOptions): PluginContext {
  const { pluginName, config, onStateChange } = options;

  return {
    notifyStateChange() {
      onStateChange(pluginName);
    },

    log(message: string) {
      console.log(`[${pluginName}] ${message}`);
    },

    config,
  };
}
