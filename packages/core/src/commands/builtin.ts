/**
 * Built-in commands for MCP CLI
 */

import type { Command, CommandResult, AppState } from './types.js';
import type { PluginManager } from '../plugin/manager.js';
import { commandRegistry } from './registry.js';

/**
 * Create built-in commands
 * These need access to PluginManager, so we create them dynamically
 */
export function createBuiltinCommands(pluginManager: PluginManager): Command[] {
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
          // Re-register commands
          const plugin = pluginManager.get(name);
          if (plugin) {
            for (const cmd of plugin.commands) {
              if (!commandRegistry.has(cmd.name)) {
                commandRegistry.register({ ...cmd, _plugin: name });
              }
            }
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

  return [helpCommand, pluginsCommand, clearCommand, exitCommand];
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

  // Plugin commands
  const plugins = pluginManager.getAll();
  if (plugins.size > 0) {
    lines.push('');
    lines.push('Plugins:');
    for (const [name, info] of plugins) {
      const status = info.enabled ? '●' : '○';
      const statusColor = info.enabled ? 'enabled' : 'disabled';
      lines.push(`  ${status} ${name} (${statusColor}) - ${info.plugin.manifest.description}`);

      if (info.enabled) {
        const pluginCmds = byPlugin.get(name) ?? [];
        if (pluginCmds.length > 0) {
          const cmdNames = pluginCmds.map((c) => c.name).join(', ');
          lines.push(`    Commands: ${cmdNames}`);
        }
      }
    }
  }

  lines.push('');
  lines.push("Type 'help <command>' or 'help <plugin>' for more details.");

  return {
    output: lines.join('\n'),
    success: true,
  };
}

function formatPluginHelp(plugin: import('../plugin/types.js').Plugin): CommandResult {
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

  // List commands
  const pluginCmds = plugin.commands;
  if (pluginCmds.length > 0) {
    lines.push('');
    lines.push('Commands:');
    for (const cmd of pluginCmds) {
      const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
      lines.push(`  ${cmd.name}${aliases} - ${cmd.description}`);
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
