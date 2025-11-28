import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Command } from '../types.js';

interface CommandInputProps {
  commands: Command[];
  onSubmit: (command: string) => void;
  commandHistory: string[];
}

export function CommandInput({ commands, onSubmit, commandHistory }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const updateSuggestions = useCallback((value: string) => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    const parts = value.split(' ');
    const isTypingCommand = parts.length === 1;

    if (isTypingCommand) {
      const matches = commands
        .filter(cmd =>
          cmd.name.startsWith(value.toLowerCase()) ||
          cmd.aliases?.some(a => a.startsWith(value.toLowerCase()))
        )
        .map(cmd => cmd.name)
        .slice(0, 5);
      setSuggestions(matches);
    } else {
      const cmdName = parts[0].toLowerCase();
      const cmd = commands.find(c => c.name === cmdName || c.aliases?.includes(cmdName));

      if (cmd?.args) {
        const argIndex = parts.length - 2;
        const arg = cmd.args[argIndex];
        if (arg?.choices) {
          const currentArg = parts[parts.length - 1].toLowerCase();
          const matches = arg.choices
            .filter(c => c.toLowerCase().startsWith(currentArg))
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
  }, [commands]);

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
        setSelectedSuggestion(prev => Math.max(0, prev - 1));
      } else if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
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
        setSelectedSuggestion(prev => Math.min(suggestions.length - 1, prev + 1));
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
        const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
        setInput(newInput);
        setCursorPosition(cursorPosition - 1);
        updateSuggestions(newInput);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(input.length, prev + 1));
      return;
    }

    if (key.escape) {
      setSuggestions([]);
      return;
    }

    if (key.ctrl && char === 'c') {
      process.exit(0);
    }

    if (key.ctrl && char === 'u') {
      setInput('');
      setCursorPosition(0);
      setSuggestions([]);
      return;
    }

    // Regular character input
    if (char && !key.ctrl && !key.meta) {
      const newInput = input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition + char.length);
      updateSuggestions(newInput);
    }
  });

  const beforeCursor = input.slice(0, cursorPosition);
  const atCursor = input[cursorPosition] || ' ';
  const afterCursor = input.slice(cursorPosition + 1);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      <Box paddingX={1}>
        <Text color="green">&gt; </Text>
        <Text>{beforeCursor}</Text>
        <Text backgroundColor="white" color="black">{atCursor}</Text>
        <Text>{afterCursor}</Text>
      </Box>

      {suggestions.length > 0 && (
        <Box flexDirection="column" paddingX={3} borderTop borderColor="gray">
          {suggestions.map((suggestion, i) => (
            <Text
              key={suggestion}
              color={i === selectedSuggestion ? 'cyan' : 'gray'}
              bold={i === selectedSuggestion}
            >
              {i === selectedSuggestion ? '▸ ' : '  '}{suggestion}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
