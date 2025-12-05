/**
 * MCP tools for browser plugin
 */

import type { PluginMcpTool } from '@kvirund/mcp-cli/plugin';
import * as cdp from './cdp/index.js';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

export const browserMcpTools: PluginMcpTool[] = [
  {
    type: 'tool',
    name: 'connect',
    description: 'Connect to a browser via Chrome DevTools Protocol',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Browser host (default: localhost)' },
        port: { type: 'number', description: 'Debug port (default: 9222)' },
      },
    },
    async handler(params) {
      const host = (params.host as string) || 'localhost';
      const port = (params.port as number) || 9222;
      await cdp.connect({ host, port });
      const version = await cdp.getBrowserVersion(host, port);
      const tabs = await cdp.getTabs(host, port);
      return `Connected to ${version.browser} at ${host}:${port} (${tabs.length} tabs)`;
    },
  },

  {
    type: 'tool',
    name: 'disconnect',
    description: 'Disconnect from the browser',
    inputSchema: { type: 'object', properties: {} },
    async handler() {
      await cdp.disconnect();
      return 'Disconnected from browser';
    },
  },

  {
    type: 'tool',
    name: 'list_tabs',
    description: 'List all open browser tabs',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number' },
      },
    },
    async handler(params) {
      const host = (params.host as string) || 'localhost';
      const port = (params.port as number) || 9222;
      const tabs = await cdp.getTabs(host, port);
      return tabs;
    },
  },

  {
    type: 'tool',
    name: 'navigate',
    description: 'Navigate to a URL in the current tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
    async handler(params) {
      const url = params.url as string;
      await cdp.navigate(url);
      const info = await cdp.getPageInfo();
      return `Navigated to: ${info.title}\n${info.url}`;
    },
  },

  {
    type: 'tool',
    name: 'screenshot',
    description: 'Take a screenshot of the current page (full page by default)',
    inputSchema: {
      type: 'object',
      properties: {
        viewportOnly: { type: 'boolean', description: 'Capture only visible viewport instead of full page' },
        outputPath: { type: 'string', description: 'Path to save screenshot' },
      },
    },
    async handler(params) {
      const fullPage = !params.viewportOnly;
      const outputPath = resolve((params.outputPath as string) || `screenshot-${Date.now()}.png`);
      const buffer = await cdp.screenshot({ fullPage });
      await writeFile(outputPath, buffer);
      return `Screenshot saved to ${outputPath} (${buffer.length} bytes)`;
    },
  },

  {
    type: 'tool',
    name: 'click',
    description: 'Click an element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['selector'],
    },
    async handler(params) {
      const selector = params.selector as string;
      await cdp.click(selector);
      return `Clicked: ${selector}`;
    },
  },

  {
    type: 'tool',
    name: 'type',
    description: 'Type text into an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
    async handler(params) {
      const selector = params.selector as string;
      const text = params.text as string;
      await cdp.type(selector, text);
      return `Typed "${text}" into ${selector}`;
    },
  },

  {
    type: 'tool',
    name: 'scroll',
    description: 'Scroll the page',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'top', 'bottom'],
          description: 'Scroll direction',
        },
        amount: { type: 'number', description: 'Scroll amount in pixels (for up/down)' },
      },
      required: ['direction'],
    },
    async handler(params) {
      const direction = params.direction as 'up' | 'down' | 'top' | 'bottom';
      const amount = (params.amount as number) || 500;
      await cdp.scroll(direction, amount);
      return `Scrolled ${direction}`;
    },
  },

  {
    type: 'tool',
    name: 'evaluate',
    description: 'Execute JavaScript in the browser',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
      },
      required: ['expression'],
    },
    async handler(params) {
      const expression = params.expression as string;
      const result = await cdp.evaluate(expression);
      return result;
    },
  },

  {
    type: 'tool',
    name: 'get_page_info',
    description: 'Get current page title and URL',
    inputSchema: { type: 'object', properties: {} },
    async handler() {
      const info = await cdp.getPageInfo();
      return info;
    },
  },

  {
    type: 'tool',
    name: 'get_html',
    description: 'Get HTML content of the page or element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector (optional, defaults to full page)',
        },
        outputPath: {
          type: 'string',
          description: 'Path to save HTML to file (optional)',
        },
      },
    },
    async handler(params) {
      const selector = params.selector as string | undefined;
      const outputPath = params.outputPath as string | undefined;
      const html = await cdp.getHTML(selector);
      if (outputPath) {
        const resolvedPath = resolve(outputPath);
        await writeFile(resolvedPath, html);
        return `HTML saved to ${resolvedPath} (${html.length} bytes)`;
      }
      return html;
    },
  },

  {
    type: 'tool',
    name: 'get_text',
    description: 'Get text content of the page or element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector (optional, defaults to full page)',
        },
        outputPath: {
          type: 'string',
          description: 'Path to save text to file (optional)',
        },
      },
    },
    async handler(params) {
      const selector = params.selector as string | undefined;
      const outputPath = params.outputPath as string | undefined;
      const text = await cdp.getText(selector);
      if (outputPath) {
        const resolvedPath = resolve(outputPath);
        await writeFile(resolvedPath, text);
        return `Text saved to ${resolvedPath} (${text.length} bytes)`;
      }
      return text;
    },
  },

  {
    type: 'tool',
    name: 'reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        ignoreCache: { type: 'boolean', description: 'Bypass cache when reloading' },
      },
    },
    async handler(params) {
      const ignoreCache = (params.ignoreCache as boolean) || false;
      await cdp.reload(ignoreCache);
      return 'Page reloaded';
    },
  },

  {
    type: 'tool',
    name: 'go_back',
    description: 'Go back in browser history',
    inputSchema: { type: 'object', properties: {} },
    async handler() {
      await cdp.goBack();
      const info = await cdp.getPageInfo();
      return `Back to: ${info.title}`;
    },
  },

  {
    type: 'tool',
    name: 'go_forward',
    description: 'Go forward in browser history',
    inputSchema: { type: 'object', properties: {} },
    async handler() {
      await cdp.goForward();
      const info = await cdp.getPageInfo();
      return `Forward to: ${info.title}`;
    },
  },

  {
    type: 'tool',
    name: 'switch_tab',
    description: 'Switch to a different tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Tab ID or title fragment' },
        host: { type: 'string' },
        port: { type: 'number' },
      },
      required: ['tabId'],
    },
    async handler(params) {
      const tabId = params.tabId as string;
      const host = (params.host as string) || 'localhost';
      const port = (params.port as number) || 9222;
      await cdp.switchTab(tabId, host, port);
      const info = await cdp.getPageInfo();
      return `Switched to: ${info.title}`;
    },
  },
];
