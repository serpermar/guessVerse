import { describe, it, expect } from 'vitest';
import {
    evaluate,
    clampBoardSize,
    BOARD_SIZE_MIN,
    BOARD_SIZE_MAX,
    BOARD_SIZE_DEFAULT,
} from './game.rules.js';

describe('evaluate', () => {
    it('devuelve unknown si el valor es null/undefined', () => {
        expect(evaluate(null, 'eq', true)).toBe('unknown');
        expect(evaluate(undefined, 'eq', true)).toBe('unknown');
    });

    it('eq', () => {
        expect(evaluate(true, 'eq', true)).toBe('yes');
        expect(evaluate(false, 'eq', true)).toBe('no');
        expect(evaluate('human', 'eq', 'human')).toBe('yes');
    });

    it('ne', () => {
        expect(evaluate(false, 'ne', true)).toBe('yes');
        expect(evaluate(true, 'ne', true)).toBe('no');
    });

    it('in', () => {
        expect(evaluate('fire', 'in', ['fire', 'water'])).toBe('yes');
        expect(evaluate('grass', 'in', ['fire', 'water'])).toBe('no');
        expect(evaluate('fire', 'in', 'not-an-array')).toBe('no');
    });

    it('not_in', () => {
        expect(evaluate('grass', 'not_in', ['fire', 'water'])).toBe('yes');
        expect(evaluate('fire', 'not_in', ['fire', 'water'])).toBe('no');
    });

    it('operador desconocido → unknown', () => {
        expect(evaluate(true, 'gt', true)).toBe('unknown');
    });
});

describe('clampBoardSize', () => {
    it('usa el default para valores no numéricos', () => {
        expect(clampBoardSize(undefined)).toBe(BOARD_SIZE_DEFAULT);
        expect(clampBoardSize('abc')).toBe(BOARD_SIZE_DEFAULT);
        expect(clampBoardSize(NaN)).toBe(BOARD_SIZE_DEFAULT);
    });

    it('recorta al mínimo y máximo', () => {
        expect(clampBoardSize(-5)).toBe(BOARD_SIZE_MIN);
        expect(clampBoardSize(0)).toBe(BOARD_SIZE_MIN);
        expect(clampBoardSize(1)).toBe(BOARD_SIZE_MIN);
        expect(clampBoardSize(100000)).toBe(BOARD_SIZE_MAX);
        expect(clampBoardSize(16)).toBe(16);
    });

    it('trunca decimales', () => {
        expect(clampBoardSize(16.9)).toBe(16);
    });
});
