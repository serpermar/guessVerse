// backend/src/services/import-igdb.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { slugify } from '../utils/text.js';

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID!;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET!;

async function getIgdbToken(): Promise<string> {
    const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const data = (await res.json()) as any; // <-- CAST AÑADIDO
    return data.access_token;
}

// Mapeo de los códigos de IGDB a texto
const mapIgdbGender = (g: number) => ['male', 'female', 'other'][g] || 'unknown';
const mapIgdbSpecies = (s: number) => ['unknown', 'human', 'alien', 'animal', 'android', 'unknown'][s] || 'unknown';

// ELIMINADO 'themeId' de los parámetros porque no se usaba
export async function importIgdbGame(gameName: string, franchiseId: string) {
    const token = await getIgdbToken();
    const clientHeaders = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
    };

    // 1. Buscar el juego por nombre
    const gameRes = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: clientHeaders,
        body: `search "${gameName}"; fields name, characters; limit 1;`
    });
    const games = (await gameRes.json()) as any[]; // <-- CAST AÑADIDO
    if (!games || games.length === 0) throw new Error('Juego no encontrado en IGDB');
    const game = games[0];

    // 2. Obtener los personajes del juego
    const charIds = game.characters || [];
    if (charIds.length === 0) throw new Error('El juego no tiene personajes en IGDB');

    const charsRes = await fetch('https://api.igdb.com/v4/characters', {
        method: 'POST',
        headers: clientHeaders,
        body: `fields name, gender, species, mug_shot; where id = (${charIds.join(',')}); limit 50;`
    });
    const characters = (await charsRes.json()) as any[]; // <-- CAST AÑADIDO

    // 3. Guardar en nuestra base de datos
    for (const char of characters) {
        const charSlug = slugify(char.name);
        const imageUrl = char.mug_shot ? `https://images.igdb.com/igdb/image/upload/t_1080p/${char.mug_shot}.jpg` : null;

        await supabaseAdmin.from('characters').upsert({
            franchise_id: franchiseId,
            slug: charSlug,
            name: char.name,
            image_url: imageUrl,
            gender: mapIgdbGender(char.gender),
            species: mapIgdbSpecies(char.species),
            attributes: { species: mapIgdbSpecies(char.species) }
        }, { onConflict: 'franchise_id,slug' });
    }

    return { imported: characters.length };
}