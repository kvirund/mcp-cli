/**
 * Tool Call Logger - logs MCP tool invocations with circular buffer
 */

export interface ToolCallLog {
  timestamp: Date;
  clientId: string;
  tool: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration: number;
}

type LogSubscriber = (entry: ToolCallLog) => void;

const DEFAULT_MAX_SIZE = 1000;

class ToolCallLogger {
  private history: ToolCallLog[] = [];
  private maxSize: number;
  private subscribers: Set<LogSubscriber> = new Set();

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Log a tool call
   */
  log(entry: ToolCallLog): void {
    this.history.push(entry);

    // Circular buffer - remove oldest entries if over max size
    while (this.history.length > this.maxSize) {
      this.history.shift();
    }

    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(entry);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  /**
   * Get log history
   * @param limit - Max number of entries to return (default: 20)
   */
  getHistory(limit: number = 20): ToolCallLog[] {
    return this.history.slice(-limit);
  }

  /**
   * Get all entries
   */
  getAll(): ToolCallLog[] {
    return [...this.history];
  }

  /**
   * Get count of log entries
   */
  getCount(): number {
    return this.history.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Subscribe to new log entries
   * @returns Unsubscribe function
   */
  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Format a log entry for display
   */
  static formatEntry(entry: ToolCallLog): string {
    const time = entry.timestamp.toISOString().substring(11, 23);
    const status = entry.success ? '✓' : '✗';
    const duration = `${entry.duration}ms`;
    const error = entry.error ? ` - ${entry.error}` : '';
    return `[${time}] ${status} ${entry.tool} (${duration})${error}`;
  }
}

// Singleton instance
export const toolCallLogger = new ToolCallLogger();

export { ToolCallLogger };
