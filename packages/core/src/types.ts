/**
 * Core types for MCP CLI
 */

/**
 * History entry for command execution
 */
export interface HistoryEntry {
  timestamp: Date;
  command: string;
  output: string;
  success: boolean;
}

/**
 * MCP server status
 */
export interface McpStatus {
  running: boolean;
  port?: number;
  clients: number;
}
