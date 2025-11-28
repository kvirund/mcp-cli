/**
 * Command system types for MCP CLI
 */

/**
 * Command argument definition
 */
export interface CommandArg {
  /** Argument name */
  name: string;
  /** Description for help */
  description: string;
  /** Whether the argument is required */
  required?: boolean;
  /** Predefined choices for autocomplete */
  choices?: string[];
}

/**
 * Result returned by command execution
 */
export interface CommandResult {
  /** Output text to display */
  output: string;
  /** Whether command succeeded */
  success: boolean;
  /** Optional structured data (for programmatic use) */
  data?: unknown;
}

/**
 * Application state passed to commands
 */
export interface AppState {
  /** Get list of plugin names */
  getPluginNames(): string[];
  /** Check if plugin is enabled */
  isPluginEnabled(name: string): boolean;
}

/**
 * Command definition
 */
export interface Command {
  /** Command name (primary) */
  name: string;
  /** Description for help */
  description: string;
  /** Alternative names */
  aliases?: string[];
  /** Argument definitions */
  args?: CommandArg[];
  /**
   * Execute the command
   * @param args - Parsed arguments
   * @param state - Application state
   */
  execute(args: string[], state: AppState): Promise<CommandResult>;
}

/**
 * Internal command with plugin metadata
 */
export interface RegisteredCommand extends Command {
  /** Plugin that registered this command (undefined for builtin) */
  _plugin?: string;
}
