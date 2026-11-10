// backend/src/services/openlibrary.service.ts

export interface OpenLibraryBook {
    externalId: string;      // clave del work, p. ej. "OL12345W"
    title: string;
    authors: string[];
    description: string;
    imageUrl: string | null;
    firstPublishYear: number | null;
}

const BASE = 'https://openlibrary.org';
const UA = 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)';

function coverUrl(coverId: number | undefined, size: 'M' | 'L' = 'L'): string | null {
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Busca libros por título o autor.
 * Devuelve hasta `limit` resultados (por defecto 8).
 */
export async function searchBooks(query: string, limit = 8): Promise<OpenLibraryBook[]> {
    const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,description`;

    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
        console.warn(`[openlibrary] search ${res.status} para "${query}"`);
        return [];
    }

    const json = (await res.json()) as {
        docs?: Array<{
            key: string;
            title: string;
            author_name?: string[];
            cover_i?: number;
            first_publish_year?: number;
            description?: string | { value: string };
        }>;
    };

    const docs = json.docs ?? [];
    return docs.map((d) => {
        // El "key" viene como "/works/OL123W" → extraemos el id limpio.
        const externalId = d.key.replace('/works/', '');
        const description =
            typeof d.description === 'string'
                ? d.description
                : d.description?.value ?? '';
        return {
            externalId,
            title: d.title,
            authors: d.author_name ?? [],
            description,
            imageUrl: coverUrl(d.cover_i),
            firstPublishYear: d.first_publish_year ?? null,
        };
    });
}

/**
 * Enriquecer un libro con la descripción completa y subjects (si faltan).
 * El search no siempre trae description; este endpoint sí.
 */
export async function fetchBookDetails(externalId: string): Promise<OpenLibraryBook | null> {
    const res = await fetch(`${BASE}/works/${externalId}.json`, {
        headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
        title: string;
        description?: string | { value: string };
        subjects?: string[];
        covers?: number[];
    };

    const description =
        typeof json.description === 'string'
            ? json.description
            : json.description?.value ?? '';

    return {
        externalId,
        title: json.title,
        authors: [],
        description,
        imageUrl: json.covers?.[0] ? coverUrl(json.covers[0]) : null,
        firstPublishYear: null,
    };
}