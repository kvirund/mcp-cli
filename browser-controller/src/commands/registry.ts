import type { Command, AppState, CommandResult } from '../types.js';

const commands: Map<string, Command> = new Map();

export function registerCommand(command: Command): void {
  commands.set(command.name, command);
  command.aliases?.forEach(alias => {
    commands.set(alias, command);
  });
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name.toLowerCase());
}

export function getAllCommands(): Command[] {
  const unique = new Map<string, Command>();
  commands.forEach(cmd => unique.set(cmd.name, cmd));
  return Array.from(unique.values());
}

export async function executeCommand(
  input: string,
  state: AppState
): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = getCommand(cmdName);
  if (!command) {
    return {
      output: `Unknown command: ${cmdName}. Type "help" for available commands.`,
      success: false,
    };
  }

  try {
    return await command.execute(args, state);
  } catch (error) {
    return {
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}
