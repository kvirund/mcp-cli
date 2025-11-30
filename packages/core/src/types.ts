/**
 * Core types for MCP CLI
 */

/**
 * History entry for command execution
 */
export interface HistoryEntry {
  timestamp: Date;
  command: string;
  output: string;       // wrapped for current terminal width
  outputRaw: string;    // original output (for rewrap on resize)
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
