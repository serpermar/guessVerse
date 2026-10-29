interface FandomSearchResponse {
    query?: {
        search?: { title: string }[];
    };
}

interface FandomImageResponse {
    query?: {
        pages?: Record<string, {
            missing?: string;
            thumbnail?: { source: string };
        }>;
    };
}

/**
 * Busca la imagen de un personaje en un wiki específico de Fandom.
 */
export async function getFandomImage(domain: string, characterName: string): Promise<string | null> {
    try {
        // 1. Primero, buscamos el título exacto del artículo en Fandom
        const searchUrl = `https://${domain}/api.php?action=query&list=search&srsearch=${encodeURIComponent(characterName)}&format=json&origin=*`;
        const searchRes = await fetch(searchUrl);
        const searchData = (await searchRes.json()) as FandomSearchResponse;

        const bestMatch = searchData.query?.search?.[0]?.title;
        if (!bestMatch) return null;

        // 2. Con el título exacto, pedimos la imagen principal (pageimages)
        const imageUrl = `https://${domain}/api.php?action=query&titles=${encodeURIComponent(bestMatch)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const imageRes = await fetch(imageUrl);
        const imageData = (await imageRes.json()) as FandomImageResponse;

        const pages = imageData.query?.pages;
        if (!pages) return null;

        const page = Object.values(pages)[0];
        if (page?.missing !== undefined || !page?.thumbnail?.source) return null;

        return page.thumbnail.source;
    } catch (error) {
        return null;
    }
}