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
  PluginExport,
  PluginCliCommand,
  PluginMcpTool,
} from '@kvirund/mcp-cli/plugin';

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
      version: '0.3.0',
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

    getExports(): Record<string, PluginExport> {
      // CLI Commands
      const connectCmd: PluginCliCommand = {
        type: 'cli',
        name: 'connect',
        description: 'Connect to MCP server',
        async execute() {
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
      };

      const disconnectCmd: PluginCliCommand = {
        type: 'cli',
        name: 'disconnect',
        description: 'Disconnect from MCP server',
        async execute() {
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
      };

      const restartCmd: PluginCliCommand = {
        type: 'cli',
        name: 'restart',
        description: 'Restart connection to MCP server',
        async execute() {
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
      };

      const statusCmd: PluginCliCommand = {
        type: 'cli',
        name: 'status',
        description: 'Show connection status and available tools',
        async execute() {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          if (!mcpClient.isConnected()) {
            const lastError = mcpClient.getLastError();
            if (lastError) {
              return { output: `Not connected (last error: ${lastError})`, success: true };
            }
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
      };

      const debugCmd: PluginCliCommand = {
        type: 'cli',
        name: 'debug',
        description: 'Show debug information (config, errors, stderr)',
        async execute() {
          if (!mcpClient) {
            return { output: 'Plugin not initialized', success: false };
          }

          const config = mcpClient.getConfig();
          const lastError = mcpClient.getLastError();
          const stderr = mcpClient.getStderrOutput();

          const lines = [
            'Debug Information:',
            '',
            'Config:',
            `  command: ${config.command || '(none)'}`,
            `  args: ${config.args?.join(' ') || '(none)'}`,
            `  url: ${config.url || '(none)'}`,
            `  autoConnect: ${config.autoConnect ?? false}`,
            `  env: ${config.env ? Object.keys(config.env).join(', ') : '(none)'}`,
            '',
            `Connected: ${mcpClient.isConnected()}`,
            `Last error: ${lastError || '(none)'}`,
          ];

          if (stderr.length > 0) {
            lines.push('', 'Stderr output (last 10 lines):');
            lines.push(...stderr.slice(-10).map((l) => `  ${l}`));
          }

          return { output: lines.join('\n'), success: true };
        },
      };

      // MCP Tools - dynamically generated from connected server
      const exports: Record<string, PluginExport> = {
        connect: connectCmd,
        disconnect: disconnectCmd,
        restart: restartCmd,
        status: statusCmd,
        debug: debugCmd,
      };

      // Add MCP tools if connected
      if (mcpClient && mcpClient.isConnected()) {
        const client = mcpClient;
        for (const tool of client.getTools()) {
          const mcpTool: PluginMcpTool = {
            type: 'tool',
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema,
            async handler(params: Record<string, unknown>): Promise<unknown> {
              if (!client.isConnected()) {
                throw new Error('Not connected to MCP server');
              }
              return client.callTool(tool.name, params);
            },
          };
          exports[`tool_${tool.name}`] = mcpTool;
        }
      }

      return exports;
    },

    getStatus(): PluginStatus {
      if (!mcpClient) {
        return { indicator: 'gray', text: 'not initialized' };
      }

      if (mcpClient.isConnected()) {
        const tools = mcpClient.getTools();
        return { indicator: 'green', text: `${tools.length} tools` };
      }

      // Show error indicator if there was a connection error
      const lastError = mcpClient.getLastError();
      if (lastError) {
        return { indicator: 'red', text: 'error' };
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
  status      - Show connection status and tools
  debug       - Show debug info (config, errors, stderr)`,
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
  };

  return plugin;
}

export default createProxyPlugin;
