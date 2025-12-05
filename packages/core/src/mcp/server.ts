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
import { toolCallLogger } from './logger.js';

export interface McpServerOptions {
  name: string;
  version: string;
  pluginManager: PluginManager;
  /** Client ID for logging (default: 'stdio') */
  clientId?: string;
}

/**
 * Create an MCP server with dynamic tools from plugins
 */
export function createMcpServer(options: McpServerOptions): Server {
  const { name, version, pluginManager, clientId = 'stdio' } = options;

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
    const startTime = Date.now();

    // Find the tool
    const pluginTools = pluginManager.getMcpTools();
    const tool = pluginTools.find((t) => t.name === toolName);

    if (!tool) {
      toolCallLogger.log({
        timestamp: new Date(),
        clientId,
        tool: toolName,
        params: args || {},
        success: false,
        error: `Unknown tool: ${toolName}`,
        duration: Date.now() - startTime,
      });

      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args || {});
      const text =
        typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);

      toolCallLogger.log({
        timestamp: new Date(),
        clientId,
        tool: toolName,
        params: args || {},
        success: true,
        duration: Date.now() - startTime,
      });

      return {
        content: [{ type: 'text', text }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      toolCallLogger.log({
        timestamp: new Date(),
        clientId,
        tool: toolName,
        params: args || {},
        success: false,
        error: message,
        duration: Date.now() - startTime,
      });

      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Listen for plugin changes to notify clients
  const notifyToolsChanged = () => {
    server.notification({ method: 'notifications/tools/list_changed' });
  };

  pluginManager.on('pluginEnabled', notifyToolsChanged);
  pluginManager.on('pluginDisabled', notifyToolsChanged);
  pluginManager.on('stateChange', notifyToolsChanged);

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
