import { useCallback, useEffect, useState } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { StatusBar, History, CommandInput } from './components/index.js';
import { useAppState } from './state.js';
import { getAllCommands, executeCommand, registerBuiltinCommands, setStateCallback } from './commands/index.js';

// Register commands once
registerBuiltinCommands();

export function App() {
  const { state, addHistory, setBrowser, setMcp } = useAppState();
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [displayHistory, setDisplayHistory] = useState(state.history);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Get terminal dimensions
  const terminalHeight = stdout?.rows || 24;

  // Setup state callback for commands to update UI
  useEffect(() => {
    setStateCallback((update) => {
      if (update.browser) {
        setBrowser(prev => ({ ...prev, ...update.browser }));
      }
      if (update.mcp) {
        setMcp(prev => ({ ...prev, ...update.mcp }));
      }
    });
  }, [setBrowser, setMcp]);

  // Update display history when state history changes and reset scroll
  useEffect(() => {
    setDisplayHistory(state.history);
    setScrollOffset(0); // Always show latest when history updates
  }, [state.history]);

  // Auto-update time in status bar
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = useCallback(async (input: string) => {
    setCommandHistory(prev => [...prev, input]);
    // Reset scroll to bottom when new command is entered
    setScrollOffset(0);

    // Handle special clear command
    if (input.toLowerCase() === 'clear' || input.toLowerCase() === 'cls') {
      setDisplayHistory([]);
      return;
    }

    const result = await executeCommand(input, state);

    // Handle clear result
    if (result.output === '__CLEAR__') {
      setDisplayHistory([]);
      return;
    }

    addHistory({
      command: input,
      output: result.output,
      success: result.success,
    });

    // Handle exit
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit' || input.toLowerCase() === 'q') {
      setTimeout(() => exit(), 200);
    }
  }, [state, addHistory, exit]);

  const commands = getAllCommands();

  // Calculate available height for history:
  // StatusBar takes ~3 lines (border top, content, border bottom)
  // CommandInput takes ~3 lines minimum (border top, input, border bottom)
  const statusBarHeight = 3;
  const commandInputHeight = 3;
  const historyMaxLines = Math.max(10, terminalHeight - statusBarHeight - commandInputHeight);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <StatusBar browser={state.browser} mcp={state.mcp} />
      <History
        entries={displayHistory}
        maxLines={historyMaxLines}
        scrollOffset={scrollOffset}
        onScroll={setScrollOffset}
      />
      <CommandInput
        commands={commands}
        onSubmit={handleCommand}
        commandHistory={commandHistory}
      />
    </Box>
  );
}
