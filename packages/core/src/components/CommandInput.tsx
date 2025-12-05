import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PluginManager } from '../plugin/manager.js';
import { commandRegistry } from '../commands/registry.js';

interface CommandInputProps {
  pluginManager: PluginManager;
  onSubmit: (command: string) => void;
  commandHistory: string[];
}

export function CommandInput({
  pluginManager,
  onSubmit,
  commandHistory,
}: CommandInputProps) {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const updateSuggestions = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setSuggestions([]);
        return;
      }

      const parts = value.split(' ');
      const isTypingCommand = parts.length === 1;

      if (isTypingCommand) {
        // Suggest command names from registry
        const allNames = commandRegistry.getAllNames();
        const matches = allNames
          .filter((name) => name.toLowerCase().startsWith(value.toLowerCase()))
          .slice(0, 5);
        setSuggestions(matches);
      } else {
        const cmdName = parts[0].toLowerCase();
        const cmd = commandRegistry.get(cmdName);
        const lastPart = parts[parts.length - 1].toLowerCase();

        // Multi-level autocomplete: check for subcommands at current level
        const argIndex = parts.length - 2; // 0-based index of the argument being typed

        // Level 1: Command with collision (command <plugin>) or command choices
        if (argIndex === 0) {
          // Check if command has collision - suggest plugins
          const subcommands = commandRegistry.getSubcommands(cmdName);
          if (subcommands.length > 0) {
            const matches = subcommands
              .filter((s) => s.toLowerCase().startsWith(lastPart))
              .slice(0, 5);
            setSuggestions(matches);
            setSelectedSuggestion(0);
            return;
          }

          // Special handling for 'help' command - suggest plugins and commands
          if (cmdName === 'help') {
            const pluginNames = pluginManager.getPluginNames();
            const commandNames = commandRegistry.getAllNames();
            const matches = [...new Set([...pluginNames, ...commandNames])]
              .filter((name) => name.toLowerCase().startsWith(lastPart))
              .slice(0, 5);
            setSuggestions(matches);
            setSelectedSuggestion(0);
            return;
          }
        }

        // Level 2: For 'plugins enable/disable', suggest plugin names
        if (
          argIndex === 1 &&
          cmdName === 'plugins' &&
          (parts[1] === 'enable' || parts[1] === 'disable')
        ) {
          const pluginNames = pluginManager.getPluginNames();
          const matches = pluginNames
            .filter((name) => name.toLowerCase().startsWith(lastPart))
            .slice(0, 5);
          setSuggestions(matches);
          setSelectedSuggestion(0);
          return;
        }

        // Level 2: For 'tools enable/disable', suggest plugin names
        if (
          argIndex === 1 &&
          cmdName === 'tools' &&
          (parts[1] === 'enable' || parts[1] === 'disable')
        ) {
          const pluginNames = pluginManager.getPluginNames();
          const matches = pluginNames
            .filter((name) => name.toLowerCase().startsWith(lastPart))
            .slice(0, 5);
          setSuggestions(matches);
          setSelectedSuggestion(0);
          return;
        }

        // Level 3: For 'tools enable/disable <plugin>', suggest tool names
        if (
          argIndex === 2 &&
          cmdName === 'tools' &&
          (parts[1] === 'enable' || parts[1] === 'disable')
        ) {
          const pluginName = parts[2];
          const tools = pluginManager.getPluginTools(pluginName);
          const matches = tools
            .map((t) => t.name)
            .filter((name) => name.toLowerCase().startsWith(lastPart))
            .slice(0, 5);
          setSuggestions(matches);
          setSelectedSuggestion(0);
          return;
        }

        // Special handling for 'call' command - call MCP tools
        if (cmdName === 'call' || cmdName === 'c') {
          // Level 1: tool [TAB] → list plugins
          if (argIndex === 0) {
            const pluginNames = pluginManager.getEnabledPluginNames();
            const matches = pluginNames
              .filter((name) => name.toLowerCase().startsWith(lastPart))
              .slice(0, 5);
            setSuggestions(matches);
            setSelectedSuggestion(0);
            return;
          }

          // Level 2: tool <plugin> [TAB] → list tools from plugin
          if (argIndex === 1) {
            const pluginName = parts[1];
            const plugin = pluginManager.get(pluginName);
            if (plugin) {
              const exports = plugin.getExports();
              const tools = Object.values(exports)
                .filter((e) => e.type === 'tool')
                .map((e) => e.name);
              const matches = tools
                .filter((name) => name.toLowerCase().startsWith(lastPart))
                .slice(0, 5);
              setSuggestions(matches);
              setSelectedSuggestion(0);
              return;
            }
          }

          // Level 3+: tool <plugin> <tool> [TAB] → suggest parameter names from inputSchema
          if (argIndex >= 2) {
            const pluginName = parts[1];
            const toolName = parts[2];
            const plugin = pluginManager.get(pluginName);
            if (plugin) {
              const exports = plugin.getExports();
              const tool = Object.values(exports).find(
                (e) => e.type === 'tool' && e.name === toolName
              );
              if (tool && tool.type === 'tool' && tool.inputSchema?.properties) {
                // Get already used parameter keys
                const usedKeys = parts.slice(3).map((p) => p.split('=')[0]);
                const availableKeys = Object.keys(tool.inputSchema.properties).filter(
                  (k) => !usedKeys.includes(k)
                );
                // If user is typing a key (no '=' yet), suggest keys
                if (!lastPart.includes('=')) {
                  const matches = availableKeys
                    .filter((k) => k.toLowerCase().startsWith(lastPart))
                    .map((k) => k + '=')
                    .slice(0, 5);
                  setSuggestions(matches);
                  setSelectedSuggestion(0);
                  return;
                }
              }
            }
          }
        }

        // Standard argument suggestions from command definition
        if (cmd?.args && argIndex < cmd.args.length) {
          const arg = cmd.args[argIndex];
          if (arg?.choices) {
            const matches = arg.choices
              .filter((c) => c.toLowerCase().startsWith(lastPart))
              .slice(0, 5);
            setSuggestions(matches);
          } else {
            setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      }
      setSelectedSuggestion(0);
    },
    [pluginManager]
  );

  useInput((char, key) => {
    if (key.return) {
      if (suggestions.length > 0 && selectedSuggestion >= 0) {
        // Apply suggestion
        const parts = input.split(' ');
        parts[parts.length - 1] = suggestions[selectedSuggestion];
        const newInput = parts.join(' ');
        setInput(newInput);
        setCursorPosition(newInput.length);
        setSuggestions([]);
      } else if (input.trim()) {
        onSubmit(input.trim());
        setInput('');
        setCursorPosition(0);
        setSuggestions([]);
        setHistoryIndex(-1);
      }
      return;
    }

    if (key.tab) {
      if (suggestions.length > 0) {
        const parts = input.split(' ');
        parts[parts.length - 1] = suggestions[selectedSuggestion];
        const newInput = parts.join(' ') + ' ';
        setInput(newInput);
        setCursorPosition(newInput.length);
        setSuggestions([]);
      }
      return;
    }

    // Arrow Up/Down without Shift = command history navigation
    // With Shift = screen scroll (handled in History component)
    if (key.upArrow && !key.shift) {
      if (suggestions.length > 0) {
        setSelectedSuggestion((prev) => Math.max(0, prev - 1));
      } else if (commandHistory.length > 0) {
        const newIndex =
          historyIndex < commandHistory.length - 1
            ? historyIndex + 1
            : historyIndex;
        setHistoryIndex(newIndex);
        const historyCmd = commandHistory[commandHistory.length - 1 - newIndex];
        if (historyCmd) {
          setInput(historyCmd);
          setCursorPosition(historyCmd.length);
        }
      }
      return;
    }

    if (key.downArrow && !key.shift) {
      if (suggestions.length > 0) {
        setSelectedSuggestion((prev) =>
          Math.min(suggestions.length - 1, prev + 1)
        );
      } else if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historyCmd = commandHistory[commandHistory.length - 1 - newIndex];
        if (historyCmd) {
          setInput(historyCmd);
          setCursorPosition(historyCmd.length);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setCursorPosition(0);
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newInput =
          input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(cursorPosition - 1);
        updateSuggestions(newInput);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition((prev) => Math.min(input.length, prev + 1));
      return;
    }

    if (key.escape) {
      setSuggestions([]);
      return;
    }

    // Ctrl+C - exit
    if (key.ctrl && char === 'c') {
      process.exit(0);
    }

    // Ctrl+U - clear line before cursor
    if (key.ctrl && char === 'u') {
      const newInput = input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(0);
      setSuggestions([]);
      updateSuggestions(newInput);
      return;
    }

    // Ctrl+K - clear line after cursor
    if (key.ctrl && char === 'k') {
      const newInput = input.slice(0, cursorPosition);
      setInput(newInput);
      updateSuggestions(newInput);
      return;
    }

    // Ctrl+A - move to beginning of line
    if (key.ctrl && char === 'a') {
      setCursorPosition(0);
      return;
    }

    // Ctrl+E - move to end of line
    if (key.ctrl && char === 'e') {
      setCursorPosition(input.length);
      return;
    }

    // Ctrl+W - delete word before cursor
    if (key.ctrl && char === 'w') {
      if (cursorPosition > 0) {
        const beforeCursor = input.slice(0, cursorPosition);
        const afterCursor = input.slice(cursorPosition);

        // Find start of previous word (skip trailing spaces, then find word boundary)
        let pos = cursorPosition - 1;
        while (pos > 0 && input[pos - 1] === ' ') pos--;
        while (pos > 0 && input[pos - 1] !== ' ') pos--;

        const newInput = beforeCursor.slice(0, pos) + afterCursor;
        setInput(newInput);
        setCursorPosition(pos);
        updateSuggestions(newInput);
      }
      return;
    }

    // Alt+D - delete word after cursor
    if (key.meta && char === 'd') {
      if (cursorPosition < input.length) {
        const beforeCursor = input.slice(0, cursorPosition);
        const afterCursor = input.slice(cursorPosition);

        // Find end of next word
        let pos = 0;
        while (pos < afterCursor.length && afterCursor[pos] === ' ') pos++;
        while (pos < afterCursor.length && afterCursor[pos] !== ' ') pos++;

        const newInput = beforeCursor + afterCursor.slice(pos);
        setInput(newInput);
        updateSuggestions(newInput);
      }
      return;
    }

    // Ctrl+Left / Alt+B - move word backward
    if ((key.ctrl && key.leftArrow) || (key.meta && char === 'b')) {
      let pos = cursorPosition - 1;
      while (pos > 0 && input[pos - 1] === ' ') pos--;
      while (pos > 0 && input[pos - 1] !== ' ') pos--;
      setCursorPosition(Math.max(0, pos));
      return;
    }

    // Ctrl+Right / Alt+F - move word forward
    if ((key.ctrl && key.rightArrow) || (key.meta && char === 'f')) {
      let pos = cursorPosition;
      while (pos < input.length && input[pos] === ' ') pos++;
      while (pos < input.length && input[pos] !== ' ') pos++;
      setCursorPosition(pos);
      return;
    }

    // Ctrl+L - clear screen (handled by parent, just signal)
    if (key.ctrl && char === 'l') {
      // Will be handled as a command
      onSubmit('clear');
      setInput('');
      setCursorPosition(0);
      setSuggestions([]);
      setHistoryIndex(-1);
      return;
    }

    // Regular character input
    if (char && !key.ctrl && !key.meta) {
      const newInput =
        input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition + char.length);
      updateSuggestions(newInput);
    }
  });

  const beforeCursor = input.slice(0, cursorPosition);
  const atCursor = input[cursorPosition] || ' ';
  const afterCursor = input.slice(cursorPosition + 1);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" flexShrink={0}>
      <Box paddingX={1}>
        <Text color="green">&gt; </Text>
        <Text>{beforeCursor}</Text>
        <Text backgroundColor="white" color="black">
          {atCursor}
        </Text>
        <Text>{afterCursor}</Text>
      </Box>

      {suggestions.length > 0 && (
        <Box
          flexDirection="column"
          paddingX={3}
          borderTop
          borderColor="gray"
        >
          {suggestions.map((suggestion, i) => (
            <Text
              key={suggestion}
              color={i === selectedSuggestion ? 'cyan' : 'gray'}
              bold={i === selectedSuggestion}
            >
              {i === selectedSuggestion ? '▸ ' : '  '}
              {suggestion}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
