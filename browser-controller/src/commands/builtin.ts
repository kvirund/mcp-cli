import { writeFile } from 'fs/promises';
import { registerCommand, getAllCommands } from './registry.js';
import * as cdp from '../cdp/index.js';
import { startSseServer, stopSseServer, getSseServer } from '../mcp/index.js';
import type { Command } from '../types.js';

// Store callbacks for state updates
type StateUpdateCallback = (update: {
  browser?: Partial<{
    connected: boolean;
    host: string;
    port: number;
    browser: string;
    version: string;
    tabCount: number;
  }>;
  mcp?: Partial<{
    running: boolean;
    port: number;
    clients: number;
  }>;
}) => void;

let stateCallback: StateUpdateCallback | null = null;

export function setStateCallback(cb: StateUpdateCallback): void {
  stateCallback = cb;
}

export function registerBuiltinCommands(): void {
  const helpCommand: Command = {
    name: 'help',
    description: 'Show available commands',
    aliases: ['?', 'h'],
    execute: async () => {
      const cmds = getAllCommands();
      const lines = cmds.map(cmd => {
        const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
        return `  ${cmd.name}${aliases} - ${cmd.description}`;
      });
      return {
        output: 'Available commands:\n' + lines.join('\n'),
        success: true,
      };
    },
  };

  const exitCommand: Command = {
    name: 'exit',
    description: 'Exit the application',
    aliases: ['quit', 'q'],
    execute: async () => {
      await cdp.disconnect();
      setTimeout(() => process.exit(0), 100);
      return { output: 'Goodbye!', success: true };
    },
  };

  const clearCommand: Command = {
    name: 'clear',
    description: 'Clear command history display',
    aliases: ['cls'],
    execute: async () => {
      return { output: '__CLEAR__', success: true };
    },
  };

  const connectCommand: Command = {
    name: 'connect',
    description: 'Connect to browser debug port',
    args: [
      { name: 'port', description: 'Debug port (default: 9222)', required: false },
      { name: 'host', description: 'Host (default: localhost)', required: false },
    ],
    execute: async (args) => {
      const port = args[0] ? parseInt(args[0], 10) : 9222;
      const host = args[1] || 'localhost';

      try {
        await cdp.connect({ host, port });
        const version = await cdp.getBrowserVersion(host, port);
        const tabs = await cdp.getTabs(host, port);

        stateCallback?.({
          browser: {
            connected: true,
            host,
            port,
            browser: version.browser,
            version: version.version,
            tabCount: tabs.length,
          },
        });

        return {
          output: `Connected to ${version.browser} at ${host}:${port} (${tabs.length} tabs)`,
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const disconnectCommand: Command = {
    name: 'disconnect',
    description: 'Disconnect from browser',
    execute: async () => {
      await cdp.disconnect();
      stateCallback?.({
        browser: {
          connected: false,
          tabCount: 0,
        },
      });
      return { output: 'Disconnected from browser', success: true };
    },
  };

  const tabsCommand: Command = {
    name: 'tabs',
    description: 'List browser tabs',
    aliases: ['ls'],
    execute: async (_, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser. Use: connect [port]', success: false };
      }

      try {
        const tabs = await cdp.getTabs(state.browser.host, state.browser.port);
        if (tabs.length === 0) {
          return { output: 'No tabs open', success: true };
        }

        const lines = tabs.map((tab, i) => {
          const marker = tab.active ? '*' : ' ';
          const title = tab.title.length > 40 ? tab.title.slice(0, 37) + '...' : tab.title;
          return `${marker} ${i + 1}. ${title}\n     ${tab.url}`;
        });

        stateCallback?.({ browser: { tabCount: tabs.length } });
        return { output: lines.join('\n'), success: true };
      } catch (error) {
        return {
          output: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const switchCommand: Command = {
    name: 'switch',
    description: 'Switch to a tab by number or title',
    aliases: ['sw'],
    args: [{ name: 'tab', description: 'Tab number or title fragment', required: true }],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }
      if (!args[0]) {
        return { output: 'Usage: switch <tab number or title>', success: false };
      }

      try {
        const tabs = await cdp.getTabs(state.browser.host, state.browser.port);
        const index = parseInt(args[0], 10);

        let targetTab;
        if (!isNaN(index) && index >= 1 && index <= tabs.length) {
          targetTab = tabs[index - 1];
        } else {
          targetTab = tabs.find(t =>
            t.title.toLowerCase().includes(args[0].toLowerCase())
          );
        }

        if (!targetTab) {
          return { output: `Tab not found: ${args[0]}`, success: false };
        }

        await cdp.switchTab(targetTab.id, state.browser.host, state.browser.port);
        return { output: `Switched to: ${targetTab.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed to switch tab: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const navigateCommand: Command = {
    name: 'navigate',
    description: 'Navigate to URL',
    aliases: ['go', 'nav'],
    args: [{ name: 'url', description: 'URL to navigate to', required: true }],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }
      if (!args[0]) {
        return { output: 'Usage: navigate <url>', success: false };
      }

      try {
        await cdp.navigate(args[0]);
        const info = await cdp.getPageInfo();
        return { output: `Navigated to: ${info.title}\n${info.url}`, success: true };
      } catch (error) {
        return {
          output: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const reloadCommand: Command = {
    name: 'reload',
    description: 'Reload current page',
    aliases: ['refresh', 'r'],
    args: [{ name: 'hard', description: 'Ignore cache', choices: ['hard'] }],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      try {
        const ignoreCache = args[0] === 'hard';
        await cdp.reload(ignoreCache);
        return { output: `Page reloaded${ignoreCache ? ' (cache bypassed)' : ''}`, success: true };
      } catch (error) {
        return {
          output: `Reload failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const backCommand: Command = {
    name: 'back',
    description: 'Go back in history',
    execute: async (_, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      try {
        await cdp.goBack();
        const info = await cdp.getPageInfo();
        return { output: `Back to: ${info.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const forwardCommand: Command = {
    name: 'forward',
    description: 'Go forward in history',
    execute: async (_, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      try {
        await cdp.goForward();
        const info = await cdp.getPageInfo();
        return { output: `Forward to: ${info.title}`, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const screenshotCommand: Command = {
    name: 'screenshot',
    description: 'Take a screenshot',
    aliases: ['ss', 'capture'],
    args: [
      {
        name: 'mode',
        description: 'Screenshot mode',
        choices: ['viewport', 'full'],
      },
      { name: 'output', description: 'Output file path' },
    ],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      const mode = args[0] || 'viewport';
      const output = args[1] || `screenshot-${Date.now()}.png`;
      const fullPage = mode === 'full';

      try {
        const buffer = await cdp.screenshot({ fullPage });
        await writeFile(output, buffer);
        return { output: `Screenshot saved: ${output} (${buffer.length} bytes)`, success: true };
      } catch (error) {
        return {
          output: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const scrollCommand: Command = {
    name: 'scroll',
    description: 'Scroll the page',
    args: [
      {
        name: 'direction',
        description: 'Scroll direction',
        choices: ['up', 'down', 'top', 'bottom'],
        required: true,
      },
      { name: 'amount', description: 'Scroll amount in pixels (default: 500)' },
    ],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      const direction = args[0] as 'up' | 'down' | 'top' | 'bottom';
      if (!['up', 'down', 'top', 'bottom'].includes(direction)) {
        return { output: 'Usage: scroll <up|down|top|bottom> [amount]', success: false };
      }

      const amount = args[1] ? parseInt(args[1], 10) : 500;

      try {
        await cdp.scroll(direction, amount);
        return { output: `Scrolled ${direction}${['up', 'down'].includes(direction) ? ` ${amount}px` : ''}`, success: true };
      } catch (error) {
        return {
          output: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const clickCommand: Command = {
    name: 'click',
    description: 'Click an element by CSS selector',
    args: [{ name: 'selector', description: 'CSS selector', required: true }],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }
      if (!args[0]) {
        return { output: 'Usage: click <selector>', success: false };
      }

      try {
        await cdp.click(args[0]);
        return { output: `Clicked: ${args[0]}`, success: true };
      } catch (error) {
        return {
          output: `Click failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const typeCommand: Command = {
    name: 'type',
    description: 'Type text into focused element or selector',
    args: [
      { name: 'selector', description: 'CSS selector', required: true },
      { name: 'text', description: 'Text to type', required: true },
    ],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }
      if (args.length < 2) {
        return { output: 'Usage: type <selector> <text>', success: false };
      }

      try {
        const selector = args[0];
        const text = args.slice(1).join(' ');
        await cdp.type(selector, text);
        return { output: `Typed "${text}" into ${selector}`, success: true };
      } catch (error) {
        return {
          output: `Type failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const evalCommand: Command = {
    name: 'eval',
    description: 'Evaluate JavaScript in browser',
    aliases: ['js'],
    args: [{ name: 'expression', description: 'JavaScript expression', required: true }],
    execute: async (args, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }
      if (!args.length) {
        return { output: 'Usage: eval <javascript expression>', success: false };
      }

      try {
        const expression = args.join(' ');
        const result = await cdp.evaluate(expression);
        const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        return { output, success: true };
      } catch (error) {
        return {
          output: `Eval failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const infoCommand: Command = {
    name: 'info',
    description: 'Show current page info',
    aliases: ['page'],
    execute: async (_, state) => {
      if (!state.browser.connected) {
        return { output: 'Not connected to browser', success: false };
      }

      try {
        const info = await cdp.getPageInfo();
        return { output: `Title: ${info.title}\nURL: ${info.url}`, success: true };
      } catch (error) {
        return {
          output: `Failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const serveCommand: Command = {
    name: 'serve',
    description: 'Start MCP server (SSE)',
    args: [{ name: 'port', description: 'Server port (default: 3000)' }],
    execute: async (args) => {
      if (getSseServer()?.isRunning()) {
        return { output: 'MCP server is already running', success: false };
      }

      const port = args[0] ? parseInt(args[0], 10) : 3000;

      try {
        await startSseServer({
          port,
          onClientConnect: () => {
            const server = getSseServer();
            stateCallback?.({ mcp: { clients: server?.getClientCount() || 0 } });
          },
          onClientDisconnect: () => {
            const server = getSseServer();
            stateCallback?.({ mcp: { clients: server?.getClientCount() || 0 } });
          },
        });

        stateCallback?.({ mcp: { running: true, port, clients: 0 } });
        return { output: `MCP server started on http://localhost:${port}/sse`, success: true };
      } catch (error) {
        return {
          output: `Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const stopCommand: Command = {
    name: 'stop',
    description: 'Stop MCP server',
    execute: async () => {
      const server = getSseServer();
      if (!server?.isRunning()) {
        return { output: 'MCP server is not running', success: false };
      }

      try {
        await stopSseServer();
        stateCallback?.({ mcp: { running: false, clients: 0 } });
        return { output: 'MCP server stopped', success: true };
      } catch (error) {
        return {
          output: `Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  };

  const statusCommand: Command = {
    name: 'status',
    description: 'Show detailed status',
    execute: async (_, state) => {
      const lines = [
        `Browser: ${state.browser.connected ? 'Connected' : 'Disconnected'}`,
        state.browser.connected ? `  Host: ${state.browser.host}:${state.browser.port}` : '',
        state.browser.connected ? `  Browser: ${state.browser.browser || 'Unknown'}` : '',
        state.browser.connected ? `  Tabs: ${state.browser.tabCount}` : '',
        `MCP Server: ${state.mcp.running ? 'Running' : 'Stopped'}`,
        state.mcp.running ? `  Port: ${state.mcp.port}` : '',
        state.mcp.running ? `  Clients: ${state.mcp.clients}` : '',
      ].filter(Boolean);
      return { output: lines.join('\n'), success: true };
    },
  };

  // Register all commands
  [
    helpCommand,
    exitCommand,
    clearCommand,
    connectCommand,
    disconnectCommand,
    tabsCommand,
    switchCommand,
    navigateCommand,
    reloadCommand,
    backCommand,
    forwardCommand,
    screenshotCommand,
    scrollCommand,
    clickCommand,
    typeCommand,
    evalCommand,
    infoCommand,
    serveCommand,
    stopCommand,
    statusCommand,
  ].forEach(registerCommand);
}
