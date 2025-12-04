import { describe, it, expect, beforeEach } from 'vitest';
import { commandRegistry } from './registry.js';
import type { RegisteredCommand, AppState } from './types.js';

describe('CommandRegistry', () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  const createCommand = (name: string, aliases?: string[], plugin?: string): RegisteredCommand => ({
    name,
    description: `Test command ${name}`,
    aliases,
    _plugin: plugin,
    async execute() {
      return { output: `executed ${name}`, success: true };
    },
  });

  describe('register', () => {
    it('should register a command', () => {
      const cmd = createCommand('test');
      commandRegistry.register(cmd);

      expect(commandRegistry.has('test')).toBe(true);
    });

    it('should register command with aliases', () => {
      const cmd = createCommand('test', ['t', 'tst']);
      commandRegistry.register(cmd);

      expect(commandRegistry.has('test')).toBe(true);
      expect(commandRegistry.has('t')).toBe(true);
      expect(commandRegistry.has('tst')).toBe(true);
    });

    it('should throw on duplicate command name', () => {
      const cmd1 = createCommand('test');
      const cmd2 = createCommand('test');

      commandRegistry.register(cmd1);
      expect(() => commandRegistry.register(cmd2)).toThrow('Command or alias already registered: test');
    });

    it('should throw on duplicate alias', () => {
      const cmd1 = createCommand('test1', ['t']);
      const cmd2 = createCommand('test2', ['t']);

      commandRegistry.register(cmd1);
      expect(() => commandRegistry.register(cmd2)).toThrow('Command or alias already registered: t');
    });

    it('should throw when alias conflicts with command name', () => {
      const cmd1 = createCommand('test');
      const cmd2 = createCommand('other', ['test']);

      commandRegistry.register(cmd1);
      expect(() => commandRegistry.register(cmd2)).toThrow('Command or alias already registered: test');
    });
  });

  describe('get', () => {
    it('should get command by name', () => {
      const cmd = createCommand('test');
      commandRegistry.register(cmd);

      const result = commandRegistry.get('test');
      expect(result).toBe(cmd);
    });

    it('should get command by alias', () => {
      const cmd = createCommand('test', ['t']);
      commandRegistry.register(cmd);

      const result = commandRegistry.get('t');
      expect(result).toBe(cmd);
    });

    it('should be case-insensitive', () => {
      const cmd = createCommand('test');
      commandRegistry.register(cmd);

      expect(commandRegistry.get('TEST')).toBe(cmd);
      expect(commandRegistry.get('Test')).toBe(cmd);
    });

    it('should return undefined for unknown command', () => {
      expect(commandRegistry.get('unknown')).toBeUndefined();
    });
  });

  describe('unregister', () => {
    it('should unregister command', () => {
      const cmd = createCommand('test');
      commandRegistry.register(cmd);

      commandRegistry.unregister('test');
      expect(commandRegistry.has('test')).toBe(false);
    });

    it('should unregister command aliases', () => {
      const cmd = createCommand('test', ['t', 'tst']);
      commandRegistry.register(cmd);

      commandRegistry.unregister('test');
      expect(commandRegistry.has('test')).toBe(false);
      expect(commandRegistry.has('t')).toBe(false);
      expect(commandRegistry.has('tst')).toBe(false);
    });

    it('should handle unregistering non-existent command', () => {
      expect(() => commandRegistry.unregister('nonexistent')).not.toThrow();
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister all commands from a plugin', () => {
      const cmd1 = createCommand('cmd1', [], 'testPlugin');
      const cmd2 = createCommand('cmd2', [], 'testPlugin');
      const cmd3 = createCommand('cmd3', [], 'otherPlugin');

      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);
      commandRegistry.register(cmd3);

      commandRegistry.unregisterPlugin('testPlugin');

      expect(commandRegistry.has('cmd1')).toBe(false);
      expect(commandRegistry.has('cmd2')).toBe(false);
      expect(commandRegistry.has('cmd3')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return all registered commands', () => {
      const cmd1 = createCommand('test1');
      const cmd2 = createCommand('test2');

      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);

      const all = commandRegistry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(cmd1);
      expect(all).toContain(cmd2);
    });
  });

  describe('getAllNames', () => {
    it('should return all command names and aliases', () => {
      const cmd = createCommand('test', ['t', 'tst']);
      commandRegistry.register(cmd);

      const names = commandRegistry.getAllNames();
      expect(names).toContain('test');
      expect(names).toContain('t');
      expect(names).toContain('tst');
    });
  });

  describe('getByPlugin', () => {
    it('should group commands by plugin', () => {
      const cmd1 = createCommand('cmd1', [], 'plugin1');
      const cmd2 = createCommand('cmd2', [], 'plugin1');
      const cmd3 = createCommand('cmd3', [], 'plugin2');
      const cmd4 = createCommand('builtin');

      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);
      commandRegistry.register(cmd3);
      commandRegistry.register(cmd4);

      const byPlugin = commandRegistry.getByPlugin();

      expect(byPlugin.get('plugin1')).toHaveLength(2);
      expect(byPlugin.get('plugin2')).toHaveLength(1);
      expect(byPlugin.get(undefined)).toHaveLength(1);
    });
  });

  describe('execute', () => {
    it('should execute command with arguments', async () => {
      const cmd: RegisteredCommand = {
        name: 'echo',
        description: 'Echo args',
        async execute(args) {
          return { output: args.join(' '), success: true };
        },
      };
      commandRegistry.register(cmd);

      const result = await commandRegistry.execute('echo hello world', {} as AppState);
      expect(result.output).toBe('hello world');
      expect(result.success).toBe(true);
    });

    it('should handle empty input', async () => {
      const result = await commandRegistry.execute('', {} as AppState);
      expect(result.output).toBe('');
      expect(result.success).toBe(true);
    });

    it('should handle whitespace input', async () => {
      const result = await commandRegistry.execute('   ', {} as AppState);
      expect(result.output).toBe('');
      expect(result.success).toBe(true);
    });

    it('should return error for unknown command', async () => {
      const result = await commandRegistry.execute('unknown', {} as AppState);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown command');
    });

    it('should catch command errors', async () => {
      const cmd: RegisteredCommand = {
        name: 'fail',
        description: 'Always fails',
        async execute() {
          throw new Error('Command failed');
        },
      };
      commandRegistry.register(cmd);

      const result = await commandRegistry.execute('fail', {} as AppState);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Command failed');
    });

    it('should parse quoted strings', async () => {
      const cmd: RegisteredCommand = {
        name: 'test',
        description: 'Test',
        async execute(args) {
          return { output: JSON.stringify(args), success: true };
        },
      };
      commandRegistry.register(cmd);

      const result = await commandRegistry.execute('test "hello world" foo', {} as AppState);
      expect(JSON.parse(result.output)).toEqual(['hello world', 'foo']);
    });

    it('should parse single-quoted strings', async () => {
      const cmd: RegisteredCommand = {
        name: 'test',
        description: 'Test',
        async execute(args) {
          return { output: JSON.stringify(args), success: true };
        },
      };
      commandRegistry.register(cmd);

      const result = await commandRegistry.execute("test 'hello world' bar", {} as AppState);
      expect(JSON.parse(result.output)).toEqual(['hello world', 'bar']);
    });
  });

  describe('clear', () => {
    it('should clear all commands and aliases', () => {
      const cmd = createCommand('test', ['t']);
      commandRegistry.register(cmd);

      commandRegistry.clear();

      expect(commandRegistry.has('test')).toBe(false);
      expect(commandRegistry.has('t')).toBe(false);
      expect(commandRegistry.getAll()).toHaveLength(0);
    });
  });
});
