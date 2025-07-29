import { describe, it, expect } from '@jest/globals';
import comparator from '../src/comparator';
import { sampleOldItems, sampleNewItems } from './test-data';

describe('comparator', () => {
  describe('diff', () => {
    it('should identify added items', () => {
      const oldItems = { "ITEM_1": sampleOldItems["ITEM_1"] };
      const newItems = sampleNewItems;
      
      const result = comparator.diff(oldItems, newItems);
      
      expect(result.added).toHaveLength(1);
      expect(result.added[0].title).toBe("New issue");
    });

    it('should identify removed items', () => {
      const oldItems = sampleOldItems;
      const newItems = { "ITEM_1": sampleNewItems["ITEM_1"] };
      
      const result = comparator.diff(oldItems, newItems);
      
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].title).toBe("Add new feature");
    });

    it('should identify changed items', () => {
      const oldItems = { "ITEM_1": sampleOldItems["ITEM_1"] };
      const newItems = { "ITEM_1": sampleNewItems["ITEM_1"] };
      
      const result = comparator.diff(oldItems, newItems);
      
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].title).toBe("Fix critical bug in login");
      expect(result.changed[0].previous_title).toBe("Fix bug in login");
      expect(result.changed[0].status).toEqual({
        prev: "Todo",
        next: "In Progress"
      });
      expect(result.changed[0].labels_added).toEqual(["high-priority"]);
      expect(result.changed[0].assignees_added).toEqual(["bob"]);
      expect(result.changed[0].assignees_removed).toEqual([]);
    });

    it('should identify closed items separately', () => {
      const oldItems = { "ITEM_2": sampleOldItems["ITEM_2"] };
      const newItems = { "ITEM_2": sampleNewItems["ITEM_2"] };
      
      const result = comparator.diff(oldItems, newItems);
      
      expect(result.closed).toHaveLength(1);
      expect(result.closed[0].title).toBe("Add new feature");
      expect(result.changed).toHaveLength(0); // Should not appear in changed when closed
    });

    it('should handle empty old items (first run)', () => {
      const result = comparator.diff({}, sampleNewItems);
      
      expect(result.added).toHaveLength(3);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.closed).toHaveLength(0);
    });

    it('should handle identical items (no changes)', () => {
      const result = comparator.diff(sampleOldItems, sampleOldItems);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.closed).toHaveLength(0);
    });

    it('should detect label changes correctly', () => {
      const oldItem = { 
        "ITEM_1": { ...sampleOldItems["ITEM_1"], labels: ["bug", "frontend"] }
      };
      const newItem = { 
        "ITEM_1": { ...sampleNewItems["ITEM_1"], labels: ["bug", "backend", "urgent"] }
      };
      
      const result = comparator.diff(oldItem, newItem);
      
      expect(result.changed[0].labels_added).toEqual(["backend", "urgent"]);
      expect(result.changed[0].labels_removed).toEqual(["frontend"]);
    });

    it('should detect assignee changes correctly', () => {
      const oldItem = { 
        "ITEM_1": { ...sampleOldItems["ITEM_1"], assignees: ["alice", "bob"] }
      };
      const newItem = { 
        "ITEM_1": { ...sampleNewItems["ITEM_1"], assignees: ["bob", "charlie"] }
      };
      
      const result = comparator.diff(oldItem, newItem);
      
      expect(result.changed[0].assignees_added).toEqual(["charlie"]);
      expect(result.changed[0].assignees_removed).toEqual(["alice"]);
    });
  });
});