/**
 * Main Application Component
 */

import { useCallback, useEffect, useState } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { StatusBar, History, CommandInput } from './components/index.js';
import { useAppState } from './state.js';
import { commandRegistry, registerBuiltinCommands } from './commands/index.js';
import type { PluginManager } from './plugin/manager.js';
import type { McpStatus } from './types.js';

interface AppProps {
  pluginManager: PluginManager;
  welcomeMessage?: string;
}

export function App({ pluginManager, welcomeMessage }: AppProps) {
  const { history, mcp, addHistory, setMcp, clearHistory } = useAppState();
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [displayHistory, setDisplayHistory] = useState(history);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Register built-in commands once
  useEffect(() => {
    registerBuiltinCommands(pluginManager);

    // Register plugin commands
    for (const cmd of pluginManager.getCommands()) {
      if (!commandRegistry.has(cmd.name)) {
        commandRegistry.register(cmd);
      }
    }
  }, [pluginManager]);

  // Get terminal dimensions
  const terminalHeight = stdout?.rows || 24;

  // Update display history when state history changes and reset scroll
  useEffect(() => {
    setDisplayHistory(history);
    setScrollOffset(0);
  }, [history]);

  // Auto-update status bar every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for plugin state changes
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    pluginManager.on('stateChange', handler);
    pluginManager.on('pluginEnabled', handler);
    pluginManager.on('pluginDisabled', handler);
    return () => {
      pluginManager.off('stateChange', handler);
      pluginManager.off('pluginEnabled', handler);
      pluginManager.off('pluginDisabled', handler);
    };
  }, [pluginManager]);

  const handleCommand = useCallback(
    async (input: string) => {
      setCommandHistory((prev) => [...prev, input]);
      setScrollOffset(0);

      // Create app state for command execution
      const appState = {
        getPluginNames: () => pluginManager.getPluginNames(),
        isPluginEnabled: (name: string) => pluginManager.isEnabled(name),
      };

      const result = await commandRegistry.execute(input, appState);

      // Handle special results
      if (result.output === '__CLEAR__') {
        clearHistory();
        setDisplayHistory([]);
        return;
      }

      if (result.output === '__EXIT__') {
        setTimeout(() => exit(), 200);
        return;
      }

      addHistory({
        command: input,
        output: result.output,
        success: result.success,
      });
    },
    [pluginManager, addHistory, clearHistory, exit]
  );

  const commands = commandRegistry.getAll();

  // Calculate available height for history
  const statusBarHeight = 3;
  const commandInputHeight = 3;
  const historyMaxLines = Math.max(10, terminalHeight - statusBarHeight - commandInputHeight);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <StatusBar pluginManager={pluginManager} mcp={mcp} />
      <History
        entries={displayHistory}
        maxLines={historyMaxLines}
        scrollOffset={scrollOffset}
        onScroll={setScrollOffset}
        welcomeMessage={welcomeMessage}
      />
      <CommandInput
        commands={commands}
        pluginManager={pluginManager}
        onSubmit={handleCommand}
        commandHistory={commandHistory}
      />
    </Box>
  );
}

// Export for external use
export type { McpStatus };
