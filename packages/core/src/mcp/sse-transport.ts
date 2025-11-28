/**
 * SSE (Server-Sent Events) transport for MCP
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { PluginManager } from '../plugin/manager.js';
import { createMcpServer } from './server.js';

export interface SseServerOptions {
  port: number;
  name: string;
  version: string;
  pluginManager: PluginManager;
  onClientConnect?: (clientId: string) => void;
  onClientDisconnect?: (clientId: string) => void;
  onClientCountChange?: (count: number) => void;
}

interface SseClient {
  id: string;
  res: ServerResponse;
  server: Server;
  messageHandler?: (message: JSONRPCMessage) => void;
}

export class SseMcpServer {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private clients: Map<string, SseClient> = new Map();
  private options: SseServerOptions;
  private clientIdCounter = 0;

  constructor(options: SseServerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.httpServer = createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/sse' && req.method === 'GET') {
        this.handleSseConnection(req, res);
      } else if (url.pathname === '/message' && req.method === 'POST') {
        this.handleMessage(req, res);
      } else if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', clients: this.clients.size }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(this.options.port, () => {
        resolve();
      });
    });
  }

  private handleSseConnection(req: IncomingMessage, res: ServerResponse): void {
    const clientId = `client-${++this.clientIdCounter}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send initial endpoint event
    const endpointUrl = `http://localhost:${this.options.port}/message?clientId=${clientId}`;
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // Create MCP server for this client with access to plugins
    const server = createMcpServer({
      name: this.options.name,
      version: this.options.version,
      pluginManager: this.options.pluginManager,
    });

    const client: SseClient = { id: clientId, res, server };

    // Create transport for this client
    const transport = {
      async start(): Promise<void> {},
      async close(): Promise<void> {
        res.end();
      },
      async send(message: JSONRPCMessage): Promise<void> {
        if (!res.writableEnded) {
          res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
        }
      },
      onmessage: undefined as ((message: JSONRPCMessage) => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
      onclose: undefined as (() => void) | undefined,
      setMessageHandler(handler: (message: JSONRPCMessage) => void) {
        this.onmessage = handler;
        client.messageHandler = handler;
      },
    };

    this.clients.set(clientId, client);

    this.options.onClientConnect?.(clientId);
    this.options.onClientCountChange?.(this.clients.size);

    // Connect server to transport
    server
      .connect(transport)
      .then(() => {
        if (transport.onmessage) {
          client.messageHandler = transport.onmessage;
        }
      })
      .catch(console.error);

    req.on('close', () => {
      this.clients.delete(clientId);
      transport.onclose?.();
      this.options.onClientDisconnect?.(clientId);
      this.options.onClientCountChange?.(this.clients.size);
    });
  }

  private handleMessage(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');

    if (!clientId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing clientId' }));
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Client not found' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const message = JSON.parse(body) as JSONRPCMessage;

        if (client.messageHandler) {
          client.messageHandler(message);
        }

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'accepted' }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients.values()) {
      client.res.end();
    }
    this.clients.clear();

    if (this.httpServer) {
      return new Promise((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isRunning(): boolean {
    return this.httpServer !== null && this.httpServer.listening;
  }
}

let sseServer: SseMcpServer | null = null;

export async function startSseServer(options: SseServerOptions): Promise<SseMcpServer> {
  if (sseServer) {
    await sseServer.stop();
  }

  sseServer = new SseMcpServer(options);
  await sseServer.start();
  return sseServer;
}

export async function stopSseServer(): Promise<void> {
  if (sseServer) {
    await sseServer.stop();
    sseServer = null;
  }
}

export function getSseServer(): SseMcpServer | null {
  return sseServer;
}
