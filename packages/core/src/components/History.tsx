import { Box, Text, useInput } from 'ink';
import type { HistoryEntry } from '../types.js';

interface HistoryProps {
  entries: HistoryEntry[];
  maxLines?: number;
  scrollOffset: number;
  onScroll: (offset: number) => void;
  welcomeMessage?: string;
}

export function History({
  entries,
  maxLines = 15,
  scrollOffset,
  onScroll,
  welcomeMessage = 'Welcome to MCP CLI. Type "help" for commands.',
}: HistoryProps) {
  // scrollOffset is now in LINES, not entries
  // 0 = show latest lines, higher = scroll up to older content

  const totalEntries = entries.length;
  if (totalEntries === 0) {
    return (
      <Box flexDirection="column" height={maxLines} paddingX={1}>
        <Text color="gray"> </Text>
        <Text color="gray">{welcomeMessage}</Text>
      </Box>
    );
  }

  const lineCounts = entries.map((e) => getEntryLineCount(e));
  const totalLines = lineCounts.reduce((a, b) => a + b, 0);

  // Reserve 2 lines for scroll indicators (top and bottom)
  const contentMaxLines = Math.max(1, maxLines - 2);

  // Max scroll = total lines minus one screen
  const maxScrollOffset = Math.max(0, totalLines - contentMaxLines);
  const clampedOffset = Math.min(Math.max(0, scrollOffset), maxScrollOffset);

  // Calculate cumulative line positions for each entry
  // cumulativeLines[i] = total lines from entry 0 to entry i (inclusive)
  const cumulativeLines: number[] = [];
  let cumSum = 0;
  for (const count of lineCounts) {
    cumSum += count;
    cumulativeLines.push(cumSum);
  }

  // Find which lines to display
  // We want to show lines from (totalLines - contentMaxLines - clampedOffset) to (totalLines - clampedOffset)
  const bottomLine = totalLines - clampedOffset; // exclusive
  const topLine = Math.max(0, bottomLine - contentMaxLines); // inclusive

  // Find entries that overlap with [topLine, bottomLine)
  type VisibleEntry = {
    entry: HistoryEntry;
    entryIdx: number;
    skipLinesTop: number; // lines to skip from top of this entry
    skipLinesBottom: number; // lines to skip from bottom of this entry
  };

  const visibleEntries: VisibleEntry[] = [];
  let entryStartLine = 0;

  for (let i = 0; i < totalEntries; i++) {
    const entryEndLine = cumulativeLines[i];

    // Check if entry overlaps with visible range
    if (entryEndLine > topLine && entryStartLine < bottomLine) {
      const skipTop = Math.max(0, topLine - entryStartLine);
      const skipBottom = Math.max(0, entryEndLine - bottomLine);

      visibleEntries.push({
        entry: entries[i],
        entryIdx: i,
        skipLinesTop: skipTop,
        skipLinesBottom: skipBottom,
      });
    }

    entryStartLine = entryEndLine;
  }

  const hasOlder = topLine > 0;
  const hasNewer = bottomLine < totalLines;

  // Handle keyboard input
  useInput((_char, key) => {
    // Shift + Arrow = scroll by 1 line
    if (key.shift && key.upArrow && hasOlder) {
      onScroll(clampedOffset + 1);
    } else if (key.shift && key.downArrow && hasNewer) {
      onScroll(Math.max(0, clampedOffset - 1));
    }
    // Page Up/Down = scroll by half screen
    else if (key.pageUp && hasOlder) {
      onScroll(Math.min(clampedOffset + Math.floor(maxLines / 2), maxScrollOffset));
    } else if (key.pageDown && hasNewer) {
      onScroll(Math.max(0, clampedOffset - Math.floor(maxLines / 2)));
    }
  });

  return (
    <Box flexDirection="column" height={maxLines} paddingX={1}>
      {/* Always reserve line for top indicator */}
      <Text color="gray">{hasOlder ? `▲ Shift+↑ or PgUp (${topLine} lines above)` : '  Shift+↑ or PgUp'}</Text>
      <Box flexDirection="column" height={contentMaxLines} overflow="hidden">
        {visibleEntries.map(({ entry, entryIdx, skipLinesTop, skipLinesBottom }) => (
          <HistoryEntryDisplay
            key={entryIdx}
            entry={entry}
            skipLinesTop={skipLinesTop}
            skipLinesBottom={skipLinesBottom}
          />
        ))}
      </Box>
      {/* Always reserve line for bottom indicator */}
      <Text color="gray">{hasNewer ? `▼ Shift+↓ or PgDn (${totalLines - bottomLine} lines below)` : '  Shift+↓ or PgDn'}</Text>
    </Box>
  );
}

// Calculate how many lines an entry will take
export function getEntryLineCount(entry: HistoryEntry): number {
  // 1 line for command
  // + number of lines in output
  const outputLines = entry.output.split('\n').length;
  return 1 + outputLines;
}

interface HistoryEntryDisplayProps {
  entry: HistoryEntry;
  skipLinesTop?: number;
  skipLinesBottom?: number;
}

function HistoryEntryDisplay({
  entry,
  skipLinesTop = 0,
  skipLinesBottom = 0,
}: HistoryEntryDisplayProps) {
  const timeStr = entry.timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const icon = entry.success ? '✓' : '✗';
  const iconColor = entry.success ? 'green' : 'red';
  const outputLines = entry.output.split('\n');

  // Build all lines of this entry: [command line, ...output lines]
  // Line 0 = command line
  // Lines 1+ = output lines
  const totalLines = 1 + outputLines.length;

  // Calculate which lines to show
  const startLine = skipLinesTop;
  const endLine = totalLines - skipLinesBottom;

  // Check if command line is visible (line 0)
  const showCommandLine = startLine === 0;

  // Calculate which output lines are visible
  const outputStartIdx = Math.max(0, startLine - 1);
  const outputEndIdx = Math.min(outputLines.length, endLine - 1);
  const visibleOutputLines = outputLines.slice(outputStartIdx, outputEndIdx);

  // First visible output line index (for icon placement)
  const firstVisibleOutputIdx = outputStartIdx;

  return (
    <Box flexDirection="column">
      {showCommandLine && (
        <Box gap={1}>
          <Text color="gray">{timeStr}</Text>
          <Text color="cyan">&gt;</Text>
          <Text>{entry.command}</Text>
        </Box>
      )}
      {visibleOutputLines.map((line, i) => {
        const actualIdx = firstVisibleOutputIdx + i;
        const isFirstOutputLine = actualIdx === 0;
        return (
          <Box key={i} paddingLeft={2}>
            {isFirstOutputLine && showCommandLine ? (
              <Text color={iconColor}>{icon} </Text>
            ) : (
              <Text> </Text>
            )}
            <Text color={entry.success ? undefined : 'red'}>{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
