/**
 * Application state management
 */

import { useState, useCallback } from 'react';
import type { HistoryEntry, McpStatus } from './types.js';

export interface AppStateHook {
  history: HistoryEntry[];
  mcp: McpStatus;
  addHistory: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  setMcp: React.Dispatch<React.SetStateAction<McpStatus>>;
  clearHistory: () => void;
}

const MAX_HISTORY = 100;

export function useAppState(): AppStateHook {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mcp, setMcp] = useState<McpStatus>({
    running: false,
    clients: 0,
  });

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    setHistory((prev) => {
      const newEntry: HistoryEntry = {
        ...entry,
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

  return {
    history,
    mcp,
    addHistory,
    setMcp,
    clearHistory,
  };
}
