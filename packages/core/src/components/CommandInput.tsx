import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Command } from '../commands/types.js';
import type { PluginManager } from '../plugin/manager.js';

interface CommandInputProps {
  commands: Command[];
  pluginManager: PluginManager;
  onSubmit: (command: string) => void;
  commandHistory: string[];
}

export function CommandInput({
  commands,
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
        // Suggest command names
        const matches = commands
          .filter(
            (cmd) =>
              cmd.name.startsWith(value.toLowerCase()) ||
              cmd.aliases?.some((a) => a.startsWith(value.toLowerCase()))
          )
          .map((cmd) => cmd.name)
          .slice(0, 5);
        setSuggestions(matches);
      } else {
        const cmdName = parts[0].toLowerCase();
        const cmd = commands.find(
          (c) => c.name === cmdName || c.aliases?.includes(cmdName)
        );

        // Special handling for 'help' command - suggest plugins and commands
        if (cmdName === 'help' && parts.length === 2) {
          const partial = parts[1].toLowerCase();
          const pluginNames = pluginManager.getPluginNames();
          const commandNames = commands.map((c) => c.name);

          const matches = [...new Set([...pluginNames, ...commandNames])]
            .filter((name) => name.toLowerCase().startsWith(partial))
            .slice(0, 5);

          setSuggestions(matches);
        }
        // Special handling for 'plugins' command
        else if (cmdName === 'plugins' && parts.length === 2) {
          const partial = parts[1].toLowerCase();
          const actions = ['list', 'enable', 'disable'];
          const matches = actions
            .filter((a) => a.startsWith(partial))
            .slice(0, 5);
          setSuggestions(matches);
        }
        // Suggest plugin names for 'plugins enable/disable'
        else if (
          cmdName === 'plugins' &&
          parts.length === 3 &&
          (parts[1] === 'enable' || parts[1] === 'disable')
        ) {
          const partial = parts[2].toLowerCase();
          const pluginNames = pluginManager.getPluginNames();
          const matches = pluginNames
            .filter((name) => name.toLowerCase().startsWith(partial))
            .slice(0, 5);
          setSuggestions(matches);
        }
        // Standard argument suggestions from command definition
        else if (cmd?.args) {
          const argIndex = parts.length - 2;
          const arg = cmd.args[argIndex];
          if (arg?.choices) {
            const currentArg = parts[parts.length - 1].toLowerCase();
            const matches = arg.choices
              .filter((c) => c.toLowerCase().startsWith(currentArg))
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
    [commands, pluginManager]
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
