/**
 * Tool Call Logger - logs MCP tool invocations with circular buffer
 * Includes persistent storage for aggregated statistics and daily call logs
 */

import { homedir } from 'os';
import { join } from 'path';
import { appendFile, writeFile, readFile, mkdir } from 'fs/promises';

export interface ToolCallLog {
  timestamp: Date;
  clientId: string;
  tool: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration: number;
  requestBytes?: number;
  responseBytes?: number;
}

export interface ToolStat {
  calls: number;
  success: number;
  errors: number;
  totalDuration: number;
  totalRequestBytes: number;
  totalResponseBytes: number;
  lastUsed: string;
}

export interface ToolStats {
  tools: Record<string, ToolStat>;
  totals: {
    calls: number;
    success: number;
    errors: number;
    requestBytes: number;
    responseBytes: number;
  };
  since: string;
}

type LogSubscriber = (entry: ToolCallLog) => void;

const DEFAULT_MAX_SIZE = 1000;
const STATS_SAVE_DEBOUNCE_MS = 1000;

class ToolCallLogger {
  private history: ToolCallLog[] = [];
  private maxSize: number;
  private subscribers: Set<LogSubscriber> = new Set();

  // Persistence
  private logsDir: string;
  private statsPath: string;
  private stats: ToolStats;
  private writeQueue: Promise<void> = Promise.resolve();
  private saveStatsTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    this.logsDir = join(homedir(), '.mcp-cli', 'logs');
    this.statsPath = join(this.logsDir, 'stats.json');
    this.stats = this.createEmptyStats();

    // Initialize async (don't block constructor)
    this.initialize().catch(() => {
      // Ignore initialization errors - will work in memory-only mode
    });
  }

  /**
   * Initialize persistence (create dirs, load stats)
   */
  private async initialize(): Promise<void> {
    try {
      await mkdir(this.logsDir, { recursive: true });
      this.stats = await this.loadStats();
      this.initialized = true;
    } catch {
      // Fall back to memory-only mode
    }
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): ToolStats {
    return {
      tools: {},
      totals: { calls: 0, success: 0, errors: 0, requestBytes: 0, responseBytes: 0 },
      since: new Date().toISOString(),
    };
  }

  /**
   * Load stats from disk
   */
  private async loadStats(): Promise<ToolStats> {
    try {
      const data = await readFile(this.statsPath, 'utf-8');
      return JSON.parse(data) as ToolStats;
    } catch {
      return this.createEmptyStats();
    }
  }

  /**
   * Save stats to disk (debounced)
   */
  private saveStatsDebounced(): void {
    if (this.saveStatsTimeout) {
      clearTimeout(this.saveStatsTimeout);
    }
    this.saveStatsTimeout = setTimeout(() => {
      this.saveStatsTimeout = null;
      this.writeQueue = this.writeQueue.then(async () => {
        try {
          await writeFile(this.statsPath, JSON.stringify(this.stats, null, 2));
        } catch {
          // Ignore write errors
        }
      });
    }, STATS_SAVE_DEBOUNCE_MS);
  }

  /**
   * Update aggregated statistics
   */
  private updateStats(entry: ToolCallLog): void {
    const toolStat = this.stats.tools[entry.tool] || {
      calls: 0,
      success: 0,
      errors: 0,
      totalDuration: 0,
      totalRequestBytes: 0,
      totalResponseBytes: 0,
      lastUsed: '',
    };

    toolStat.calls++;
    if (entry.success) {
      toolStat.success++;
    } else {
      toolStat.errors++;
    }
    toolStat.totalDuration += entry.duration;
    toolStat.totalRequestBytes += entry.requestBytes || 0;
    toolStat.totalResponseBytes += entry.responseBytes || 0;
    toolStat.lastUsed = entry.timestamp.toISOString();
    this.stats.tools[entry.tool] = toolStat;

    this.stats.totals.calls++;
    if (entry.success) {
      this.stats.totals.success++;
    } else {
      this.stats.totals.errors++;
    }
    this.stats.totals.requestBytes += entry.requestBytes || 0;
    this.stats.totals.responseBytes += entry.responseBytes || 0;

    this.saveStatsDebounced();
  }

  /**
   * Append entry to daily log file
   */
  private appendToLog(entry: ToolCallLog): void {
    const date = entry.timestamp.toISOString().slice(0, 10);
    const logPath = join(this.logsDir, `calls-${date}.jsonl`);
    const line =
      JSON.stringify({
        ts: entry.timestamp.toISOString(),
        client: entry.clientId,
        tool: entry.tool,
        params: entry.params,
        ok: entry.success,
        err: entry.error,
        ms: entry.duration,
        reqBytes: entry.requestBytes,
        resBytes: entry.responseBytes,
      }) + '\n';

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await appendFile(logPath, line);
      } catch {
        // Ignore write errors
      }
    });
  }

  /**
   * Log a tool call
   */
  log(entry: ToolCallLog): void {
    // 1. In-memory buffer
    this.history.push(entry);

    // Circular buffer - remove oldest entries if over max size
    while (this.history.length > this.maxSize) {
      this.history.shift();
    }

    // 2. Update aggregated stats
    this.updateStats(entry);

    // 3. Append to daily log file
    this.appendToLog(entry);

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
   * Clear all history (in-memory only)
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get aggregated statistics
   */
  getStats(): ToolStats {
    return this.stats;
  }

  /**
   * Reset all statistics
   */
  async resetStats(): Promise<void> {
    this.stats = this.createEmptyStats();
    try {
      await writeFile(this.statsPath, JSON.stringify(this.stats, null, 2));
    } catch {
      // Ignore write errors
    }
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
