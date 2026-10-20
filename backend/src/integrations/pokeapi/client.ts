const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export interface PokeApiPokemon {
    id: number;
    name: string;
    sprites: {
        other: {
            'official-artwork': { front_default: string | null };
        };
    };
    types: { slot: number; type: { name: string } }[];
}

export async function fetchPokemon(idOrName: number | string): Promise<PokeApiPokemon> {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);
    if (!res.ok) throw new Error(`PokeAPI ${res.status} para ${idOrName}`);
    return (await res.json()) as PokeApiPokemon;
}