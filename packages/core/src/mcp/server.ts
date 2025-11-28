/**
 * MCP Server with dynamic tools from plugins
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { PluginManager } from '../plugin/manager.js';
import type { McpTool } from '../plugin/types.js';

export interface McpServerOptions {
  name: string;
  version: string;
  pluginManager: PluginManager;
}

/**
 * Create an MCP server with dynamic tools from plugins
 */
export function createMcpServer(options: McpServerOptions): Server {
  const { name, version, pluginManager } = options;

  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools - dynamically collect from enabled plugins
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const pluginTools = pluginManager.getMcpTools();

    const tools: Tool[] = pluginTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return { tools };
  });

  // Call tool - route to appropriate plugin
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;

    // Find the tool
    const pluginTools = pluginManager.getMcpTools();
    const tool = pluginTools.find((t) => t.name === toolName);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args || {});
      const text =
        typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

      return {
        content: [{ type: 'text', text }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Listen for plugin changes to notify clients
  pluginManager.on('pluginEnabled', () => {
    server.notification({ method: 'notifications/tools/list_changed' });
  });

  pluginManager.on('pluginDisabled', () => {
    server.notification({ method: 'notifications/tools/list_changed' });
  });

  return server;
}

/**
 * Start MCP server with stdio transport
 */
export async function startStdioServer(options: McpServerOptions): Promise<void> {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { Server };
