interface WikipediaPage {
    pageid?: number;
    title?: string;
    missing?: string; // Presente si la página no existe
    thumbnail?: {
        source: string;
        width: number;
        height: number;
    };
}

interface WikipediaResponse {
    query?: {
        pages?: Record<string, WikipediaPage>;
    };
}

/**
 * Busca la imagen principal de un personaje en Wikipedia.
 * Prueba varias variantes del nombre para maximizar las coincidencias.
 */
export async function getWikipediaImage(characterName: string): Promise<string | null> {
    const variants = [
        characterName,
        `${characterName} (character)`,
        `${characterName} (The Matrix)`,
        `${characterName} (Middle-earth)`,
    ];

    for (const variant of variants) {
        try {
            const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(variant)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
            const res = await fetch(url);

            // CORRECCIÓN: Casteamos el JSON al tipo esperado
            const data = (await res.json()) as WikipediaResponse;

            const pages = data.query?.pages;
            if (!pages) continue;

            // La API devuelve un objeto con IDs como claves, así que cogemos el primer valor
            const page = Object.values(pages)[0];

            if (!page) continue;

            // Si la página no existe o no tiene imagen, probamos la siguiente variante
            if (page.missing !== undefined || !page.thumbnail?.source) {
                continue;
            }

            console.log(`   ✅ Imagen encontrada en Wikipedia para "${variant}" -> ${page.thumbnail.source}`);
            return page.thumbnail.source;
        } catch (error) {
            // Silencioso, probamos la siguiente variante
        }
    }

    return null;
}