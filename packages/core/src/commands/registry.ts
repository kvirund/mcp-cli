/**
 * Command Registry - manages command registration and execution
 */

import type { Command, RegisteredCommand, CommandResult, AppState } from './types.js';

class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a command
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
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();
