import { describe, it, expect } from 'vitest';
import { xpForGame, levelFromXp, levelProgress } from './xp.js';

describe('xpForGame', () => {
    it('da XP base por jugar', () => {
        expect(xpForGame('lost', 0)).toBe(10);
        expect(xpForGame('abandoned', 0)).toBe(10);
    });

    it('suma bonus por victoria', () => {
        expect(xpForGame('won', 10)).toBe(60);
    });

    it('suma bonus por eficiencia', () => {
        expect(xpForGame('won', 5)).toBe(80);
        expect(xpForGame('won', 6)).toBe(60);
    });
});

describe('levelFromXp', () => {
    it('empieza en nivel 1', () => {
        expect(levelFromXp(0)).toBe(1);
        expect(levelFromXp(399)).toBe(1);
    });

    it('sube en los umbrales cuadráticos', () => {
        expect(levelFromXp(400)).toBe(2);
        expect(levelFromXp(900)).toBe(3);
        expect(levelFromXp(1600)).toBe(4);
    });

    it('tolera valores negativos', () => {
        expect(levelFromXp(-50)).toBe(1);
    });
});

describe('levelProgress', () => {
    it('calcula el progreso dentro del nivel', () => {
        const p = levelProgress(500);
        expect(p.level).toBe(2);
        expect(p.levelStartXp).toBe(400);
        expect(p.levelSpan).toBe(500);
        expect(p.progressXp).toBe(100);
        expect(p.remainingXp).toBe(400);
        expect(p.percent).toBe(20);
    });

    it('nunca supera el 100%', () => {
        expect(levelProgress(399).percent).toBeLessThanOrEqual(100);
    });
});
