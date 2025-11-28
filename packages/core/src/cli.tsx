#!/usr/bin/env node
/**
 * MCP CLI - Universal command-line interface with plugin support
 */

import { render } from 'ink';
import { Command } from 'commander';
import { App } from './App.js';
import { PluginManager } from './plugin/manager.js';
import { loadConfig } from './config.js';
import { startStdioServer } from './mcp/server.js';
import { startSseServer, stopSseServer } from './mcp/sse-transport.js';

const program = new Command();

program
  .name('mcp-cli')
  .description('Universal CLI with plugin support for MCP servers')
  .version('0.1.0');

program
  .command('interactive', { isDefault: true })
  .description('Start interactive CLI mode')
  .option('-p, --plugin <plugins...>', 'Plugins to load')
  .action(async (options) => {
    const config = await loadConfig();
    const pluginManager = new PluginManager({
      plugins: config.pluginConfig,
    });

    // Load plugins from config or command line
    const pluginsToLoad = options.plugin || config.plugins;

    for (const plugin of pluginsToLoad) {
      try {
        await pluginManager.loadPlugin(plugin);
      } catch (error) {
        console.error(`Failed to load plugin ${plugin}:`, error);
      }
    }

    // Render the app
    const { waitUntilExit } = render(
      <App
        pluginManager={pluginManager}
        welcomeMessage="Welcome to MCP CLI. Type 'help' for available commands."
      />
    );

    await waitUntilExit();

    // Cleanup
    await pluginManager.destroyAll();
    await stopSseServer();
  });

program
  .command('serve')
  .description('Start MCP server')
  .option('-m, --mode <mode>', 'Server mode: stdio or sse', 'stdio')
  .option('-p, --port <port>', 'SSE server port', '3000')
  .option('--plugin <plugins...>', 'Plugins to load')
  .action(async (options) => {
    const config = await loadConfig();
    const pluginManager = new PluginManager({
      plugins: config.pluginConfig,
    });

    // Load plugins
    const pluginsToLoad = options.plugin || config.plugins;

    for (const plugin of pluginsToLoad) {
      try {
        await pluginManager.loadPlugin(plugin);
        console.error(`Loaded plugin: ${plugin}`);
      } catch (error) {
        console.error(`Failed to load plugin ${plugin}:`, error);
      }
    }

    if (options.mode === 'stdio') {
      console.error('Starting MCP server in stdio mode...');
      await startStdioServer({
        name: 'mcp-cli',
        version: '0.1.0',
        pluginManager,
      });
    } else if (options.mode === 'sse') {
      const port = parseInt(options.port, 10);
      console.error(`Starting MCP server in SSE mode on port ${port}...`);
      await startSseServer({
        port,
        name: 'mcp-cli',
        version: '0.1.0',
        pluginManager,
      });
      console.error(`MCP SSE server running at http://localhost:${port}`);
      console.error('Endpoints:');
      console.error(`  SSE: http://localhost:${port}/sse`);
      console.error(`  Health: http://localhost:${port}/health`);

      // Keep process alive
      process.on('SIGINT', async () => {
        console.error('\nShutting down...');
        await stopSseServer();
        await pluginManager.destroyAll();
        process.exit(0);
      });
    } else {
      console.error(`Unknown mode: ${options.mode}`);
      process.exit(1);
    }
  });

program
  .command('plugins')
  .description('List available plugins')
  .action(async () => {
    const config = await loadConfig();
    console.log('Configured plugins:');
    if (config.plugins.length === 0) {
      console.log('  (none)');
    } else {
      for (const plugin of config.plugins) {
        console.log(`  - ${plugin}`);
      }
    }
    console.log('\nConfig location:', (await import('./config.js')).getConfigPath());
  });

program.parse();
