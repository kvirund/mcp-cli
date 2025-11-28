import { useState, useCallback } from 'react';
import type { AppState, HistoryEntry, BrowserStatus, McpStatus } from './types.js';

const initialBrowserStatus: BrowserStatus = {
  connected: false,
  host: 'localhost',
  port: 9222,
  tabCount: 0,
};

const initialMcpStatus: McpStatus = {
  running: false,
  port: 3000,
  clients: 0,
};

export function useAppState() {
  const [browser, setBrowser] = useState<BrowserStatus>(initialBrowserStatus);
  const [mcp, setMcp] = useState<McpStatus>(initialMcpStatus);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'timestamp'>) => {
    setHistory(prev => [...prev.slice(-100), { ...entry, timestamp: new Date() }]);
  }, []);

  const state: AppState = { browser, mcp, history };

  return {
    state,
    setBrowser,
    setMcp,
    addHistory,
  };
}

export type AppStateActions = ReturnType<typeof useAppState>;
