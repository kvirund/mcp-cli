#!/usr/bin/env node
/**
 * MCP CLI - Universal command-line interface with plugin support
 */

import { render } from 'ink';
import { Command } from 'commander';
import { createRequire } from 'module';
import { App } from './App.js';
import { PluginManager } from './plugin/manager.js';
import { loadConfig, normalizeConfig, DEFAULT_MCP_PORT } from './config.js';
import { startStdioServer } from './mcp/server.js';
import { startSseServer, stopSseServer } from './mcp/sse-transport.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('mcp-cli')
  .description('Universal CLI with plugin support for MCP servers')
  .version(pkg.version);

program
  .command('interactive', { isDefault: true })
  .description('Start interactive CLI mode')
  .action(async () => {
    const config = await loadConfig();
    const normalized = normalizeConfig(config);
    const pluginManager = new PluginManager({
      plugins: normalized.pluginConfigs,
      disabledTools: normalized.disabledTools,
    });

    // Load plugins from config
    const loadedPlugins: string[] = [];
    const failedPlugins: string[] = [];
    for (const [pluginName, packageName] of Object.entries(normalized.plugins)) {
      try {
        await pluginManager.loadPlugin(pluginName, packageName);
        loadedPlugins.push(pluginName);
      } catch (error) {
        failedPlugins.push(`${pluginName}: ${error instanceof Error ? error.message : error}`);
        console.error(`Failed to load plugin ${pluginName}:`, error);
      }
    }

    // Debug output
    if (loadedPlugins.length > 0 || failedPlugins.length > 0) {
      console.error(`[plugins] Loaded: ${loadedPlugins.join(', ') || '(none)'}`);
      if (failedPlugins.length > 0) {
        console.error(`[plugins] Failed: ${failedPlugins.join('; ')}`);
      }
      // Show CLI commands per plugin
      for (const pluginName of loadedPlugins) {
        const plugin = pluginManager.get(pluginName);
        if (plugin) {
          const exports = plugin.getExports();
          const cliCmds = Object.values(exports).filter(e => e.type === 'cli').map(e => e.name);
          console.error(`[${pluginName}] CLI commands: ${cliCmds.join(', ') || '(none)'}`);
        }
      }
    }

    // Render the app with patchConsole disabled to reduce flickering
    const { waitUntilExit } = render(
      <App
        pluginManager={pluginManager}
        welcomeMessage="Welcome to MCP CLI. Type 'help' for available commands."
        config={config}
      />,
      { patchConsole: false }
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
  .option('-p, --port <port>', 'SSE server port (default: from config or 3000)')
  .action(async (options) => {
    const config = await loadConfig();
    const normalized = normalizeConfig(config);
    const pluginManager = new PluginManager({
      plugins: normalized.pluginConfigs,
      disabledTools: normalized.disabledTools,
    });

    // Load plugins from config
    for (const [pluginName, packageName] of Object.entries(normalized.plugins)) {
      try {
        await pluginManager.loadPlugin(pluginName, packageName);
        console.error(`Loaded plugin: ${pluginName}`);
      } catch (error) {
        console.error(`Failed to load plugin ${pluginName}:`, error);
      }
    }

    if (options.mode === 'stdio') {
      console.error('Starting MCP server in stdio mode...');
      await startStdioServer({
        name: 'mcp-cli',
        version: pkg.version,
        pluginManager,
      });
    } else if (options.mode === 'sse') {
      const port = options.port ? parseInt(options.port, 10) : (config.mcp?.port ?? DEFAULT_MCP_PORT);
      console.error(`Starting MCP server in SSE mode on port ${port}...`);
      await startSseServer({
        port,
        name: 'mcp-cli',
        version: pkg.version,
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
    const normalized = normalizeConfig(config);
    console.log('Configured plugins:');
    const pluginEntries = Object.entries(normalized.plugins);
    if (pluginEntries.length === 0) {
      console.log('  (none)');
    } else {
      for (const [pluginName, packageName] of pluginEntries) {
        const hasConfig = pluginName in normalized.pluginConfigs;
        const hasDisabledTools = pluginName in normalized.disabledTools;
        const flags = [hasConfig ? 'configured' : '', hasDisabledTools ? 'tools disabled' : '']
          .filter(Boolean)
          .join(', ');
        console.log(`  - ${pluginName}: ${packageName}${flags ? ` (${flags})` : ''}`);
      }
    }
    console.log('\nConfig location:', (await import('./config.js')).getConfigPath());
  });

program.parse();
