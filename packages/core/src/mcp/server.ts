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

/** Calculate byte size of a JSON-serializable value */
function byteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

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
      const errorText = `Unknown tool: ${toolName}`;
      toolCallLogger.log({
        timestamp: new Date(),
        clientId,
        tool: toolName,
        params: args || {},
        success: false,
        error: errorText,
        duration: Date.now() - startTime,
        requestBytes: byteSize(args || {}),
        responseBytes: byteSize(errorText),
      });

      return {
        content: [{ type: 'text', text: errorText }],
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
        requestBytes: byteSize(args || {}),
        responseBytes: byteSize(text),
      });

      return {
        content: [{ type: 'text', text }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorText = `Error: ${message}`;

      toolCallLogger.log({
        timestamp: new Date(),
        clientId,
        tool: toolName,
        params: args || {},
        success: false,
        error: message,
        duration: Date.now() - startTime,
        requestBytes: byteSize(args || {}),
        responseBytes: byteSize(errorText),
      });

      return {
        content: [{ type: 'text', text: errorText }],
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
