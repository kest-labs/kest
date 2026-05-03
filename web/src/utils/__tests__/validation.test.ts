import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidUrl, isNumber, isEmpty } from '../validation';

describe('validation utils', () => {
  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });
    it('should invalidate incorrect emails', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct urls', () => {
      expect(isValidUrl('https://google.com')).toBe(true);
    });
    it('should invalidate incorrect urls', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber('123')).toBe(true);
    });
    it('should return false for non-numbers', () => {
      expect(isNumber('abc')).toBe(false);
      expect(isNumber(NaN)).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
      expect(isEmpty(null)).toBe(true);
    });
    it('should return false for non-empty values', () => {
      expect(isEmpty('hi')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('should return true for whitespace string (trimmed)', () => {
      expect(isEmpty(' ')).toBe(true);
    });
  });
});
