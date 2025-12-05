/**
 * Command Registry - manages command registration and execution
 */

import type { Command, RegisteredCommand, CommandResult, AppState } from './types.js';
import type { PluginCliCommand } from '../plugin/types.js';

/** Callback for logging warnings */
type LogCallback = (message: string) => void;

class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  /** Commands with collisions: command name -> set of plugin names */
  private collisions: Map<string, Map<string, PluginCliCommand>> = new Map();
  /** Log callback for warnings */
  private logCallback: LogCallback | null = null;

  /**
   * Set log callback for warnings
   */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }

  private log(message: string): void {
    if (this.logCallback) {
      this.logCallback(message);
    }
  }

  /**
   * Register a built-in command
   */
  register(command: RegisteredCommand): void {
    const { name, aliases } = command;

    // Check for conflicts
    if (this.commands.has(name) || this.aliases.has(name)) {
      throw new Error(`Command or alias already registered: ${name}`);
    }

    this.commands.set(name, command);

    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        if (this.commands.has(alias) || this.aliases.has(alias)) {
          throw new Error(`Command or alias already registered: ${alias}`);
        }
        this.aliases.set(alias, name);
      }
    }
  }

  /**
   * Register a plugin CLI command with collision handling
   */
  registerPluginCommand(pluginName: string, cmd: PluginCliCommand): void {
    const existing = this.commands.get(cmd.name);

    // Check for collision with builtin command
    if (existing && !existing._plugin) {
      this.log(`[${pluginName}] Warning: command '${cmd.name}' conflicts with builtin, ignored`);
      return;
    }

    // Check for collision with another plugin's command
    if (existing && existing._plugin) {
      // Convert to router command if not already
      if (!this.collisions.has(cmd.name)) {
        // First collision - save the existing command
        const existingCmd = this.getPluginCommandData(existing._plugin, cmd.name);
        if (existingCmd) {
          this.collisions.set(cmd.name, new Map([[existing._plugin, existingCmd]]));
        } else {
          this.collisions.set(cmd.name, new Map());
        }

        // Replace with router command
        this.commands.set(cmd.name, this.createRouterCommand(cmd.name));
      }

      // Add the new plugin's command to collisions
      this.collisions.get(cmd.name)!.set(pluginName, cmd);
      return;
    }

    // No collision - register directly
    this.commands.set(cmd.name, {
      name: cmd.name,
      description: cmd.description,
      args: cmd.args,
      _plugin: pluginName,
      execute: async (args: string[], state?: AppState): Promise<CommandResult> => {
        const result = await cmd.execute(args, state);
        // Add plugin prefix to output
        return {
          ...result,
          output: result.output ? `[${pluginName}] ${result.output}` : result.output,
        };
      },
    });

    // Store command data for potential future collisions
    if (!this.collisions.has(cmd.name)) {
      this.collisions.set(cmd.name, new Map([[pluginName, cmd]]));
    }
  }

  /**
   * Get the original plugin command data
   */
  private getPluginCommandData(pluginName: string, cmdName: string): PluginCliCommand | undefined {
    return this.collisions.get(cmdName)?.get(pluginName);
  }

  /**
   * Create a router command for handling collisions
   */
  private createRouterCommand(cmdName: string): RegisteredCommand {
    const registry = this;

    return {
      name: cmdName,
      description: `Run ${cmdName} for a plugin`,
      args: [{ name: 'plugin', description: 'Plugin name', required: true }],
      async execute(args: string[], state?: AppState): Promise<CommandResult> {
        const [pluginName, ...restArgs] = args;

        if (!pluginName) {
          const plugins = registry.getCollisionPlugins(cmdName);
          return {
            output: `Usage: ${cmdName} <plugin> [args]\nAvailable plugins: ${plugins.join(', ')}`,
            success: false,
          };
        }

        const pluginCmd = registry.collisions.get(cmdName)?.get(pluginName);
        if (!pluginCmd) {
          const plugins = registry.getCollisionPlugins(cmdName);
          return {
            output: `Plugin '${pluginName}' not found for command '${cmdName}'\nAvailable: ${plugins.join(', ')}`,
            success: false,
          };
        }

        const result = await pluginCmd.execute(restArgs, state);
        return {
          ...result,
          output: result.output ? `[${pluginName}] ${result.output}` : result.output,
        };
      },
    };
  }

  /**
   * Get plugins that have a colliding command
   */
  getCollisionPlugins(cmdName: string): string[] {
    return Array.from(this.collisions.get(cmdName)?.keys() ?? []);
  }

  /**
   * Check if a command has collisions
   */
  hasCollision(cmdName: string): boolean {
    const collision = this.collisions.get(cmdName);
    return collision !== undefined && collision.size > 1;
  }

  /**
   * Unregister a command
   */
  unregister(name: string): void {
    const command = this.commands.get(name);
    if (!command) return;

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    this.commands.delete(name);
  }

  /**
   * Unregister all commands from a plugin
   */
  unregisterPlugin(pluginName: string): void {
    const toRemove: string[] = [];

    for (const [name, cmd] of this.commands) {
      if (cmd._plugin === pluginName) {
        toRemove.push(name);
      }
    }

    for (const name of toRemove) {
      this.unregister(name);
    }

    // Clean up collisions
    for (const [cmdName, plugins] of this.collisions) {
      plugins.delete(pluginName);
      if (plugins.size === 0) {
        this.collisions.delete(cmdName);
      } else if (plugins.size === 1) {
        // Only one plugin left - convert back to direct command
        const [[remainingPlugin, remainingCmd]] = plugins.entries();
        this.commands.set(cmdName, {
          name: cmdName,
          description: remainingCmd.description,
          args: remainingCmd.args,
          _plugin: remainingPlugin,
          execute: async (args: string[], state?: AppState): Promise<CommandResult> => {
            const result = await remainingCmd.execute(args, state);
            return {
              ...result,
              output: result.output ? `[${remainingPlugin}] ${result.output}` : result.output,
            };
          },
        });
      }
    }
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): RegisteredCommand | undefined {
    const lowerName = nameOrAlias.toLowerCase();

    // Try direct lookup
    const direct = this.commands.get(lowerName);
    if (direct) return direct;

    // Try alias
    const primaryName = this.aliases.get(lowerName);
    if (primaryName) {
      return this.commands.get(primaryName);
    }

    // Case-insensitive search
    for (const [name, cmd] of this.commands) {
      if (name.toLowerCase() === lowerName) {
        return cmd;
      }
    }

    return undefined;
  }

  /**
   * Check if command exists
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * Get all unique commands (no aliases)
   */
  getAll(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all command names (including aliases)
   */
  getAllNames(): string[] {
    return [
      ...Array.from(this.commands.keys()),
      ...Array.from(this.aliases.keys()),
    ];
  }

  /**
   * Get commands grouped by plugin
   */
  getByPlugin(): Map<string | undefined, RegisteredCommand[]> {
    const result = new Map<string | undefined, RegisteredCommand[]>();

    for (const cmd of this.commands.values()) {
      const plugin = cmd._plugin;
      const list = result.get(plugin) ?? [];
      list.push(cmd);
      result.set(plugin, list);
    }

    return result;
  }

  /**
   * Get subcommands for autocomplete (for commands with collisions)
   */
  getSubcommands(cmdName: string): string[] {
    if (this.hasCollision(cmdName)) {
      return this.getCollisionPlugins(cmdName);
    }

    const cmd = this.get(cmdName);
    if (cmd?.args?.[0]?.choices) {
      return cmd.args[0].choices;
    }

    return [];
  }

  /**
   * Execute a command
   */
  async execute(input: string, state: AppState): Promise<CommandResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { output: '', success: true };
    }

    const parts = this.parseInput(trimmed);
    const [cmdName, ...args] = parts;

    const command = this.get(cmdName);
    if (!command) {
      return {
        output: `Unknown command: ${cmdName}. Type 'help' for available commands.`,
        success: false,
      };
    }

    try {
      return await command.execute(args, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Error: ${message}`,
        success: false,
      };
    }
  }

  /**
   * Parse command input into parts, handling quoted strings
   */
  private parseInput(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Clear all commands
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
    this.collisions.clear();
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();
