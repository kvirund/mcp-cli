import { memo } from 'react';
import { Box, Text } from 'ink';
import type { PluginManager } from '../plugin/manager.js';
import type { PluginStatus } from '../plugin/types.js';
import type { McpStatus } from '../types.js';

interface StatusBarProps {
  pluginManager: PluginManager;
  mcp: McpStatus;
}

const indicatorColors: Record<PluginStatus['indicator'], string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
  gray: 'gray',
};

export const StatusBar = memo(function StatusBar({ pluginManager, mcp }: StatusBarProps) {
  const plugins = pluginManager.getAll();

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
      height={3}
    >
      <Box gap={2}>
        {/* Plugin statuses */}
        {Array.from(plugins.entries()).map(([name, info]) => {
          if (!info.enabled) {
            return (
              <Box key={name} gap={1}>
                <Text color="gray">{name}:</Text>
                <Text color="gray">○</Text>
                <Text color="gray">disabled</Text>
              </Box>
            );
          }

          const status = info.plugin.getStatus();
          return (
            <Box key={name} gap={1}>
              <Text color="cyan">{name}:</Text>
              <Text color={indicatorColors[status.indicator]}>●</Text>
              <Text>{status.text}</Text>
            </Box>
          );
        })}

        {plugins.size > 0 && <Text color="gray">│</Text>}

        {/* MCP status */}
        <McpStatusDisplay status={mcp} />
      </Box>
    </Box>
  );
});

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

