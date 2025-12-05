import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commandRegistry } from './registry.js';
import type { RegisteredCommand, AppState } from './types.js';
import type { PluginCliCommand } from '../plugin/types.js';

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

  describe('registerPluginCommand', () => {
    const createPluginCommand = (name: string, output?: string): PluginCliCommand => ({
      type: 'cli',
      name,
      description: `Plugin command ${name}`,
      async execute() {
        return { output: output ?? `executed ${name}`, success: true };
      },
    });

    it('should register a plugin command', () => {
      const cmd = createPluginCommand('plugincmd');
      commandRegistry.registerPluginCommand('testPlugin', cmd);

      expect(commandRegistry.has('plugincmd')).toBe(true);
      const registered = commandRegistry.get('plugincmd');
      expect(registered?._plugin).toBe('testPlugin');
    });

    it('should add plugin prefix to output', async () => {
      const cmd = createPluginCommand('prefixed', 'hello');
      commandRegistry.registerPluginCommand('myPlugin', cmd);

      const result = await commandRegistry.execute('prefixed', {} as AppState);
      expect(result.output).toBe('[myPlugin] hello');
    });

    it('should ignore command that conflicts with builtin', () => {
      const builtinCmd = createCommand('help');
      commandRegistry.register(builtinCmd);

      const logCallback = vi.fn();
      commandRegistry.setLogCallback(logCallback);

      const pluginCmd = createPluginCommand('help');
      commandRegistry.registerPluginCommand('testPlugin', pluginCmd);

      // Builtin should still be there
      const registered = commandRegistry.get('help');
      expect(registered?._plugin).toBeUndefined();

      // Warning should be logged
      expect(logCallback).toHaveBeenCalledWith(
        "[testPlugin] Warning: command 'help' conflicts with builtin, ignored"
      );
    });

    describe('collision handling', () => {
      it('should create router when two plugins register same command', () => {
        const cmd1 = createPluginCommand('connect', 'browser connected');
        const cmd2 = createPluginCommand('connect', 'proxy connected');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        expect(commandRegistry.has('connect')).toBe(true);
        expect(commandRegistry.hasCollision('connect')).toBe(true);
        expect(commandRegistry.getCollisionPlugins('connect')).toContain('browser');
        expect(commandRegistry.getCollisionPlugins('connect')).toContain('proxy');
      });

      it('should route to correct plugin when collision exists', async () => {
        const cmd1 = createPluginCommand('connect', 'browser connected');
        const cmd2 = createPluginCommand('connect', 'proxy connected');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        const result1 = await commandRegistry.execute('connect browser', {} as AppState);
        expect(result1.output).toBe('[browser] browser connected');

        const result2 = await commandRegistry.execute('connect proxy', {} as AppState);
        expect(result2.output).toBe('[proxy] proxy connected');
      });

      it('should show usage when called without plugin name', async () => {
        const cmd1 = createPluginCommand('connect');
        const cmd2 = createPluginCommand('connect');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        const result = await commandRegistry.execute('connect', {} as AppState);
        expect(result.success).toBe(false);
        expect(result.output).toContain('Usage: connect <plugin>');
        expect(result.output).toContain('browser');
        expect(result.output).toContain('proxy');
      });

      it('should show error for unknown plugin in collision', async () => {
        const cmd1 = createPluginCommand('connect');
        const cmd2 = createPluginCommand('connect');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        const result = await commandRegistry.execute('connect unknown', {} as AppState);
        expect(result.success).toBe(false);
        expect(result.output).toContain("Plugin 'unknown' not found");
      });

      it('should handle three plugins with same command', async () => {
        const cmd1 = createPluginCommand('status', 'browser status');
        const cmd2 = createPluginCommand('status', 'proxy1 status');
        const cmd3 = createPluginCommand('status', 'proxy2 status');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy1', cmd2);
        commandRegistry.registerPluginCommand('proxy2', cmd3);

        expect(commandRegistry.getCollisionPlugins('status')).toHaveLength(3);

        const result1 = await commandRegistry.execute('status browser', {} as AppState);
        expect(result1.output).toBe('[browser] browser status');

        const result2 = await commandRegistry.execute('status proxy1', {} as AppState);
        expect(result2.output).toBe('[proxy1] proxy1 status');

        const result3 = await commandRegistry.execute('status proxy2', {} as AppState);
        expect(result3.output).toBe('[proxy2] proxy2 status');
      });

      it('should pass arguments to plugin command in collision', async () => {
        const cmd1: PluginCliCommand = {
          type: 'cli',
          name: 'restart',
          description: 'Restart',
          async execute(args) {
            return { output: `restarting: ${args.join(', ')}`, success: true };
          },
        };
        const cmd2: PluginCliCommand = {
          type: 'cli',
          name: 'restart',
          description: 'Restart',
          async execute(args) {
            return { output: `proxy restart: ${args.join(', ')}`, success: true };
          },
        };

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        const result = await commandRegistry.execute('restart proxy server1 server2', {} as AppState);
        expect(result.output).toBe('[proxy] proxy restart: server1, server2');
      });
    });

    describe('unregisterPlugin with collisions', () => {
      it('should convert back to direct command when one plugin remains', async () => {
        const cmd1 = createPluginCommand('connect', 'browser connected');
        const cmd2 = createPluginCommand('connect', 'proxy connected');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        expect(commandRegistry.hasCollision('connect')).toBe(true);

        commandRegistry.unregisterPlugin('browser');

        expect(commandRegistry.hasCollision('connect')).toBe(false);
        expect(commandRegistry.has('connect')).toBe(true);

        // Should execute directly without needing plugin name
        const result = await commandRegistry.execute('connect', {} as AppState);
        expect(result.output).toBe('[proxy] proxy connected');
      });

      it('should remove command completely when all plugins unregistered', () => {
        const cmd1 = createPluginCommand('connect');
        const cmd2 = createPluginCommand('connect');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        commandRegistry.unregisterPlugin('browser');
        commandRegistry.unregisterPlugin('proxy');

        expect(commandRegistry.has('connect')).toBe(false);
      });

      it('should keep router when multiple plugins remain after unregister', async () => {
        const cmd1 = createPluginCommand('status', 'browser');
        const cmd2 = createPluginCommand('status', 'proxy1');
        const cmd3 = createPluginCommand('status', 'proxy2');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy1', cmd2);
        commandRegistry.registerPluginCommand('proxy2', cmd3);

        commandRegistry.unregisterPlugin('browser');

        expect(commandRegistry.hasCollision('status')).toBe(true);
        expect(commandRegistry.getCollisionPlugins('status')).toEqual(['proxy1', 'proxy2']);

        // Should still require plugin name
        const result = await commandRegistry.execute('status', {} as AppState);
        expect(result.success).toBe(false);
        expect(result.output).toContain('Usage: status <plugin>');
      });
    });

    describe('getSubcommands', () => {
      it('should return plugin names for colliding commands', () => {
        const cmd1 = createPluginCommand('connect');
        const cmd2 = createPluginCommand('connect');

        commandRegistry.registerPluginCommand('browser', cmd1);
        commandRegistry.registerPluginCommand('proxy', cmd2);

        const subcommands = commandRegistry.getSubcommands('connect');
        expect(subcommands).toContain('browser');
        expect(subcommands).toContain('proxy');
      });

      it('should return empty array for non-colliding command', () => {
        const cmd = createPluginCommand('unique');
        commandRegistry.registerPluginCommand('browser', cmd);

        const subcommands = commandRegistry.getSubcommands('unique');
        expect(subcommands).toEqual([]);
      });

      it('should return choices from command args if defined', () => {
        const cmd: RegisteredCommand = {
          name: 'plugins',
          description: 'Plugin management',
          args: [{ name: 'action', choices: ['list', 'enable', 'disable'] }],
          async execute() {
            return { output: '', success: true };
          },
        };
        commandRegistry.register(cmd);

        const subcommands = commandRegistry.getSubcommands('plugins');
        expect(subcommands).toEqual(['list', 'enable', 'disable']);
      });
    });
  });
});
