const AKABAB_ALL = 'https://akabab.github.io/superhero-api/api/all.json';

export interface AkababHero {
    id: number;
    name: string;
    slug: string;
    images: { xs: string; sm: string; md: string; lg: string };
    biography: {
        fullName?: string;
        alterEgos?: string;
        aliases?: string[];
        publisher?: string;
        alignment?: string;   // "good" | "bad" | "neutral" | "-"
    };
    appearance: {
        gender?: string;      // "Male" | "Female" | "-"
        race?: string;        // "Human" | "Kryptonian" | "Amazon" | ...
    };
}

export async function fetchAllAkababHeroes(): Promise<AkababHero[]> {
    const res = await fetch(AKABAB_ALL);
    if (!res.ok) throw new Error(`akabab ${res.status}`);
    return (await res.json()) as AkababHero[];
}