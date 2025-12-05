/**
 * Browser plugin CLI commands
 */

import type { PluginCliCommand } from '@kvirund/mcp-cli/plugin';
import * as cdp from './cdp/index.js';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

type NotifyFn = () => void;
let notifyStateChange: NotifyFn = () => {};

export function setNotifyFn(fn: NotifyFn): void {
  notifyStateChange = fn;
}

export const browserCommands: PluginCliCommand[] = [
  {
    type: 'cli',
    name: 'connect',
    description: 'Connect to browser via Chrome DevTools Protocol',
    args: [
      { name: 'host', description: 'Browser host (default: localhost)', required: false },
      { name: 'port', description: 'Debug port (default: 9222)', required: false },
    ],
    async execute(args) {
      const [host = 'localhost', portStr = '9222'] = args;
      const port = parseInt(portStr, 10);

      try {
        await cdp.connect({ host, port });
        const version = await cdp.getBrowserVersion(host, port);
        const tabs = await cdp.getTabs(host, port);
        notifyStateChange();
        return {
          output: `Connected to ${version.browser} at ${host}:${port} (${tabs.length} tabs)`,
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed to connect: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'disconnect',
    description: 'Disconnect from browser',
    async execute() {
      await cdp.disconnect();
      notifyStateChange();
      return { output: 'Disconnected from browser', success: true };
    },
  },

  {
    type: 'cli',
    name: 'tabs',
    description: 'List open browser tabs',
    args: [
      { name: 'host', description: 'Browser host', required: false },
      { name: 'port', description: 'Debug port', required: false },
    ],
    async execute(args) {
      const [host = 'localhost', portStr = '9222'] = args;
      const port = parseInt(portStr, 10);

      try {
        const tabs = await cdp.getTabs(host, port);
        if (tabs.length === 0) {
          return { output: 'No tabs found', success: true };
        }

        const lines = tabs.map((tab, i) => {
          const marker = tab.active ? '▸' : ' ';
          const title = tab.title.length > 50 ? tab.title.slice(0, 47) + '...' : tab.title;
          return `${marker} ${i + 1}. ${title}\n     ${tab.url}`;
        });

        return { output: lines.join('\n'), success: true };
      } catch (error) {
        return {
          output: `Failed to list tabs: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'switch',
    description: 'Switch to a different tab',
    args: [{ name: 'tabId', description: 'Tab ID or title fragment', required: true }],
    async execute(args) {
      const [tabId] = args;
      if (!tabId) {
        return { output: 'Usage: switch <tabId or title>', success: false };
      }

      try {
        const info = cdp.getConnectionInfo();
        await cdp.switchTab(tabId, info?.host, info?.port);
        const pageInfo = await cdp.getPageInfo();
        notifyStateChange();
        return { output: `Switched to: ${pageInfo.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed to switch tab: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'navigate',
    description: 'Navigate to a URL',
    args: [{ name: 'url', description: 'URL to navigate to', required: true }],
    async execute(args) {
      const [url] = args;
      if (!url) {
        return { output: 'Usage: navigate <url>', success: false };
      }

      try {
        await cdp.navigate(url);
        const info = await cdp.getPageInfo();
        return { output: `Navigated to: ${info.title}\n${info.url}`, success: true };
      } catch (error) {
        return {
          output: `Failed to navigate: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'reload',
    description: 'Reload the current page',
    args: [
      {
        name: 'cache',
        description: 'Ignore cache',
        required: false,
        choices: ['--no-cache'],
      },
    ],
    async execute(args) {
      const ignoreCache = args.includes('--no-cache');
      try {
        await cdp.reload(ignoreCache);
        return { output: 'Page reloaded', success: true };
      } catch (error) {
        return {
          output: `Failed to reload: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'back',
    description: 'Go back in browser history',
    async execute() {
      try {
        await cdp.goBack();
        const info = await cdp.getPageInfo();
        return { output: `Back to: ${info.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'forward',
    description: 'Go forward in browser history',
    async execute() {
      try {
        await cdp.goForward();
        const info = await cdp.getPageInfo();
        return { output: `Forward to: ${info.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'click',
    description: 'Click an element by CSS selector',
    args: [{ name: 'selector', description: 'CSS selector', required: true }],
    async execute(args) {
      const [selector] = args;
      if (!selector) {
        return { output: 'Usage: click <selector>', success: false };
      }

      try {
        await cdp.click(selector);
        return { output: `Clicked: ${selector}`, success: true };
      } catch (error) {
        return {
          output: `Failed to click: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'type',
    description: 'Type text into an element',
    args: [
      { name: 'selector', description: 'CSS selector', required: true },
      { name: 'text', description: 'Text to type', required: true },
    ],
    async execute(args) {
      const [selector, ...textParts] = args;
      const text = textParts.join(' ');

      if (!selector || !text) {
        return { output: 'Usage: type <selector> <text>', success: false };
      }

      try {
        await cdp.type(selector, text);
        return { output: `Typed "${text}" into ${selector}`, success: true };
      } catch (error) {
        return {
          output: `Failed to type: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'scroll',
    description: 'Scroll the page',
    args: [
      {
        name: 'direction',
        description: 'Scroll direction',
        required: true,
        choices: ['up', 'down', 'top', 'bottom'],
      },
      { name: 'amount', description: 'Scroll amount in pixels', required: false },
    ],
    async execute(args) {
      const [direction, amountStr] = args;
      if (!direction || !['up', 'down', 'top', 'bottom'].includes(direction)) {
        return { output: 'Usage: scroll <up|down|top|bottom> [amount]', success: false };
      }

      const amount = amountStr ? parseInt(amountStr, 10) : 500;

      try {
        await cdp.scroll(direction as 'up' | 'down' | 'top' | 'bottom', amount);
        return { output: `Scrolled ${direction}`, success: true };
      } catch (error) {
        return {
          output: `Failed to scroll: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'screenshot',
    description: 'Take a screenshot (full page by default)',
    args: [
      { name: 'path', description: 'Output file path', required: false },
      { name: 'viewportOnly', description: 'Capture only viewport', required: false, choices: ['--viewport'] },
    ],
    async execute(args) {
      const fullPage = !args.includes('--viewport');
      const pathArg = args.find((a) => !a.startsWith('--'));
      const outputPath = resolve(pathArg || `screenshot-${Date.now()}.png`);

      try {
        const buffer = await cdp.screenshot({ fullPage });
        await writeFile(outputPath, buffer);
        return {
          output: `Screenshot saved to ${outputPath} (${buffer.length} bytes)`,
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed to screenshot: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'eval',
    description: 'Execute JavaScript in the browser',
    args: [{ name: 'expression', description: 'JavaScript expression', required: true }],
    async execute(args) {
      const expression = args.join(' ');
      if (!expression) {
        return { output: 'Usage: eval <expression>', success: false };
      }

      try {
        const result = await cdp.evaluate(expression);
        const output =
          typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        return { output, success: true };
      } catch (error) {
        return {
          output: `Evaluation failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'info',
    description: 'Get current page info',
    async execute() {
      try {
        const info = await cdp.getPageInfo();
        return {
          output: `Title: ${info.title}\nURL: ${info.url}`,
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'html',
    description: 'Get HTML content of page or element',
    args: [
      { name: 'selector', description: 'CSS selector (optional)', required: false },
      { name: 'output', description: 'Save to file', required: false, choices: ['-o'] },
    ],
    async execute(args) {
      const outputIdx = args.indexOf('-o');
      let selector: string | undefined;
      let outputPath: string | undefined;

      if (outputIdx !== -1) {
        outputPath = args[outputIdx + 1];
        selector = args.slice(0, outputIdx).join(' ') || undefined;
      } else {
        selector = args[0] || undefined;
      }

      try {
        const html = await cdp.getHTML(selector);
        if (outputPath) {
          const resolvedPath = resolve(outputPath);
          await writeFile(resolvedPath, html);
          return { output: `HTML saved to ${resolvedPath} (${html.length} bytes)`, success: true };
        }
        return { output: html, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'text',
    description: 'Get text content of page or element',
    args: [
      { name: 'selector', description: 'CSS selector (optional)', required: false },
      { name: 'output', description: 'Save to file', required: false, choices: ['-o'] },
    ],
    async execute(args) {
      const outputIdx = args.indexOf('-o');
      let selector: string | undefined;
      let outputPath: string | undefined;

      if (outputIdx !== -1) {
        outputPath = args[outputIdx + 1];
        selector = args.slice(0, outputIdx).join(' ') || undefined;
      } else {
        selector = args[0] || undefined;
      }

      try {
        const text = await cdp.getText(selector);
        if (outputPath) {
          const resolvedPath = resolve(outputPath);
          await writeFile(resolvedPath, text);
          return { output: `Text saved to ${resolvedPath} (${text.length} bytes)`, success: true };
        }
        return { output: text, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },

  {
    type: 'cli',
    name: 'status',
    description: 'Show browser connection status',
    async execute() {
      if (!cdp.isConnected()) {
        return { output: 'Not connected to browser', success: true };
      }

      const info = cdp.getConnectionInfo();
      try {
        const pageInfo = await cdp.getPageInfo();
        const tabs = await cdp.getTabs(info?.host, info?.port);
        return {
          output: [
            `Connected to ${info?.host}:${info?.port}`,
            `Tabs: ${tabs.length}`,
            `Current page: ${pageInfo.title}`,
            `URL: ${pageInfo.url}`,
          ].join('\n'),
          success: true,
        };
      } catch (error) {
        return {
          output: `Connected to ${info?.host}:${info?.port} (error getting details)`,
          success: true,
        };
      }
    },
  },
];
