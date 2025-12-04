/**
 * MCP Client - connects to external MCP servers via stdio or SSE
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { spawn, ChildProcess } from 'child_process';

export interface McpServerConfig {
  /** Command to run (for stdio transport) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL for SSE transport */
  url?: string;
  /** Auto-connect on plugin init */
  autoConnect?: boolean;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, object>;
    required?: string[];
  };
}

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private childProcess: ChildProcess | null = null;
  private config: McpServerConfig;
  private tools: McpToolInfo[] = [];
  private connected = false;
  private lastError: string | null = null;
  private stderrOutput: string[] = [];

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTools(): McpToolInfo[] {
    return this.tools;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getStderrOutput(): string[] {
    return this.stderrOutput;
  }

  getConfig(): McpServerConfig {
    return this.config;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    this.lastError = null;
    this.stderrOutput = [];

    try {
      if (this.config.url) {
        await this.connectSSE();
      } else if (this.config.command) {
        await this.connectStdio();
      } else {
        throw new Error('No connection method specified (need url or command)');
      }

      // Fetch available tools
      await this.refreshTools();
      this.connected = true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('No command specified for stdio transport');
    }

    // Build env, filtering out undefined values from process.env
    const baseEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        baseEnv[key] = value;
      }
    }

    const env: Record<string, string> = {
      ...baseEnv,
      ...this.config.env,
    };

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env,
    });

    this.client = new Client(
      { name: 'mcp-cli-proxy', version: '0.1.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
  }

  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('No URL specified for SSE transport');
    }

    this.transport = new SSEClientTransport(new URL(this.config.url));

    this.client = new Client(
      { name: 'mcp-cli-proxy', version: '0.1.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
  }

  private async refreshTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const result = await this.client.listTools();
    this.tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties: tool.inputSchema.properties as Record<string, object> | undefined,
        required: tool.inputSchema.required,
      },
    }));
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const result = await this.client.callTool({ name, arguments: params });

    // Extract text content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        return textContent.text;
      }
    }

    return result;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }

    this.tools = [];
    this.connected = false;
  }
}
