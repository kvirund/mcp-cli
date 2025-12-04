/**
 * MCP Proxy Plugin - connects to external MCP servers and exposes their tools
 *
 * This plugin uses a factory pattern to allow multiple independent instances
 * (e.g., connecting to different MCP servers with different configs)
 */

import type {
  Plugin,
  PluginContext,
  PluginStatus,
  PluginHelp,
  McpTool,
} from '@kvirund/mcp-cli/plugin';

interface CommandResult {
  output: string;
  success: boolean;
  data?: unknown;
}

import { McpClient, McpServerConfig } from './mcp-client.js';

/**
 * Factory function that creates a new proxy plugin instance
 * Each instance has its own state (context, mcpClient, serverConfig)
 */
function createProxyPlugin(): Plugin {
  // Instance-local state
  let context: PluginContext | null = null;
  let mcpClient: McpClient | null = null;
  let serverConfig: McpServerConfig | null = null;

  function notifyStateChange(): void {
    context?.notifyStateChange();
  }

  const plugin: Plugin = {
    manifest: {
      name: 'proxy',
      version: '0.2.0',
      description: 'MCP proxy - connects to external MCP servers',
    },

    async init(ctx: PluginContext): Promise<void> {
      context = ctx;
      serverConfig = ctx.config as McpServerConfig;

      if (!serverConfig.command && !serverConfig.url) {
        ctx.log('Warning: No command or url specified in config');
        return;
      }

      mcpClient = new McpClient(serverConfig);

      // Auto-connect if configured
      if (serverConfig.autoConnect) {
        try {
          await mcpClient.connect();
          ctx.log(`Connected to MCP server`);
          notifyStateChange();
        } catch (error) {
          ctx.log(`Auto-connect failed: ${error instanceof Error ? error.message : error}`);
        }
      }
    },

    async destroy(): Promise<void> {
      if (mcpClient) {
        await mcpClient.disconnect();
        mcpClient = null;
      }
      context = null;
      serverConfig = null;
    },

    commands: [
      {
        name: 'connect',
        description: 'Connect to MCP server',
        async execute(): Promise<CommandResult> {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          if (mcpClient.isConnected()) {
            return { output: 'Already connected', success: false };
          }

          try {
            await mcpClient.connect();
            notifyStateChange();
            const tools = mcpClient.getTools();
            return {
              output: `Connected. Available tools: ${tools.length}`,
              success: true,
            };
          } catch (error) {
            return {
              output: `Connection failed: ${error instanceof Error ? error.message : error}`,
              success: false,
            };
          }
        },
      },
      {
        name: 'disconnect',
        description: 'Disconnect from MCP server',
        async execute(): Promise<CommandResult> {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          if (!mcpClient.isConnected()) {
            return { output: 'Not connected', success: false };
          }

          try {
            await mcpClient.disconnect();
            notifyStateChange();
            return { output: 'Disconnected', success: true };
          } catch (error) {
            return {
              output: `Disconnect failed: ${error instanceof Error ? error.message : error}`,
              success: false,
            };
          }
        },
      },
      {
        name: 'restart',
        description: 'Restart connection to MCP server',
        async execute(): Promise<CommandResult> {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          try {
            if (mcpClient.isConnected()) {
              await mcpClient.disconnect();
            }
            await mcpClient.connect();
            notifyStateChange();
            const tools = mcpClient.getTools();
            return {
              output: `Restarted. Available tools: ${tools.length}`,
              success: true,
            };
          } catch (error) {
            return {
              output: `Restart failed: ${error instanceof Error ? error.message : error}`,
              success: false,
            };
          }
        },
      },
      {
        name: 'status',
        description: 'Show connection status and available tools',
        async execute(): Promise<CommandResult> {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          if (!mcpClient.isConnected()) {
            return { output: 'Not connected', success: true };
          }

          const tools = mcpClient.getTools();
          const lines = [
            `Status: Connected`,
            `Tools: ${tools.length}`,
            '',
            ...tools.map((t) => `  - ${t.name}: ${t.description || '(no description)'}`),
          ];

          return { output: lines.join('\n'), success: true };
        },
      },
    ],

    getStatus(): PluginStatus {
      if (!mcpClient) {
        return { indicator: 'gray', text: 'not initialized' };
      }

      if (mcpClient.isConnected()) {
        const tools = mcpClient.getTools();
        return { indicator: 'green', text: `${tools.length} tools` };
      }

      return { indicator: 'gray', text: 'disconnected' };
    },

    getHelp(): PluginHelp {
      return {
        description: 'Connects to external MCP servers and exposes their tools',
        usage: `Configure in config.json:
{
  "plugins": {
    "my-server": {
      "package": "@kvirund/mcp-cli-plugin-proxy",
      "config": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-xxx"],
        "autoConnect": true
      }
    }
  }
}`,
        sections: [
          {
            title: 'Commands',
            content: `  connect     - Connect to the MCP server
  disconnect  - Disconnect from the server
  restart     - Restart connection (disconnect + connect)
  status      - Show connection status and tools`,
          },
          {
            title: 'Config options',
            content: `  command     - Command to run (for stdio transport)
  args        - Arguments for the command
  env         - Environment variables
  url         - URL for SSE transport
  autoConnect - Auto-connect on startup (default: false)`,
          },
        ],
      };
    },

    getMcpTools(): McpTool[] {
      if (!mcpClient || !mcpClient.isConnected()) {
        return [];
      }

      // Capture mcpClient reference for use in closures
      const client = mcpClient;

      return client.getTools().map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
        async handler(params: Record<string, unknown>): Promise<unknown> {
          if (!client.isConnected()) {
            throw new Error('Not connected to MCP server');
          }
          return client.callTool(tool.name, params);
        },
      }));
    },
  };

  return plugin;
}

export default createProxyPlugin;
