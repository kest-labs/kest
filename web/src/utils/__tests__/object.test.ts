import { describe, it, expect } from 'vitest';
import { deepClone, getNestedValue, pick, omit, isEmptyObject, deepMerge, deepFreeze } from '../object';

describe('object utils', () => {
  describe('deepClone', () => {
    it('should deep clone a simple object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should use structuredClone if available', () => {
      const obj = { a: 1 };
      // Test the logic that uses structuredClone or fallback
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
    });
  });

  describe('getNestedValue', () => {
    it('should get a nested value successfully', () => {
      const obj = { user: { address: { city: 'New York' } } };
      expect(getNestedValue(obj, 'user.address.city')).toBe('New York');
    });

    it('should return default value if path does not exist', () => {
      const obj = { user: {} };
      expect(getNestedValue(obj, 'user.address.city', 'Unknown')).toBe('Unknown');
    });

    it('should handle null or undefined object', () => {
      expect(getNestedValue(null, 'any.path', 'Default')).toBe('Default');
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('isEmptyObject', () => {
    it('should return true for empty object', () => {
      expect(isEmptyObject({})).toBe(true);
    });

    it('should return false for non-empty object', () => {
      expect(isEmptyObject({ a: 1 })).toBe(false);
    });

    it('should return true for null or undefined', () => {
      expect(isEmptyObject(null)).toBe(true);
      expect(isEmptyObject(undefined)).toBe(true);
    });
  });

  describe('deepMerge', () => {
    it('should deep merge two objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 }, e: 4 };
      const merged = deepMerge(target, source);
      expect(merged).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    it('should handle multiple sources', () => {
      const target = { a: 1 };
      const s1 = { b: 2 };
      const s2 = { c: 3 };
      expect(deepMerge(target, s1, s2)).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('deepFreeze', () => {
    it('should deep freeze an object', () => {
      const obj = { a: { b: 1 } };
      deepFreeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.a)).toBe(true);
    });
  });
});
