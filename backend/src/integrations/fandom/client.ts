// backend/src/integrations/fandom/client.ts

interface FandomSearchResponse {
    query?: { search?: { title: string }[]; };
}

interface FandomImageResponse {
    query?: {
        pages?: Record<string, {
            missing?: string;
            thumbnail?: { source: string };
        }>;
    };
}

export async function getFandomImage(domain: string, characterName: string): Promise<string | null> {
    const cleanName = characterName.replace(/^(captain|capitán|mr\.|mrs\.|dr\.|lord|king|queen)\s+/i, '').trim();
    const searchQueries = [characterName, cleanName];

    for (const query of searchQueries) {
        try {
            const searchUrl = `https://${domain}/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const searchRes = await fetch(searchUrl);
            const searchData = (await searchRes.json()) as FandomSearchResponse;

            const bestMatch = searchData.query?.search?.[0]?.title;
            if (!bestMatch) continue;

            const imageUrl = `https://${domain}/api.php?action=query&titles=${encodeURIComponent(bestMatch)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
            const imageRes = await fetch(imageUrl);
            const imageData = (await imageRes.json()) as FandomImageResponse;

            const pages = imageData.query?.pages;
            if (!pages) continue;

            const page = Object.values(pages)[0];
            if (page?.missing !== undefined || !page?.thumbnail?.source) continue;

            return page.thumbnail.source;
        } catch (error) {
            // Silencioso, probamos la siguiente variante
        }
    }
    return null;
}