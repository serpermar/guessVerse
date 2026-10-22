import { describe, it, expect } from 'vitest';
import { normalizeName, slugify, cleanTmdbCharacterName, mapTmdbGender } from './text.js';

describe('normalizeName', () => {
    it('minúsculas, sin acentos ni símbolos', () => {
        expect(normalizeName('Ki-Adi-Mundi')).toBe('ki adi mundi');
        expect(normalizeName('Padmé Amidala')).toBe('padme amidala');
        expect(normalizeName('R2-D2')).toBe('r2 d2');
        expect(normalizeName("Lando's Aide")).toBe('landos aide');
        expect(normalizeName('  Multiple   Spaces ')).toBe('multiple spaces');
    });
});

describe('slugify', () => {
    it('genera slugs estables', () => {
        expect(slugify('Luke Skywalker')).toBe('luke-skywalker');
        expect(slugify('C-3PO')).toBe('c-3po');
        expect(slugify('Obi-Wan "Ben" Kenobi')).toBe('obi-wan-ben-kenobi');
        expect(slugify('  --Héroe--  ')).toBe('heroe');
    });
});

describe('cleanTmdbCharacterName', () => {
    it('quita paréntesis y se queda con el último alias', () => {
        expect(cleanTmdbCharacterName('Tony Stark (uncredited)')).toBe('Tony Stark');
        expect(cleanTmdbCharacterName('Jek Porkins / Red Six')).toBe('Red Six');
    });
});

describe('mapTmdbGender', () => {
    it('mapea los géneros de TMDB', () => {
        expect(mapTmdbGender(1)).toBe('female');
        expect(mapTmdbGender(2)).toBe('male');
        expect(mapTmdbGender(0)).toBe('unknown');
    });
});
