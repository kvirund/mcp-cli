/**
 * URL Downloader Plugin for MCP CLI
 *
 * Provides curl-like functionality for fetching URLs
 */

import type { Plugin, PluginContext, PluginStatus, PluginHelp, PluginExport } from '@kvirund/mcp-cli/plugin';
import { urlDownloaderCommands } from './commands.js';
import { urlDownloaderMcpTools } from './mcp-tools.js';

let context: PluginContext | null = null;

const urlDownloaderPlugin: Plugin = {
  manifest: {
    name: 'url-downloader',
    version: '0.2.0',
    description: 'Fetch URLs like curl - HTTP client for MCP CLI',
  },

  async init(ctx: PluginContext): Promise<void> {
    context = ctx;
    ctx.log('Plugin initialized');
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

  getExports(): Record<string, PluginExport> {
    const exports: Record<string, PluginExport> = {};

    // CLI commands
    for (const cmd of urlDownloaderCommands) {
      exports[cmd.name] = cmd;
    }

    // MCP tools
    for (const tool of urlDownloaderMcpTools) {
      exports[`tool_${tool.name}`] = tool;
    }

    return exports;
  },

  getStatus(): PluginStatus {
    return {
      indicator: 'green',
      text: 'ready',
    };
  },

  getHelp(): PluginHelp {
    return {
      description: 'HTTP client for fetching URLs (curl-like functionality)',
      usage: [
        'fetch <url> [-h] [-b]     - GET request (-h: headers, -b: body only)',
        'post <url> <data> [-H]    - POST request',
        'head <url>                - Get headers only',
        'http <method> <url> [opts]- Full HTTP request',
      ].join('\n'),
      sections: [
        {
          title: 'HTTP Options',
          content: [
            '-H "Name: Value"  Add header',
            '-d "data"         Request body',
            '-h                Show response headers',
            '-b                Body only output',
          ].join('\n'),
        },
        {
          title: 'MCP Tools',
          content: 'url_fetch, url_request, url_post, url_head, url_json',
        },
        {
          title: 'Examples',
          content: [
            'fetch https://api.example.com/data',
            'post https://api.example.com/submit {"key":"value"}',
            'http PUT https://api.example.com/item -d "data" -H "Auth: token"',
          ].join('\n'),
        },
      ],
    };
  },
};

export default urlDownloaderPlugin;
