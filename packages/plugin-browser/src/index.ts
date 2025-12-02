/**
 * Browser Control Plugin for MCP CLI
 *
 * Provides browser automation via Chrome DevTools Protocol
 */

import type { Plugin, PluginContext, PluginStatus, PluginHelp } from '@kvirund/mcp-cli';
import { browserCommands, setNotifyFn } from './commands.js';
import { browserMcpTools } from './mcp-tools.js';
import * as cdp from './cdp/index.js';

let context: PluginContext | null = null;

const browserPlugin: Plugin = {
  manifest: {
    name: 'browser',
    version: '0.1.0',
    description: 'Browser automation via Chrome DevTools Protocol',
  },

  async init(ctx: PluginContext): Promise<void> {
    context = ctx;
    setNotifyFn(() => ctx.notifyStateChange());
    ctx.log('Plugin initialized');
  },

  async destroy(): Promise<void> {
    await cdp.disconnect();
    context = null;
  },

  async onEnable(): Promise<void> {
    context?.log('Plugin enabled');
  },

  async onDisable(): Promise<void> {
    await cdp.disconnect();
    context?.log('Plugin disabled');
  },

  commands: browserCommands,

  getStatus(): PluginStatus {
    if (!cdp.isConnected()) {
      return {
        indicator: 'gray',
        text: 'disconnected',
      };
    }

    const info = cdp.getConnectionInfo();
    if (!info) {
      return {
        indicator: 'yellow',
        text: 'connecting...',
      };
    }

    return {
      indicator: 'green',
      text: `${info.host}:${info.port}`,
    };
  },

  getHelp(): PluginHelp {
    return {
      description: 'Control Chrome/Chromium browser via DevTools Protocol (CDP)',
      usage: [
        'connect [host] [port]  - Connect to browser (default: localhost:9222)',
        'navigate <url>         - Navigate to URL',
        'click <selector>       - Click element',
        'type <selector> <text> - Type text into element',
        'screenshot [path] [--viewport] - Take screenshot (full page by default)',
      ].join('\n'),
      sections: [
        {
          title: 'Connection',
          content: 'connect, disconnect, tabs, switch, status',
        },
        {
          title: 'Navigation',
          content: 'navigate, reload, back, forward',
        },
        {
          title: 'Interaction',
          content: 'click, type, scroll',
        },
        {
          title: 'Content',
          content: 'screenshot, html, text, eval, info',
        },
      ],
    };
  },

  getMcpTools() {
    return browserMcpTools;
  },
};

export default browserPlugin;

// Also export types for consumers
export type { TabInfo } from './cdp/client.js';
