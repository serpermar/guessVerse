import { findAllActiveThemes, type ThemeRow } from '../repositories/themes.repository.js';

export async function listThemes(): Promise<ThemeRow[]> {
    return findAllActiveThemes();
}