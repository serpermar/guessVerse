// backend/src/integrations/wikipedia/client.ts

interface WikipediaPage {
    missing?: string;
    thumbnail?: { source: string; };
}

interface WikipediaResponse {
    query?: { pages?: Record<string, WikipediaPage>; };
}

export async function getWikipediaImage(characterName: string): Promise<string | null> {
    // Limpiamos títulos comunes que a veces estropean la búsqueda
    const cleanName = characterName.replace(/^(captain|capitán|mr\.|mrs\.|dr\.|lord|king|queen)\s+/i, '').trim();

    const variants = [
        characterName,
        cleanName,
        `${characterName} (character)`,
        `${cleanName} (character)`,
        `${characterName} (fictional character)`,
        `${characterName} (film)`,
        `${characterName} (The Matrix)`,
        `${characterName} (Middle-earth)`,
    ];

    const uniqueVariants = [...new Set(variants)];

    for (const variant of uniqueVariants) {
        try {
            const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(variant)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
            const res = await fetch(url);
            const data = (await res.json()) as WikipediaResponse;

            const pages = data.query?.pages;
            if (!pages) continue;

            const page = Object.values(pages)[0];
            if (!page || page.missing !== undefined || !page.thumbnail?.source) continue;

            return page.thumbnail.source;
        } catch (error) {
            // Silencioso
        }
    }
    return null;
}