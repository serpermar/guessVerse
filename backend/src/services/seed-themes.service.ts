import { supabaseAdmin } from '../db/supabase.js';
import { THEMES } from '../config/themes.config.js';

export interface SeedThemesResult {
    themes_upserted: number;
    franchises_upserted: number;
}

/**
 * Crea/actualiza las temáticas y franquicias declaradas en `themes.config.ts`.
 * Idempotente: puede ejecutarse tantas veces como se quiera.
 */
export async function seedThemes(): Promise<SeedThemesResult> {
    let themesUpserted = 0;
    let franchisesUpserted = 0;

    for (const theme of THEMES) {
        const { data: themeRow, error: themeErr } = await supabaseAdmin
            .from('themes')
            .upsert(
                {
                    slug: theme.slug,
                    name: theme.name,
                    description: theme.description,
                    type: theme.type,
                    question_categories: theme.questionCategories,
                    source: 'manual',
                    is_active: true,
                },
                { onConflict: 'slug' }
            )
            .select('id')
            .single();
        if (themeErr || !themeRow) {
            throw new Error(`Error sembrando theme "${theme.slug}": ${themeErr?.message}`);
        }
        themesUpserted++;

        for (const fran of theme.franchises) {
            const { error: franErr } = await supabaseAdmin
                .from('franchises')
                .upsert(
                    {
                        theme_id: themeRow.id,
                        slug: fran.slug,
                        name: fran.name,
                        description: fran.description,
                        source: 'manual',
                    },
                    { onConflict: 'theme_id,slug' }
                );
            if (franErr) {
                throw new Error(
                    `Error sembrando franchise "${fran.slug}" de "${theme.slug}": ${franErr.message}`
                );
            }
            franchisesUpserted++;
        }
    }

    return { themes_upserted: themesUpserted, franchises_upserted: franchisesUpserted };
}
