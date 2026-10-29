// backend/src/integrations/wikidata/client.ts

export interface WikidataClassification {
    role: 'hero' | 'villain' | 'neutral';
    species: string | null;
}

interface SparqlResponse {
    results: {
        bindings: {
            roleLabel?: { value: string };
            speciesLabel?: { value: string };
        }[];
    };
}

interface SparqlImageResponse {
    results: {
        bindings: {
            image?: { value: string };
        }[];
    };
}

// 1. Clasificación (Rol y Especie)
export async function classifyWithWikidata(
    characterName: string,
    _movieTitle: string
): Promise<WikidataClassification | null> {
    const cleanName = characterName.split(' / ')[0].trim();

    const query = `
    SELECT ?roleLabel ?speciesLabel WHERE {
      ?character rdfs:label "${cleanName}"@en .
      ?character schema:description ?description .
      FILTER(
        CONTAINS(LCASE(?description), "character") || 
        CONTAINS(LCASE(?description), "personaje") ||
        CONTAINS(LCASE(?description), "fictional")
      )
      OPTIONAL {
        ?character wdt:P5800 ?role .
        ?role rdfs:label ?roleLabel .
        FILTER(LANG(?roleLabel) = "en" || LANG(?roleLabel) = "es")
      }
      OPTIONAL {
        ?character wdt:P279 ?species .
        ?species rdfs:label ?speciesLabel .
        FILTER(LANG(?speciesLabel) = "en" || LANG(?speciesLabel) = "es")
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } LIMIT 1
  `;

    try {
        const url = new URL('https://query.wikidata.org/sparql');
        url.searchParams.set('query', query);
        url.searchParams.set('format', 'json');

        const res = await fetch(url.toString(), {
            headers: { 'User-Agent': 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)' },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as SparqlResponse;
        const binding = data.results.bindings[0];
        if (!binding) return null;

        let role: 'hero' | 'villain' | 'neutral' = 'neutral';
        if (binding.roleLabel) {
            const r = binding.roleLabel.value.toLowerCase();
            if (r.includes('protagonist') || r.includes('hero') || r.includes('protagonista') || r.includes('héroe')) {
                role = 'hero';
            } else if (r.includes('antagonist') || r.includes('villain') || r.includes('antagonista') || r.includes('villano')) {
                role = 'villain';
            }
        }

        let species: string | null = null;
        if (binding.speciesLabel) {
            const s = binding.speciesLabel.value.toLowerCase();
            if (!['human', 'humano', 'fictional character', 'personaje ficticio'].includes(s)) {
                species = s;
            }
        }

        return { role, species };
    } catch (error) {
        return null;
    }
}

// 2. NUEVO: Obtener imagen de Wikidata (Propiedad P18)
export async function getWikidataImage(characterName: string): Promise<string | null> {
    const cleanName = characterName.split(' / ')[0].trim();

    const query = `
    SELECT ?image WHERE {
      ?character rdfs:label "${cleanName}"@en .
      ?character wdt:P31/wdt:P279* wd:Q95074 .
      ?character wdt:P18 ?image .
    } LIMIT 1
  `;

    try {
        const url = new URL('https://query.wikidata.org/sparql');
        url.searchParams.set('query', query);
        url.searchParams.set('format', 'json');

        const res = await fetch(url.toString(), {
            headers: { 'User-Agent': 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)' },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as SparqlImageResponse;
        const imageUrl = data.results.bindings[0]?.image?.value;

        if (!imageUrl) return null;

        // Wikimedia devuelve una URL del tipo "http://commons.wikimedia.org/wiki/Special:FilePath/..."
        // Aseguramos que sea HTTPS y la devolvemos
        return imageUrl.replace('http://', 'https://');
    } catch (error) {
        return null;
    }
}