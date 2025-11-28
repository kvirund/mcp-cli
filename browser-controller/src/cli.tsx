#!/usr/bin/env node
import { render } from 'ink';
import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { App } from './App.js';
import { startStdioServer, startSseServer } from './mcp/index.js';
import * as cdp from './cdp/index.js';

const program = new Command();

program
  .name('browser-controller')
  .description('Interactive CLI and MCP server for browser control')
  .version('0.1.0');

program
  .command('interactive', { isDefault: true })
  .description('Start interactive shell (default)')
  .action(() => {
    render(<App />);
  });

program
  .command('serve')
  .description('Start MCP server directly (non-interactive)')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('--stdio', 'Use stdio transport instead of SSE')
  .action(async (options) => {
    if (options.stdio) {
      // Stdio mode - for use with Claude Desktop, etc.
      await startStdioServer();
    } else {
      // SSE mode - for Claude Code remote connection
      const port = parseInt(options.port, 10);
      console.log(`Starting MCP server...`);

      await startSseServer({
        port,
        onClientConnect: (clientId) => {
          console.log(`Client connected: ${clientId}`);
        },
        onClientDisconnect: (clientId) => {
          console.log(`Client disconnected: ${clientId}`);
        },
      });

      console.log(`MCP server running on http://localhost:${port}/sse`);
      console.log('Press Ctrl+C to stop');

      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\nShutting down...');
        process.exit(0);
      });
    }
  });

program
  .command('screenshot')
  .description('Take a screenshot (one-shot command)')
  .argument('<url>', 'URL to screenshot')
  .option('-o, --output <file>', 'Output file', 'screenshot.png')
  .option('-f, --full', 'Full page screenshot')
  .option('-p, --port <port>', 'Browser debug port', '9222')
  .option('-h, --host <host>', 'Browser host', 'localhost')
  .action(async (url, options) => {
    try {
      const port = parseInt(options.port, 10);
      const host = options.host;

      console.log(`Connecting to browser at ${host}:${port}...`);
      await cdp.connect({ host, port });

      console.log(`Navigating to ${url}...`);
      await cdp.navigate(url);

      console.log(`Taking ${options.full ? 'full page ' : ''}screenshot...`);
      const buffer = await cdp.screenshot({ fullPage: options.full });

      await writeFile(options.output, buffer);
      console.log(`Screenshot saved: ${options.output} (${buffer.length} bytes)`);

      await cdp.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('eval')
  .description('Evaluate JavaScript in browser (one-shot command)')
  .argument('<expression>', 'JavaScript expression')
  .option('-p, --port <port>', 'Browser debug port', '9222')
  .option('-h, --host <host>', 'Browser host', 'localhost')
  .action(async (expression, options) => {
    try {
      const port = parseInt(options.port, 10);
      const host = options.host;

      await cdp.connect({ host, port });
      const result = await cdp.evaluate(expression);

      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      console.log(output);

      await cdp.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('tabs')
  .description('List browser tabs (one-shot command)')
  .option('-p, --port <port>', 'Browser debug port', '9222')
  .option('-h, --host <host>', 'Browser host', 'localhost')
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);
      const host = options.host;

      const tabs = await cdp.getTabs(host, port);

      if (tabs.length === 0) {
        console.log('No tabs open');
      } else {
        tabs.forEach((tab, i) => {
          console.log(`${i + 1}. ${tab.title}`);
          console.log(`   ${tab.url}`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program.parse();
