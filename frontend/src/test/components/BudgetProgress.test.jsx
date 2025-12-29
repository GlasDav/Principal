/**
 * Budget Progress - Utility Function Tests
 * Tests budget calculation logic without UI complexity
 */
import { describe, it, expect } from 'vitest';

// Utility functions that would be in budget component
describe('Budget Calculations', () => {
    const calculateProgress = (spent, budget) => {
        if (budget === 0) return 0;
        return Math.min((spent / budget) * 100, 100);
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 90) return 'red';
        if (percentage >= 75) return 'yellow';
        return 'green';
    };

    it('calculates progress percentage correctly', () => {
        expect(calculateProgress(600, 1000)).toBe(60);
        expect(calculateProgress(1000, 1000)).toBe(100);
        expect(calculateProgress(500, 2000)).toBe(25);
    });

    it('handles zero budget gracefully', () => {
        expect(calculateProgress(100, 0)).toBe(0);
    });

    it('caps progress at 100%', () => {
        expect(calculateProgress(1500, 1000)).toBe(100);
    });

    it('returns correct color for progress level', () => {
        expect(getProgressColor(50)).toBe('green');
        expect(getProgressColor(80)).toBe('yellow');
        expect(getProgressColor(95)).toBe('red');
    });

    it('handles edge cases for colors', () => {
        expect(getProgressColor(0)).toBe('green');
        expect(getProgressColor(75)).toBe('yellow');
        expect(getProgressColor(90)).toBe('red');
        expect(getProgressColor(100)).toBe('red');
    });
});
