import { describe, it, expect, vi, beforeEach } from 'vitest';
import { browserCommands, setNotifyFn } from './commands.js';

// Mock CDP module
vi.mock('./cdp/index.js', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(false),
  getConnectionInfo: vi.fn().mockReturnValue({ host: 'localhost', port: 9222 }),
  getBrowserVersion: vi.fn().mockResolvedValue({ browser: 'Chrome/120' }),
  getTabs: vi.fn().mockResolvedValue([
    { id: '1', title: 'Test Tab', url: 'https://example.com', active: true },
  ]),
  getPageInfo: vi.fn().mockResolvedValue({ title: 'Test Page', url: 'https://example.com' }),
  switchTab: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
  goBack: vi.fn().mockResolvedValue(undefined),
  goForward: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  type: vi.fn().mockResolvedValue(undefined),
  scroll: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  evaluate: vi.fn().mockResolvedValue('result'),
  getHTML: vi.fn().mockResolvedValue('<html></html>'),
  getText: vi.fn().mockResolvedValue('Page text'),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('browserCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNotifyFn(() => {});
  });

  describe('command structure', () => {
    it('should have expected commands', () => {
      const commandNames = browserCommands.map((c) => c.name);
      expect(commandNames).toContain('connect');
      expect(commandNames).toContain('disconnect');
      expect(commandNames).toContain('tabs');
      expect(commandNames).toContain('switch');
      expect(commandNames).toContain('navigate');
      expect(commandNames).toContain('reload');
      expect(commandNames).toContain('back');
      expect(commandNames).toContain('forward');
      expect(commandNames).toContain('click');
      expect(commandNames).toContain('type');
      expect(commandNames).toContain('scroll');
      expect(commandNames).toContain('screenshot');
      expect(commandNames).toContain('eval');
      expect(commandNames).toContain('info');
      expect(commandNames).toContain('html');
      expect(commandNames).toContain('text');
      expect(commandNames).toContain('status');
    });

    it('should have descriptions for all commands', () => {
      for (const cmd of browserCommands) {
        expect(cmd.description).toBeDefined();
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });

    it('should have execute functions', () => {
      for (const cmd of browserCommands) {
        expect(typeof cmd.execute).toBe('function');
      }
    });
  });

  describe('connect command', () => {
    it('should connect with default host and port', async () => {
      const cmd = browserCommands.find((c) => c.name === 'connect')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Connected');
    });

    it('should connect with custom host and port', async () => {
      const cmd = browserCommands.find((c) => c.name === 'connect')!;
      const result = await cmd.execute(['192.168.1.1', '9333']);

      expect(result.success).toBe(true);
    });
  });

  describe('disconnect command', () => {
    it('should disconnect successfully', async () => {
      const cmd = browserCommands.find((c) => c.name === 'disconnect')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Disconnected');
    });
  });

  describe('tabs command', () => {
    it('should list tabs', async () => {
      const cmd = browserCommands.find((c) => c.name === 'tabs')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Tab');
    });
  });

  describe('switch command', () => {
    it('should require tabId argument', async () => {
      const cmd = browserCommands.find((c) => c.name === 'switch')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.output).toContain('Usage');
    });

    it('should switch tab successfully', async () => {
      const cmd = browserCommands.find((c) => c.name === 'switch')!;
      const result = await cmd.execute(['1']);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Switched to');
    });
  });

  describe('navigate command', () => {
    it('should require url argument', async () => {
      const cmd = browserCommands.find((c) => c.name === 'navigate')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.output).toContain('Usage');
    });

    it('should navigate successfully', async () => {
      const cmd = browserCommands.find((c) => c.name === 'navigate')!;
      const result = await cmd.execute(['https://example.com']);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Navigated to');
    });
  });

  describe('scroll command', () => {
    it('should require direction argument', async () => {
      const cmd = browserCommands.find((c) => c.name === 'scroll')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.output).toContain('Usage');
    });

    it('should validate direction', async () => {
      const cmd = browserCommands.find((c) => c.name === 'scroll')!;
      const result = await cmd.execute(['invalid']);

      expect(result.success).toBe(false);
    });

    it('should scroll with valid direction', async () => {
      const cmd = browserCommands.find((c) => c.name === 'scroll')!;
      const result = await cmd.execute(['down']);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Scrolled down');
    });
  });

  describe('click command', () => {
    it('should require selector argument', async () => {
      const cmd = browserCommands.find((c) => c.name === 'click')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.output).toContain('Usage');
    });
  });

  describe('type command', () => {
    it('should require both selector and text', async () => {
      const cmd = browserCommands.find((c) => c.name === 'type')!;

      let result = await cmd.execute([]);
      expect(result.success).toBe(false);

      result = await cmd.execute(['#input']);
      expect(result.success).toBe(false);
    });
  });

  describe('eval command', () => {
    it('should require expression', async () => {
      const cmd = browserCommands.find((c) => c.name === 'eval')!;
      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.output).toContain('Usage');
    });
  });
});
