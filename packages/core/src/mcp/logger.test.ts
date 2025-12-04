import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolCallLogger, type ToolCallLog } from './logger.js';

describe('ToolCallLogger', () => {
  let logger: ToolCallLogger;

  const createEntry = (overrides: Partial<ToolCallLog> = {}): ToolCallLog => ({
    timestamp: new Date('2024-01-15T10:30:00Z'),
    clientId: 'test-client',
    tool: 'test_tool',
    params: { arg: 'value' },
    success: true,
    duration: 100,
    ...overrides,
  });

  beforeEach(() => {
    logger = new ToolCallLogger();
  });

  describe('log', () => {
    it('should add entry to history', () => {
      const entry = createEntry();
      logger.log(entry);

      expect(logger.getCount()).toBe(1);
      expect(logger.getHistory()[0]).toBe(entry);
    });

    it('should maintain circular buffer', () => {
      const smallLogger = new ToolCallLogger(3);

      smallLogger.log(createEntry({ tool: 'tool1' }));
      smallLogger.log(createEntry({ tool: 'tool2' }));
      smallLogger.log(createEntry({ tool: 'tool3' }));
      smallLogger.log(createEntry({ tool: 'tool4' }));

      expect(smallLogger.getCount()).toBe(3);
      const history = smallLogger.getAll();
      expect(history[0].tool).toBe('tool2');
      expect(history[1].tool).toBe('tool3');
      expect(history[2].tool).toBe('tool4');
    });

    it('should notify subscribers', () => {
      const subscriber = vi.fn();
      logger.subscribe(subscriber);

      const entry = createEntry();
      logger.log(entry);

      expect(subscriber).toHaveBeenCalledWith(entry);
    });

    it('should handle subscriber errors gracefully', () => {
      const errorSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const okSubscriber = vi.fn();

      logger.subscribe(errorSubscriber);
      logger.subscribe(okSubscriber);

      const entry = createEntry();
      expect(() => logger.log(entry)).not.toThrow();
      expect(okSubscriber).toHaveBeenCalledWith(entry);
    });
  });

  describe('getHistory', () => {
    it('should return last N entries', () => {
      for (let i = 0; i < 10; i++) {
        logger.log(createEntry({ tool: `tool${i}` }));
      }

      const history = logger.getHistory(3);
      expect(history).toHaveLength(3);
      expect(history[0].tool).toBe('tool7');
      expect(history[1].tool).toBe('tool8');
      expect(history[2].tool).toBe('tool9');
    });

    it('should return all entries if limit exceeds count', () => {
      logger.log(createEntry({ tool: 'tool1' }));
      logger.log(createEntry({ tool: 'tool2' }));

      const history = logger.getHistory(100);
      expect(history).toHaveLength(2);
    });

    it('should default to 20 entries', () => {
      for (let i = 0; i < 30; i++) {
        logger.log(createEntry({ tool: `tool${i}` }));
      }

      const history = logger.getHistory();
      expect(history).toHaveLength(20);
    });
  });

  describe('getAll', () => {
    it('should return copy of all entries', () => {
      logger.log(createEntry({ tool: 'tool1' }));
      logger.log(createEntry({ tool: 'tool2' }));

      const all = logger.getAll();
      expect(all).toHaveLength(2);

      // Should be a copy
      all.push(createEntry({ tool: 'tool3' }));
      expect(logger.getCount()).toBe(2);
    });
  });

  describe('getCount', () => {
    it('should return number of entries', () => {
      expect(logger.getCount()).toBe(0);

      logger.log(createEntry());
      expect(logger.getCount()).toBe(1);

      logger.log(createEntry());
      expect(logger.getCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      logger.log(createEntry());
      logger.log(createEntry());

      logger.clear();

      expect(logger.getCount()).toBe(0);
      expect(logger.getAll()).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const subscriber = vi.fn();
      const unsubscribe = logger.subscribe(subscriber);

      logger.log(createEntry());
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();

      logger.log(createEntry());
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const sub1 = vi.fn();
      const sub2 = vi.fn();

      logger.subscribe(sub1);
      logger.subscribe(sub2);

      logger.log(createEntry());

      expect(sub1).toHaveBeenCalledTimes(1);
      expect(sub2).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatEntry', () => {
    it('should format successful entry', () => {
      const entry = createEntry({
        timestamp: new Date('2024-01-15T10:30:45.123Z'),
        tool: 'browser_click',
        duration: 150,
      });

      const formatted = ToolCallLogger.formatEntry(entry);
      expect(formatted).toBe('[10:30:45.123] ✓ browser_click (150ms)');
    });

    it('should format failed entry with error', () => {
      const entry = createEntry({
        timestamp: new Date('2024-01-15T10:30:45.123Z'),
        tool: 'browser_click',
        duration: 50,
        success: false,
        error: 'Element not found',
      });

      const formatted = ToolCallLogger.formatEntry(entry);
      expect(formatted).toBe('[10:30:45.123] ✗ browser_click (50ms) - Element not found');
    });

    it('should format failed entry without error message', () => {
      const entry = createEntry({
        timestamp: new Date('2024-01-15T10:30:45.123Z'),
        tool: 'test_tool',
        duration: 10,
        success: false,
      });

      const formatted = ToolCallLogger.formatEntry(entry);
      expect(formatted).toBe('[10:30:45.123] ✗ test_tool (10ms)');
    });
  });
});
