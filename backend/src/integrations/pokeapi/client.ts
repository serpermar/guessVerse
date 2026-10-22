import { fetchJson } from '../../utils/fetch.js';

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
    return fetchJson<PokeApiPokemon>(`${POKEAPI_BASE}/pokemon/${idOrName}`, {}, {
        label: `PokeAPI ${idOrName}`,
    });
}