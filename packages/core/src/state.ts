/**
 * Application state management
 */

import { useState, useCallback, useRef } from 'react';
import type { HistoryEntry, McpStatus } from './types.js';

/**
 * Wrap text to fit terminal width
 * Splits long lines into multiple lines at exactly `width` characters
 */
function wrapText(text: string, width: number): string {
  if (width <= 0) return text;

  return text
    .split('\n')
    .flatMap((line) => {
      if (line.length <= width) return [line];
      // Split long line into chunks
      const chunks: string[] = [];
      for (let i = 0; i < line.length; i += width) {
        chunks.push(line.slice(i, i + width));
      }
      return chunks;
    })
    .join('\n');
}

export interface AppStateHook {
  history: HistoryEntry[];
  mcp: McpStatus;
  addHistory: (entry: Omit<HistoryEntry, 'timestamp' | 'outputRaw'>) => void;
  setMcp: React.Dispatch<React.SetStateAction<McpStatus>>;
  clearHistory: () => void;
  setTerminalWidth: (width: number) => void;
}

const MAX_HISTORY = 100;
const DEFAULT_WIDTH = 120;

export function useAppState(): AppStateHook {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mcp, setMcp] = useState<McpStatus>({
    running: false,
    clients: 0,
  });
  const terminalWidthRef = useRef<number>(DEFAULT_WIDTH);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'timestamp' | 'outputRaw'>) => {
    setHistory((prev) => {
      const width = terminalWidthRef.current - 5; // account for padding + safety margin
      const newEntry: HistoryEntry = {
        ...entry,
        outputRaw: entry.output,
        output: wrapText(entry.output, width),
        timestamp: new Date(),
      };
      const updated = [...prev, newEntry];
      // Keep only last MAX_HISTORY entries
      return updated.slice(-MAX_HISTORY);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const setTerminalWidth = useCallback((width: number) => {
    if (terminalWidthRef.current === width) return;
    terminalWidthRef.current = width;

    // Rewrap all history entries for new width
    setHistory((prev) =>
      prev.map((entry) => ({
        ...entry,
        output: wrapText(entry.outputRaw, width - 5),
      }))
    );
  }, []);

  return {
    history,
    mcp,
    addHistory,
    setMcp,
    clearHistory,
    setTerminalWidth,
  };
}
