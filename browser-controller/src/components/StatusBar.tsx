import { Box, Text } from 'ink';
import type { BrowserStatus, McpStatus } from '../types.js';

interface StatusBarProps {
  browser: BrowserStatus;
  mcp: McpStatus;
}

export function StatusBar({ browser, mcp }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <BrowserStatusDisplay status={browser} />
        <Text color="gray">│</Text>
        <McpStatusDisplay status={mcp} />
      </Box>
      <Text color="gray">{formatTime(new Date())}</Text>
    </Box>
  );
}

function BrowserStatusDisplay({ status }: { status: BrowserStatus }) {
  const indicator = status.connected ? (
    <Text color="green">●</Text>
  ) : (
    <Text color="red">○</Text>
  );

  return (
    <Box gap={1}>
      <Text color="cyan">Browser:</Text>
      {indicator}
      {status.connected ? (
        <>
          <Text>{status.browser || 'Chrome'}</Text>
          <Text color="gray">({status.tabCount} tabs)</Text>
        </>
      ) : (
        <Text color="gray">disconnected</Text>
      )}
    </Box>
  );
}

function McpStatusDisplay({ status }: { status: McpStatus }) {
  const indicator = status.running ? (
    <Text color="green">●</Text>
  ) : (
    <Text color="gray">○</Text>
  );

  return (
    <Box gap={1}>
      <Text color="magenta">MCP:</Text>
      {indicator}
      {status.running ? (
        <>
          <Text>:{status.port}</Text>
          <Text color="gray">({status.clients} clients)</Text>
        </>
      ) : (
        <Text color="gray">stopped</Text>
      )}
    </Box>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
