export interface CharacterArt {
    url: string;
    name: string;
}

interface FanartMovieResponse {
    moviecharacterart?: { name: string; url: string }[];
}

/**
 * Busca arte de personajes para una película concreta usando su ID de TMDB.
 * Usa fetch nativo para evitar dependencias externas y controlar el campo exacto.
 */
export async function getCharacterArtForMovie(tmdbId: number): Promise<Map<string, string>> {
    const artMap = new Map<string, string>();
    const apiKey = process.env.FANART_API_KEY;

    if (!apiKey) {
        console.warn('⚠️ FANART_API_KEY no está configurada en el .env. Saltando Fanart.tv.');
        return artMap;
    }

    try {
        const res = await fetch(`https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${apiKey}`);

        if (!res.ok) {
            if (res.status !== 404) {
                console.warn(`⚠️ Fanart.tv respondió ${res.status} para TMDB ID ${tmdbId}`);
            }
            return artMap;
        }

        // AQUI ESTÁ LA CORRECCIÓN: Casteamos el JSON al tipo esperado
        const data = (await res.json()) as FanartMovieResponse;

        const characterArtList = data.moviecharacterart;

        if (!characterArtList || characterArtList.length === 0) {
            console.log(`ℹ️ No hay arte de personajes en Fanart.tv para TMDB ID ${tmdbId}`);
            return artMap;
        }

        console.log(`✅ Encontrados ${characterArtList.length} artes de personajes para TMDB ID ${tmdbId}`);

        for (const art of characterArtList) {
            if (!art.name || !art.url) continue;

            const normalizedName = art.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedName) {
                artMap.set(normalizedName, art.url);
            }
        }
    } catch (error) {
        console.error(`Error consultando Fanart.tv para TMDB ID ${tmdbId}:`, error);
    }
    return artMap;
}