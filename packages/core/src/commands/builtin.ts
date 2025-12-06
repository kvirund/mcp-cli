/**
 * Built-in commands for MCP CLI
 */

import type { Command, CommandResult, AppState, RegisteredCommand } from './types.js';
import type { PluginManager } from '../plugin/manager.js';
import type { Plugin } from '../plugin/types.js';
import { commandRegistry } from './registry.js';
import { startSseServer, stopSseServer, getSseServer } from '../mcp/sse-transport.js';
import { DEFAULT_MCP_PORT } from '../config.js';
import { toolCallLogger, ToolCallLogger } from '../mcp/logger.js';
import type { ToolStats, ToolStat } from '../mcp/logger.js';

// Store reference to pluginManager for serve command
let _pluginManager: PluginManager | null = null;

/** Calculate byte size of a JSON-serializable value */
function byteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

// Callback for updating MCP status in UI
let _mcpStatusCallback: ((status: { running: boolean; port?: number; clients: number }) => void) | null = null;

export function setMcpStatusCallback(
  callback: (status: { running: boolean; port?: number; clients: number }) => void
): void {
  _mcpStatusCallback = callback;
}

// Callback for streaming logs to UI
let _logStreamCallback: ((message: string) => void) | null = null;
let _logStreamUnsubscribe: (() => void) | null = null;

export function setLogStreamCallback(callback: (message: string) => void): void {
  _logStreamCallback = callback;
}

/**
 * Initialize log streaming based on config
 * @param streamByDefault - whether to enable streaming by default
 */
export function initLogStreaming(streamByDefault: boolean): void {
  if (streamByDefault && _logStreamCallback && !_logStreamUnsubscribe) {
    _logStreamUnsubscribe = toolCallLogger.subscribe((entry) => {
      const formatted = ToolCallLogger.formatEntry(entry);
      _logStreamCallback?.(`[LOG] ${formatted}`);
    });
  }
}

/**
 * Check if log streaming is active
 */
export function isLogStreamingActive(): boolean {
  return _logStreamUnsubscribe !== null;
}

/**
 * Create built-in commands
 * These need access to PluginManager, so we create them dynamically
 */
