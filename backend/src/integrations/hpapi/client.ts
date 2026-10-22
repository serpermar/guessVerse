const HPAPI_BASE = 'https://hp-api.onrender.com/api';

export interface HpCharacter {
    id: string;
    name: string;
    alternate_names: string[];
    species: string;          // human, ghost, half-giant, ...
    gender: string;           // male, female
    house: string;            // Gryffindor, Slytherin, Ravenclaw, Hufflepuff, ''
    wizard: boolean;
    ancestry: string;
    hogwartsStudent: boolean;
    hogwartsStaff: boolean;
    alive: boolean;
    image: string;            // puede ser ''
}

export async function fetchAllHpCharacters(): Promise<HpCharacter[]> {
    const res = await fetch(`${HPAPI_BASE}/characters`);
    if (!res.ok) throw new Error(`HP-API ${res.status}`);
    return (await res.json()) as HpCharacter[];
}