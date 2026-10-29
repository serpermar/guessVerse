interface WikipediaPage {
    pageid?: number;
    title?: string;
    missing?: string;
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
            const data = (await res.json()) as WikipediaResponse;

            const pages = data.query?.pages;
            if (!pages) continue;

            const page = Object.values(pages)[0];
            if (!page) continue;

            if (page.missing !== undefined || !page.thumbnail?.source) {
                continue;
            }

            return page.thumbnail.source;
        } catch (error) {
            // Silencioso, probamos la siguiente variante
        }
    }

    return null;
}