export function createBuiltinCommands(pluginManager: PluginManager): Command[] {
  _pluginManager = pluginManager;
  const helpCommand: Command = {
    name: 'help',
    description: 'Show help information',
    aliases: ['?', 'h'],
    args: [
      {
        name: 'topic',
        description: 'Command or plugin name',
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [topic] = args;

      if (!topic) {
        return formatGeneralHelp(pluginManager);
      }

      // Check if topic is a plugin
      const plugin = pluginManager.get(topic);
      if (plugin) {
        return formatPluginHelp(plugin);
      }

      // Check if topic is a command
      const command = commandRegistry.get(topic);
      if (command) {
        return formatCommandHelp(command);
      }

      return {
        output: `Unknown topic: ${topic}\nUse 'help' to see available commands and plugins.`,
        success: false,
      };
    },
  };

  const pluginsCommand: Command = {
    name: 'plugins',
    description: 'Manage plugins',
    aliases: ['plugin', 'pl'],
    args: [
      {
        name: 'action',
        description: 'Action: list, enable, disable',
        required: false,
        choices: ['list', 'enable', 'disable'],
      },
      {
        name: 'name',
        description: 'Plugin name',
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [action, name] = args;

      if (!action || action === 'list') {
        return listPlugins(pluginManager);
      }

      if (!name) {
        return {
          output: `Usage: plugins ${action} <plugin-name>`,
          success: false,
        };
      }

      if (action === 'enable') {
        try {
          await pluginManager.enablePlugin(name);
          // Re-register plugin commands
          const pluginCommands = pluginManager.getCliCommands().filter((cmd) => cmd._plugin === name);
          for (const cmd of pluginCommands) {
            commandRegistry.registerPluginCommand(name, cmd);
          }
          return {
            output: `Plugin '${name}' enabled`,
            success: true,
          };
        } catch (error) {
          return {
            output: `Failed to enable plugin: ${error instanceof Error ? error.message : error}`,
            success: false,
          };
        }
      }

      if (action === 'disable') {
        try {
          await pluginManager.disablePlugin(name);
          // Unregister commands
          commandRegistry.unregisterPlugin(name);
          return {
            output: `Plugin '${name}' disabled`,
            success: true,
          };
        } catch (error) {
          return {
            output: `Failed to disable plugin: ${error instanceof Error ? error.message : error}`,
            success: false,
          };
        }
      }

      return {
        output: `Unknown action: ${action}\nAvailable actions: list, enable, disable`,
        success: false,
      };
    },
  };

  const clearCommand: Command = {
    name: 'clear',
    description: 'Clear the screen',
    aliases: ['cls'],

    async execute(): Promise<CommandResult> {
      // Special handling in App.tsx
      return {
        output: '__CLEAR__',
        success: true,
      };
    },
  };

  const exitCommand: Command = {
    name: 'exit',
    description: 'Exit the application',
    aliases: ['quit', 'q'],

    async execute(): Promise<CommandResult> {
      // Special handling in App.tsx
      return {
        output: '__EXIT__',
        success: true,
      };
    },
  };

  const serveCommand: Command = {
    name: 'serve',
    description: 'Start MCP SSE server',
    aliases: ['mcp'],
    args: [
      {
        name: 'port',
        description: `Port number (default: ${DEFAULT_MCP_PORT})`,
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const existingServer = getSseServer();
      if (existingServer) {
        return {
          output: `MCP server already running on port ${existingServer.port}`,
          success: false,
        };
      }

      const port = args[0] ? parseInt(args[0], 10) : DEFAULT_MCP_PORT;
      if (isNaN(port) || port < 1 || port > 65535) {
        return {
          output: 'Invalid port number',
          success: false,
        };
      }

      if (!_pluginManager) {
        return {
          output: 'Plugin manager not initialized',
          success: false,
        };
      }

      try {
        const server = await startSseServer({
          port,
          name: 'mcp-cli',
          version: '0.1.0',
          pluginManager: _pluginManager,
          onClientCountChange: (count) => {
            _mcpStatusCallback?.({ running: true, port, clients: count });
          },
        });
        _mcpStatusCallback?.({ running: true, port: server.port, clients: server.getClientCount() });
        return {
          output: `MCP SSE server started on port ${port}`,
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed to start server: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  };

  const stopCommand: Command = {
    name: 'stop',
    description: 'Stop MCP SSE server',

    async execute(): Promise<CommandResult> {
      const server = getSseServer();
      if (!server) {
        return {
          output: 'MCP server is not running',
          success: false,
        };
      }

      try {
        await stopSseServer();
        _mcpStatusCallback?.({ running: false, clients: 0 });
        return {
          output: 'MCP server stopped',
          success: true,
        };
      } catch (error) {
        return {
          output: `Failed to stop server: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  };

  const toolsCommand: Command = {
    name: 'tools',
    description: 'Manage plugin tools',
    aliases: ['tool'],
    args: [
      {
        name: 'action',
        description: 'Action: list, enable, disable',
        required: false,
        choices: ['list', 'enable', 'disable'],
      },
      {
        name: 'plugin',
        description: 'Plugin name',
        required: false,
      },
      {
        name: 'tool',
        description: 'Tool name (without plugin prefix)',
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [action, pluginName, toolName] = args;

      if (!action || action === 'list') {
        return listTools(pluginManager, pluginName);
      }

      if (!pluginName) {
        return {
          output: `Usage: tools ${action} <plugin> <tool>`,
          success: false,
        };
      }

      if (!toolName) {
        return {
          output: `Usage: tools ${action} ${pluginName} <tool>`,
          success: false,
        };
      }

      if (!pluginManager.has(pluginName)) {
        return {
          output: `Plugin not found: ${pluginName}`,
          success: false,
        };
      }

      if (action === 'enable') {
        try {
          pluginManager.enableTool(pluginName, toolName);
          return {
            output: `Tool '${pluginName}_${toolName}' enabled`,
            success: true,
          };
        } catch (error) {
          return {
            output: `Failed to enable tool: ${error instanceof Error ? error.message : error}`,
            success: false,
          };
        }
      }

      if (action === 'disable') {
        try {
          pluginManager.disableTool(pluginName, toolName);
          return {
            output: `Tool '${pluginName}_${toolName}' disabled`,
            success: true,
          };
        } catch (error) {
          return {
            output: `Failed to disable tool: ${error instanceof Error ? error.message : error}`,
            success: false,
          };
        }
      }

      return {
        output: `Unknown action: ${action}\nAvailable actions: list, enable, disable`,
        success: false,
      };
    },
  };

  const logsCommand: Command = {
    name: 'logs',
    description: 'View MCP tool call logs',
    aliases: ['log'],
    args: [
      {
        name: 'action',
        description: 'Action: on, off, clear, or count',
        required: false,
        choices: ['on', 'off', 'clear'],
      },
      {
        name: 'count',
        description: 'Number of log entries to show (default: 20)',
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [actionOrCount] = args;

      if (actionOrCount === 'clear') {
        toolCallLogger.clear();
        return { output: 'Log history cleared', success: true };
      }

      if (actionOrCount === 'on') {
        if (_logStreamUnsubscribe) {
          return { output: 'Log streaming already active', success: false };
        }

        if (!_logStreamCallback) {
          return { output: 'Log streaming not available', success: false };
        }

        _logStreamUnsubscribe = toolCallLogger.subscribe((entry) => {
          const formatted = ToolCallLogger.formatEntry(entry);
          _logStreamCallback?.(`[LOG] ${formatted}`);
        });

        return { output: 'Log streaming enabled. Use "logs off" to disable.', success: true };
      }

      if (actionOrCount === 'off') {
        if (!_logStreamUnsubscribe) {
          return { output: 'Log streaming not active', success: false };
        }

        _logStreamUnsubscribe();
        _logStreamUnsubscribe = null;
        return { output: 'Log streaming disabled', success: true };
      }

      const count = actionOrCount ? parseInt(actionOrCount, 10) : 20;
      if (isNaN(count) || count < 1) {
        return { output: 'Invalid count', success: false };
      }

      const logs = toolCallLogger.getHistory(count);
      if (logs.length === 0) {
        return { output: 'No log entries', success: true };
      }

      const streamStatus = _logStreamUnsubscribe ? ' (streaming on)' : '';
      const lines = [
        `Tool call logs (${logs.length} of ${toolCallLogger.getCount()} total)${streamStatus}:`,
        '',
        ...logs.map((entry) => ToolCallLogger.formatEntry(entry)),
      ];

      return { output: lines.join('\n'), success: true };
    },
  };

  const statsCommand: Command = {
    name: 'stats',
    description: 'Show tool usage statistics',
    args: [
      {
        name: 'tool',
        description: 'Filter by tool name',
        required: false,
      },
      {
        name: 'action',
        description: 'Action: reset (optional)',
        required: false,
        choices: ['reset'],
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [toolFilter, action] = args;

      // Handle reset action
      if (toolFilter === 'reset' || action === 'reset') {
        await toolCallLogger.resetStats();
        return { output: 'Statistics reset', success: true };
      }

      const stats = toolCallLogger.getStats();

      if (toolFilter) {
        const tool = stats.tools[toolFilter];
        if (!tool) {
          // Try to find partial match
          const matches = Object.keys(stats.tools).filter((name) =>
            name.toLowerCase().includes(toolFilter.toLowerCase())
          );
          if (matches.length === 0) {
            return { output: `No stats for tool: ${toolFilter}`, success: false };
          }
          if (matches.length === 1) {
            return formatToolStatDetail(matches[0], stats.tools[matches[0]]);
          }
          return {
            output: `Multiple matches:\n${matches.map((m) => `  ${m}`).join('\n')}`,
            success: true,
          };
        }
        return formatToolStatDetail(toolFilter, tool);
      }

      // General statistics
      const since = new Date(stats.since).toLocaleDateString();
      const totalBytes = (stats.totals.requestBytes || 0) + (stats.totals.responseBytes || 0);
      const lines = [
        `Tool Usage Statistics (since ${since})`,
        `Total: ${stats.totals.calls} calls, ${stats.totals.success} success, ${stats.totals.errors} errors`,
        `Data: ${formatBytes(stats.totals.requestBytes || 0)} in, ${formatBytes(stats.totals.responseBytes || 0)} out (${formatBytes(totalBytes)} total)`,
      ];

      const toolEntries = Object.entries(stats.tools);
      if (toolEntries.length > 0) {
        lines.push('');
        lines.push('Top tools by usage:');
        lines.push(
          ...toolEntries
            .sort((a, b) => b[1].calls - a[1].calls)
            .slice(0, 10)
            .map(([name, s]) => {
              const avgMs = s.calls > 0 ? Math.round(s.totalDuration / s.calls) : 0;
              return `  ${name}: ${s.calls} calls (${s.success}✓ ${s.errors}✗) avg ${avgMs}ms`;
            })
        );
      }

      lines.push('');
      lines.push("Use 'stats <tool>' for details, 'stats reset' to clear.");

      return { output: lines.join('\n'), success: true };
    },
  };

  const callCommand: Command = {
    name: 'call',
    description: 'Call an MCP tool from a plugin',
    aliases: ['c'],
    args: [
      { name: 'plugin', description: 'Plugin name', required: true },
      { name: 'tool_name', description: 'Tool name', required: true },
      { name: 'args', description: 'Tool arguments as key=value pairs', required: false },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [pluginNameArg, toolName, ...toolArgs] = args;

      if (!pluginNameArg) {
        const available = pluginManager.getPluginNames().join(', ') || '(none)';
        return {
          output: `Usage: tool <plugin> <tool_name> [key=value ...]\nAvailable plugins: ${available}`,
          success: false,
        };
      }

      if (!toolName) {
        const plugin = pluginManager.get(pluginNameArg);
        if (!plugin) {
          const available = pluginManager.getPluginNames().join(', ') || '(none)';
          return {
            output: `Plugin not found: ${pluginNameArg}\nAvailable: ${available}`,
            success: false,
          };
        }
        const exports = plugin.getExports();
        const tools = Object.values(exports)
          .filter((e) => e.type === 'tool')
          .map((e) => e.name);
        return {
          output: `Usage: tool ${pluginNameArg} <tool_name> [key=value ...]\nAvailable tools: ${tools.join(', ') || '(none)'}`,
          success: false,
        };
      }

      // Find plugin
      const plugin = pluginManager.get(pluginNameArg);
      if (!plugin) {
        const available = pluginManager.getPluginNames().join(', ') || '(none)';
        return {
          output: `Plugin not found: ${pluginNameArg}\nAvailable: ${available}`,
          success: false,
        };
      }

      // Find tool in plugin exports
      const exports = plugin.getExports();
      const tool = Object.values(exports).find((e) => e.type === 'tool' && e.name === toolName);
      if (!tool || tool.type !== 'tool') {
        const tools = Object.values(exports)
          .filter((e) => e.type === 'tool')
          .map((e) => e.name);
        return {
          output: `Tool not found: ${toolName}\nAvailable tools in ${pluginNameArg}: ${tools.join(', ') || '(none)'}`,
          success: false,
        };
      }

      // Parse key=value arguments
      const params: Record<string, unknown> = {};
      for (const arg of toolArgs) {
        const eqIndex = arg.indexOf('=');
        if (eqIndex === -1) {
          return {
            output: `Invalid argument format: ${arg}\nExpected: key=value`,
            success: false,
          };
        }
        const key = arg.slice(0, eqIndex);
        const value = arg.slice(eqIndex + 1);
        // Try to parse as JSON, otherwise keep as string
        try {
          params[key] = JSON.parse(value);
        } catch {
          params[key] = value;
        }
      }

      // Call the tool handler with logging
      const startTime = Date.now();
      const fullToolName = `${pluginNameArg}_${toolName}`;
      const requestBytes = byteSize(params);

      try {
        const result = await tool.handler(params);
        const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        const responseBytes = byteSize(output);

        toolCallLogger.log({
          timestamp: new Date(),
          clientId: 'cli',
          tool: fullToolName,
          params,
          success: true,
          duration: Date.now() - startTime,
          requestBytes,
          responseBytes,
        });

        return { output: `[${pluginNameArg}] ${output}`, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorOutput = `Error: ${message}`;

        toolCallLogger.log({
          timestamp: new Date(),
          clientId: 'cli',
          tool: fullToolName,
          params,
          success: false,
          error: message,
          duration: Date.now() - startTime,
          requestBytes,
          responseBytes: byteSize(errorOutput),
        });

        return {
          output: `[${pluginNameArg}] ${errorOutput}`,
          success: false,
        };
      }
    },
  };

  return [helpCommand, pluginsCommand, toolsCommand, callCommand, statsCommand, logsCommand, clearCommand, exitCommand, serveCommand, stopCommand];
}

/**
 * Register built-in commands
 */
export function registerBuiltinCommands(pluginManager: PluginManager): void {
  const commands = createBuiltinCommands(pluginManager);
  for (const cmd of commands) {
    commandRegistry.register(cmd);
  }
}

// Helper functions

function formatGeneralHelp(pluginManager: PluginManager): CommandResult {
  const lines: string[] = ['MCP CLI - Universal command-line interface with plugin support', ''];

  // Built-in commands
  lines.push('Built-in Commands:');
  const byPlugin = commandRegistry.getByPlugin();
  const builtins = byPlugin.get(undefined) ?? [];
  for (const cmd of builtins) {
    const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
    lines.push(`  ${cmd.name}${aliases} - ${cmd.description}`);
  }

  // Plugin commands (grouped by command name, showing collisions)
  const pluginCmds: RegisteredCommand[] = [];
  for (const [pluginName, cmds] of byPlugin) {
    if (pluginName !== undefined) {
      pluginCmds.push(...cmds);
    }
  }

  if (pluginCmds.length > 0) {
    lines.push('');
    lines.push('Plugin Commands:');
    const shown = new Set<string>();
    for (const cmd of pluginCmds) {
      if (shown.has(cmd.name)) continue;
      shown.add(cmd.name);

      if (commandRegistry.hasCollision(cmd.name)) {
        const plugins = commandRegistry.getCollisionPlugins(cmd.name);
        lines.push(`  ${cmd.name} <plugin> - ${cmd.description} (${plugins.join(', ')})`);
      } else {
        lines.push(`  ${cmd.name} - ${cmd.description}`);
      }
    }
  }

  // Plugins list
  const plugins = pluginManager.getAll();
  if (plugins.size > 0) {
    lines.push('');
    lines.push('Plugins:');
    for (const [name, info] of plugins) {
      const status = info.enabled ? '●' : '○';
      const statusColor = info.enabled ? 'enabled' : 'disabled';
      const toolCount = pluginManager.getPluginTools(name).filter((t) => t.enabled).length;
      const toolText = info.enabled && toolCount > 0 ? ` - ${toolCount} tools` : '';
      lines.push(`  ${status} ${name} (${statusColor})${toolText}`);
    }
  }

  lines.push('');
  lines.push("Type 'help <command>' or 'help <plugin>' for more details.");

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function formatPluginHelp(plugin: Plugin): CommandResult {
  const help = plugin.getHelp();
  const lines: string[] = [];

  lines.push(`Plugin: ${plugin.manifest.name} v${plugin.manifest.version}`);
  lines.push('');
  lines.push(help.description);

  if (help.usage) {
    lines.push('');
    lines.push('Usage:');
    lines.push(help.usage);
  }

  if (help.sections?.length) {
    for (const section of help.sections) {
      lines.push('');
      lines.push(`${section.title}:`);
      lines.push(section.content);
    }
  }

  // List commands and tools from exports
  const exports = plugin.getExports();
  const cliCommands = Object.values(exports).filter((e) => e.type === 'cli');
  const mcpTools = Object.values(exports).filter((e) => e.type === 'tool');

  if (cliCommands.length > 0) {
    lines.push('');
    lines.push('Commands:');
    for (const cmd of cliCommands) {
      lines.push(`  ${cmd.name} - ${cmd.description}`);
    }
  }

  if (mcpTools.length > 0) {
    lines.push('');
    lines.push('MCP Tools:');
    for (const tool of mcpTools) {
      lines.push(`  ${tool.name} - ${tool.description}`);
    }
  }

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function formatCommandHelp(command: Command): CommandResult {
  const lines: string[] = [];

  lines.push(`Command: ${command.name}`);
  if (command.aliases?.length) {
    lines.push(`Aliases: ${command.aliases.join(', ')}`);
  }
  lines.push('');
  lines.push(command.description);

  if (command.args?.length) {
    lines.push('');
    lines.push('Arguments:');
    for (const arg of command.args) {
      const required = arg.required ? ' (required)' : ' (optional)';
      const choices = arg.choices?.length ? ` [${arg.choices.join('|')}]` : '';
      lines.push(`  ${arg.name}${required}${choices} - ${arg.description}`);
    }
  }

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function listPlugins(pluginManager: PluginManager): CommandResult {
  const plugins = pluginManager.getAll();

  if (plugins.size === 0) {
    return {
      output: 'No plugins loaded.',
      success: true,
    };
  }

  const lines: string[] = ['Loaded plugins:', ''];

  for (const [name, info] of plugins) {
    const status = info.enabled ? '● enabled' : '○ disabled';
    const { version, description } = info.plugin.manifest;
    lines.push(`  ${name} v${version} [${status}]`);
    lines.push(`    ${description}`);
  }

  lines.push('');
  lines.push("Use 'plugins enable <name>' or 'plugins disable <name>' to toggle.");

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function listTools(pluginManager: PluginManager, pluginName?: string): CommandResult {
  const plugins = pluginManager.getAll();

  if (plugins.size === 0) {
    return {
      output: 'No plugins loaded.',
      success: true,
    };
  }

  const lines: string[] = [];

  // Filter by plugin if specified
  let pluginsToShow: Map<string, { plugin: Plugin; enabled: boolean; disabledTools: Set<string> }>;
  if (pluginName) {
    const info = plugins.get(pluginName);
    if (!info) {
      return {
        output: `Plugin not found: ${pluginName}`,
        success: false,
      };
    }
    pluginsToShow = new Map([[pluginName, info]]);
  } else {
    pluginsToShow = plugins;
  }

  let hasAnyTools = false;

  for (const [name, info] of pluginsToShow) {
    if (!info.enabled) {
      lines.push(`${name}: (disabled)`);
      continue;
    }

    const tools = pluginManager.getPluginTools(name);
    if (tools.length === 0) {
      lines.push(`${name}: (no tools)`);
      continue;
    }

    hasAnyTools = true;
    lines.push(`${name}:`);
    for (const tool of tools) {
      const status = tool.enabled ? '●' : '○';
      const statusText = tool.enabled ? '' : ' [disabled]';
      lines.push(`  ${status} ${name}_${tool.name}${statusText}`);
    }
  }

  if (!hasAnyTools && !pluginName) {
    return {
      output: 'No plugin tools available.',
      success: true,
    };
  }

  lines.push('');
  lines.push("Use 'tools enable <plugin> <tool>' or 'tools disable <plugin> <tool>' to toggle.");

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatToolStatDetail(name: string, stat: ToolStat): CommandResult {
  const successRate = stat.calls > 0 ? ((stat.success / stat.calls) * 100).toFixed(1) : '0.0';
  const avgMs = stat.calls > 0 ? Math.round(stat.totalDuration / stat.calls) : 0;
  const lastUsed = stat.lastUsed ? new Date(stat.lastUsed).toLocaleString() : 'never';
  const totalBytes = (stat.totalRequestBytes || 0) + (stat.totalResponseBytes || 0);

  const lines = [
    `${name}:`,
    `  Calls: ${stat.calls} (${stat.success} success, ${stat.errors} errors)`,
    `  Success rate: ${successRate}%`,
    `  Avg duration: ${avgMs}ms`,
    `  Data: ${formatBytes(stat.totalRequestBytes || 0)} in, ${formatBytes(stat.totalResponseBytes || 0)} out (${formatBytes(totalBytes)} total)`,
    `  Last used: ${lastUsed}`,
  ];

  return { output: lines.join('\n'), success: true };
}
