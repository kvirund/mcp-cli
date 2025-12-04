import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpClient, type McpServerConfig } from './mcp-client.js';

// Mock the MCP SDK with proper class implementations
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class MockClient {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: { arg1: { type: 'string' } },
              required: ['arg1'],
            },
          },
        ],
      });
      callTool = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'result' }],
      });
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: class MockStdioTransport {
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  return {
    SSEClientTransport: class MockSSETransport {
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('McpClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      const config: McpServerConfig = {
        command: 'npx',
        args: ['-y', 'test-server'],
      };

      const client = new McpClient(config);
      expect(client.isConnected()).toBe(false);
      expect(client.getTools()).toEqual([]);
    });
  });

  describe('isConnected', () => {
    it('should return false before connect', () => {
      const client = new McpClient({ command: 'test' });
      expect(client.isConnected()).toBe(false);
    });

    it('should return true after connect', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should throw if already connected', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();

      await expect(client.connect()).rejects.toThrow('Already connected');
    });

    it('should throw if no connection method specified', async () => {
      const client = new McpClient({});
      await expect(client.connect()).rejects.toThrow(
        'No connection method specified'
      );
    });

    it('should connect via stdio when command is specified', async () => {
      const client = new McpClient({
        command: 'npx',
        args: ['-y', 'test-server'],
        env: { TEST: 'value' },
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should connect via SSE when url is specified', async () => {
      const client = new McpClient({
        url: 'http://localhost:3000/sse',
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should fetch tools after connecting', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();

      const tools = client.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
      expect(tools[0].description).toBe('A test tool');
    });
  });

  describe('getTools', () => {
    it('should return empty array before connect', () => {
      const client = new McpClient({ command: 'test' });
      expect(client.getTools()).toEqual([]);
    });

    it('should return tools after connect', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();

      const tools = client.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { arg1: { type: 'string' } },
          required: ['arg1'],
        },
      });
    });
  });

  describe('callTool', () => {
    it('should throw if not connected', async () => {
      const client = new McpClient({ command: 'test' });
      await expect(client.callTool('test', {})).rejects.toThrow('Not connected');
    });

    it('should call tool and return result', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();

      const result = await client.callTool('test_tool', { arg1: 'value' });
      expect(result).toBe('result');
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      const client = new McpClient({ command: 'test' });
      await expect(client.disconnect()).resolves.not.toThrow();
    });

    it('should clear tools after disconnect', async () => {
      const client = new McpClient({ command: 'test' });
      await client.connect();
      expect(client.getTools()).toHaveLength(1);

      await client.disconnect();
      expect(client.getTools()).toEqual([]);
    });
  });
});
