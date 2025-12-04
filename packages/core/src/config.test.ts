import { describe, it, expect } from 'vitest';
import { normalizeConfig, type Config, type NormalizedConfig } from './config.js';

describe('normalizeConfig', () => {
  it('should handle empty plugins', () => {
    const config: Config = { plugins: {} };
    const result = normalizeConfig(config);

    expect(result.plugins).toEqual({});
    expect(result.pluginConfigs).toEqual({});
    expect(result.disabledTools).toEqual({});
  });

  it('should extract plugin package names', () => {
    const config: Config = {
      plugins: {
        browser: { package: '@kvirund/mcp-cli-plugin-browser' },
        filesystem: { package: '@kvirund/mcp-cli-plugin-proxy' },
      },
    };

    const result = normalizeConfig(config);

    expect(result.plugins).toEqual({
      browser: '@kvirund/mcp-cli-plugin-browser',
      filesystem: '@kvirund/mcp-cli-plugin-proxy',
    });
  });

  it('should extract plugin configs', () => {
    const config: Config = {
      plugins: {
        filesystem: {
          package: '@kvirund/mcp-cli-plugin-proxy',
          config: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoConnect: true,
          },
        },
      },
    };

    const result = normalizeConfig(config);

    expect(result.pluginConfigs).toEqual({
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        autoConnect: true,
      },
    });
  });

  it('should not include empty config', () => {
    const config: Config = {
      plugins: {
        browser: { package: '@kvirund/mcp-cli-plugin-browser' },
      },
    };

    const result = normalizeConfig(config);

    expect(result.pluginConfigs).toEqual({});
  });

  it('should extract disabled tools', () => {
    const config: Config = {
      plugins: {
        filesystem: {
          package: '@kvirund/mcp-cli-plugin-proxy',
          disabledTools: ['write_file', 'delete_file'],
        },
      },
    };

    const result = normalizeConfig(config);

    expect(result.disabledTools).toEqual({
      filesystem: ['write_file', 'delete_file'],
    });
  });

  it('should not include empty disabledTools array', () => {
    const config: Config = {
      plugins: {
        browser: {
          package: '@kvirund/mcp-cli-plugin-browser',
          disabledTools: [],
        },
      },
    };

    const result = normalizeConfig(config);

    expect(result.disabledTools).toEqual({});
  });

  it('should handle complex config with all fields', () => {
    const config: Config = {
      plugins: {
        browser: {
          package: '@kvirund/mcp-cli-plugin-browser',
          disabledTools: ['screenshot'],
        },
        filesystem: {
          package: '@kvirund/mcp-cli-plugin-proxy',
          config: { command: 'npx', autoConnect: true },
          disabledTools: ['write_file'],
        },
        simple: {
          package: 'some-plugin',
        },
      },
      mcp: { port: 4000 },
    };

    const result = normalizeConfig(config);

    expect(result.plugins).toEqual({
      browser: '@kvirund/mcp-cli-plugin-browser',
      filesystem: '@kvirund/mcp-cli-plugin-proxy',
      simple: 'some-plugin',
    });

    expect(result.pluginConfigs).toEqual({
      filesystem: { command: 'npx', autoConnect: true },
    });

    expect(result.disabledTools).toEqual({
      browser: ['screenshot'],
      filesystem: ['write_file'],
    });
  });
});
