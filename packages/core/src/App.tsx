/**
 * Main Application Component
 */

import { useCallback, useEffect, useState } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { StatusBar, History, CommandInput } from './components/index.js';
import { useAppState } from './state.js';
import { commandRegistry, registerBuiltinCommands, setMcpStatusCallback, setLogStreamCallback, initLogStreaming } from './commands/index.js';
import { startSseServer } from './mcp/sse-transport.js';
import { DEFAULT_MCP_PORT } from './config.js';
import type { PluginManager } from './plugin/manager.js';
import type { Config } from './config.js';
import type { McpStatus } from './types.js';

interface AppProps {
  pluginManager: PluginManager;
  welcomeMessage?: string;
  config?: Config;
}

export function App({ pluginManager, welcomeMessage, config }: AppProps) {
  const { history, mcp, addHistory, setMcp, clearHistory, setTerminalWidth } = useAppState();
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [displayHistory, setDisplayHistory] = useState(history);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Track terminal width for text wrapping
  const terminalWidth = stdout?.columns || 120;
  useEffect(() => {
    setTerminalWidth(terminalWidth);
  }, [terminalWidth, setTerminalWidth]);

  // Register built-in commands and start MCP server once
  useEffect(() => {
    registerBuiltinCommands(pluginManager);

    // Set up log callback for command registry warnings
    commandRegistry.setLogCallback((message) => {
      addHistory({
        command: '',
        output: message,
        success: false,
      });
    });

    // Register plugin CLI commands with collision handling
    for (const cmd of pluginManager.getCliCommands()) {
      commandRegistry.registerPluginCommand(cmd._plugin, cmd);
    }

    // Set up MCP status callback
    setMcpStatusCallback((status) => {
      setMcp({
        running: status.running,
        port: status.port,
        clients: status.clients,
      });
    });

    // Set up log stream callback
    setLogStreamCallback((message) => {
      addHistory({
        command: '',
        output: message,
        success: true,
      });
    });

    // Initialize log streaming based on config (default: off)
    initLogStreaming(config?.logging?.streamByDefault ?? false);

    // Auto-start MCP server
    const port = config?.mcp?.port ?? DEFAULT_MCP_PORT;
    startSseServer({
      port,
      name: 'mcp-cli',
      version: '0.1.0',
      pluginManager,
      onClientCountChange: (count) => {
        setMcp({ running: true, port, clients: count });
      },
    })
      .then((server) => {
        setMcp({ running: true, port: server.port, clients: server.getClientCount() });
      })
      .catch((err) => {
        addHistory({
          command: '[auto-start]',
          output: `Failed to start MCP server: ${err instanceof Error ? err.message : err}`,
          success: false,
        });
      });
  }, [pluginManager, setMcp, addHistory, config]);

  // Get terminal dimensions
  const terminalHeight = stdout?.rows || 24;

  // Update display history when state history changes and reset scroll
  useEffect(() => {
    setDisplayHistory(history);
    setScrollOffset(0);
  }, [history]);

  // Force re-render trigger for status updates
  const [, setTick] = useState(0);

  // Update status bar periodically (every 1 second)
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

  // Calculate available height for history
  const statusBarHeight = 3;
  const commandInputHeight = 3;
  const historyMaxLines = Math.max(3, terminalHeight - statusBarHeight - commandInputHeight);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <StatusBar pluginManager={pluginManager} mcp={mcp} />
      <Box flexGrow={1} flexShrink={1} flexDirection="column" overflow="hidden">
        <History
          entries={displayHistory}
          maxLines={historyMaxLines}
          scrollOffset={scrollOffset}
          onScroll={setScrollOffset}
          welcomeMessage={welcomeMessage}
        />
      </Box>
      <CommandInput
        pluginManager={pluginManager}
        onSubmit={handleCommand}
        commandHistory={commandHistory}
      />
    </Box>
  );
}

// Export for external use
export type { McpStatus };
