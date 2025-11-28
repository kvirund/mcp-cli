import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as cdp from '../cdp/index.js';
import { writeFile } from 'fs/promises';

const tools: Tool[] = [
  {
    name: 'browser_connect',
    description: 'Connect to a browser via Chrome DevTools Protocol',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Browser host (default: localhost)' },
        port: { type: 'number', description: 'Debug port (default: 9222)' },
      },
    },
  },
  {
    name: 'browser_disconnect',
    description: 'Disconnect from the browser',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_list_tabs',
    description: 'List all open browser tabs',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number' },
      },
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate to a URL in the current tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture full page (not just viewport)' },
        outputPath: { type: 'string', description: 'Path to save screenshot' },
      },
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'browser_scroll',
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
  },
  {
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the browser',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'JavaScript expression to evaluate' },
      },
      required: ['expression'],
    },
  },
  {
    name: 'browser_get_page_info',
    description: 'Get current page title and URL',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_get_html',
    description: 'Get HTML content of the page or element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (optional, defaults to full page)' },
      },
    },
  },
  {
    name: 'browser_get_text',
    description: 'Get text content of the page or element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (optional, defaults to full page)' },
      },
    },
  },
  {
    name: 'browser_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        ignoreCache: { type: 'boolean', description: 'Bypass cache when reloading' },
      },
    },
  },
  {
    name: 'browser_go_back',
    description: 'Go back in browser history',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_go_forward',
    description: 'Go forward in browser history',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'browser_switch_tab',
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
  },
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'browser_connect': {
      const host = (args.host as string) || 'localhost';
      const port = (args.port as number) || 9222;
      await cdp.connect({ host, port });
      const version = await cdp.getBrowserVersion(host, port);
      const tabs = await cdp.getTabs(host, port);
      return `Connected to ${version.browser} at ${host}:${port} (${tabs.length} tabs)`;
    }

    case 'browser_disconnect': {
      await cdp.disconnect();
      return 'Disconnected from browser';
    }

    case 'browser_list_tabs': {
      const host = (args.host as string) || 'localhost';
      const port = (args.port as number) || 9222;
      const tabs = await cdp.getTabs(host, port);
      return JSON.stringify(tabs, null, 2);
    }

    case 'browser_navigate': {
      const url = args.url as string;
      await cdp.navigate(url);
      const info = await cdp.getPageInfo();
      return `Navigated to: ${info.title}\n${info.url}`;
    }

    case 'browser_screenshot': {
      const fullPage = (args.fullPage as boolean) || false;
      const outputPath = (args.outputPath as string) || `screenshot-${Date.now()}.png`;
      const buffer = await cdp.screenshot({ fullPage });
      await writeFile(outputPath, buffer);
      return `Screenshot saved to ${outputPath} (${buffer.length} bytes)`;
    }

    case 'browser_click': {
      const selector = args.selector as string;
      await cdp.click(selector);
      return `Clicked: ${selector}`;
    }

    case 'browser_type': {
      const selector = args.selector as string;
      const text = args.text as string;
      await cdp.type(selector, text);
      return `Typed "${text}" into ${selector}`;
    }

    case 'browser_scroll': {
      const direction = args.direction as 'up' | 'down' | 'top' | 'bottom';
      const amount = (args.amount as number) || 500;
      await cdp.scroll(direction, amount);
      return `Scrolled ${direction}`;
    }

    case 'browser_evaluate': {
      const expression = args.expression as string;
      const result = await cdp.evaluate(expression);
      return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    }

    case 'browser_get_page_info': {
      const info = await cdp.getPageInfo();
      return JSON.stringify(info, null, 2);
    }

    case 'browser_get_html': {
      const selector = args.selector as string | undefined;
      return await cdp.getHTML(selector);
    }

    case 'browser_get_text': {
      const selector = args.selector as string | undefined;
      return await cdp.getText(selector);
    }

    case 'browser_reload': {
      const ignoreCache = (args.ignoreCache as boolean) || false;
      await cdp.reload(ignoreCache);
      return 'Page reloaded';
    }

    case 'browser_go_back': {
      await cdp.goBack();
      const info = await cdp.getPageInfo();
      return `Back to: ${info.title}`;
    }

    case 'browser_go_forward': {
      await cdp.goForward();
      const info = await cdp.getPageInfo();
      return `Forward to: ${info.title}`;
    }

    case 'browser_switch_tab': {
      const tabId = args.tabId as string;
      const host = (args.host as string) || 'localhost';
      const port = (args.port as number) || 9222;
      await cdp.switchTab(tabId, host, port);
      const info = await cdp.getPageInfo();
      return `Switched to: ${info.title}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'browser-controller',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
