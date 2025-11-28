import { WebSocketServer, WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMcpServer } from './server.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface TcpServerOptions {
  port: number;
  onClientConnect?: (clientId: string) => void;
  onClientDisconnect?: (clientId: string) => void;
  onClientCountChange?: (count: number) => void;
}

export class TcpMcpServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private servers: Map<string, Server> = new Map();
  private options: TcpServerOptions;
  private clientIdCounter = 0;

  constructor(options: TcpServerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.options.port });

    this.wss.on('connection', (ws) => {
      const clientId = `client-${++this.clientIdCounter}`;
      this.clients.set(clientId, ws);

      const server = createMcpServer();
      this.servers.set(clientId, server);

      this.options.onClientConnect?.(clientId);
      this.options.onClientCountChange?.(this.clients.size);

      // Create a custom transport for this WebSocket connection
      const transport = {
        async start(): Promise<void> {},
        async close(): Promise<void> {
          ws.close();
        },
        async send(message: JSONRPCMessage): Promise<void> {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        },
        onmessage: undefined as ((message: JSONRPCMessage) => void) | undefined,
        onerror: undefined as ((error: Error) => void) | undefined,
        onclose: undefined as (() => void) | undefined,
      };

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as JSONRPCMessage;
          transport.onmessage?.(message);
        } catch (error) {
          transport.onerror?.(error instanceof Error ? error : new Error(String(error)));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.servers.delete(clientId);
        transport.onclose?.();

        this.options.onClientDisconnect?.(clientId);
        this.options.onClientCountChange?.(this.clients.size);
      });

      ws.on('error', (error) => {
        transport.onerror?.(error);
      });

      // Connect server to transport
      server.connect(transport).catch(console.error);
    });

    return new Promise((resolve) => {
      this.wss!.on('listening', resolve);
    });
  }

  async stop(): Promise<void> {
    // Close all client connections
    for (const ws of this.clients.values()) {
      ws.close();
    }
    this.clients.clear();
    this.servers.clear();

    // Close the server
    if (this.wss) {
      return new Promise((resolve, reject) => {
        this.wss!.close((err) => {
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
    return this.wss !== null;
  }
}

let tcpServer: TcpMcpServer | null = null;

export async function startTcpServer(options: TcpServerOptions): Promise<TcpMcpServer> {
  if (tcpServer) {
    await tcpServer.stop();
  }

  tcpServer = new TcpMcpServer(options);
  await tcpServer.start();
  return tcpServer;
}

export async function stopTcpServer(): Promise<void> {
  if (tcpServer) {
    await tcpServer.stop();
    tcpServer = null;
  }
}

export function getTcpServer(): TcpMcpServer | null {
  return tcpServer;
}
