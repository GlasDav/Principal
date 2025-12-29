/**
 * Basic smoke tests to verify testing infrastructure works
 */
import { describe, it, expect } from 'vitest';

describe('Testing Infrastructure', () => {
    it('can run basic tests', () => {
        expect(true).toBe(true);
    });

    it('can use matchers', () => {
        const value = { name: 'test' };
        expect(value).toEqual({ name: 'test' });
        expect(value).toHaveProperty('name');
    });

    it('can test arrays', () => {
        const items = [1, 2, 3];
        expect(items).toHaveLength(3);
        expect(items).toContain(2);
    });

    it('can test strings', () => {
        const text = 'Principal Finance';
        expect(text).toMatch(/finance/i);
        expect(text).toContain('Principal');
    });
});

describe('Math utilities', () => {
    it('can add numbers', () => {
        expect(2 + 2).toBe(4);
    });

    it('can calculate percentages', () => {
        const spent = 600;
        const budget = 1000;
        const percentage = (spent / budget) * 100;
        expect(percentage).toBe(60);
    });
});
