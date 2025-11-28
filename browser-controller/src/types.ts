export interface BrowserStatus {
  connected: boolean;
  host: string;
  port: number;
  browser?: string;
  version?: string;
  tabCount: number;
  activeTab?: TabInfo;
}

export interface McpStatus {
  running: boolean;
  port: number;
  clients: number;
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface AppState {
  browser: BrowserStatus;
  mcp: McpStatus;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  timestamp: Date;
  command: string;
  output: string;
  success: boolean;
}

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  args?: CommandArg[];
  execute: (args: string[], state: AppState) => Promise<CommandResult>;
}

export interface CommandArg {
  name: string;
  description: string;
  required?: boolean;
  choices?: string[];
}

export interface CommandResult {
  output: string;
  success: boolean;
}
