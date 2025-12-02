/**
 * NASA APOD Plugin for MCP CLI
 *
 * Provides access to NASA's Astronomy Picture of the Day API
 */

import type { Plugin, PluginContext, PluginStatus, PluginHelp } from '@kvirund/mcp-cli';
import { nasaApodCommands } from './commands.js';
import { nasaApodMcpTools } from './mcp-tools.js';
import { setConfigApiKey, hasCustomApiKey } from './constants.js';

let context: PluginContext | null = null;

const nasaApodPlugin: Plugin = {
  manifest: {
    name: 'nasa-apod',
    version: '0.1.0',
    description: 'NASA Astronomy Picture of the Day - explore the cosmos',
  },

  async init(ctx: PluginContext): Promise<void> {
    context = ctx;

    // Set API key from config if provided
    const apiKey = ctx.config?.apiKey as string | undefined;
    setConfigApiKey(apiKey);

    ctx.log('Plugin initialized' + (apiKey ? ' with custom API key' : ''));
  },

  async destroy(): Promise<void> {
    context = null;
  },

  async onEnable(): Promise<void> {
    context?.log('Plugin enabled');
  },

  async onDisable(): Promise<void> {
    context?.log('Plugin disabled');
  },

  commands: nasaApodCommands,

  getStatus(): PluginStatus {
    return {
      indicator: hasCustomApiKey() ? 'green' : 'yellow',
      text: hasCustomApiKey() ? 'API key set' : 'DEMO_KEY',
    };
  },

  getHelp(): PluginHelp {
    return {
      description: "Access NASA's Astronomy Picture of the Day archive",
      usage: [
        'apod                          - Get today\'s APOD',
        'apod-date <date>              - Get APOD for date (YYYY-MM-DD)',
        'apod-random [count]           - Get random APODs (default: 5)',
        'apod-range <start> <end>      - Get APODs in date range',
        'apod-search <query> [limit]   - Search APODs by keyword',
      ].join('\n'),
      sections: [
        {
          title: 'MCP Tools',
          content: 'apod_today, apod_by_date, apod_range, apod_random, apod_search',
        },
        {
          title: 'API Key',
          content:
            'Set apiKey in plugin config or NASA_API_KEY env var for higher rate limits.\nGet your key at https://api.nasa.gov',
        },
      ],
    };
  },

  getMcpTools() {
    return nasaApodMcpTools;
  },
};

export default nasaApodPlugin;
