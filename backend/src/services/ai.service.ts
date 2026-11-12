// backend/src/services/ai.service.ts

import { env } from '../config/env.js';

interface GeneratedQuestion {
    text: string;
    attribute: string;
    value: string | boolean | number;
}

interface CharacterWithAttributes {
    name: string;
    attributes: Record<string, string | boolean | number>;
}

// --- 1. Generación automática de preguntas durante la importación ---
export async function generateThemeQuestionsAndAttributes(
    themeName: string,
    characterNames: string[]
): Promise<{ questions: GeneratedQuestion[]; characters: CharacterWithAttributes[] }> {
    const apiKey = env.groqApiKey;
    if (!apiKey) {
        console.warn('⚠️ GROQ_API_KEY no configurada. Saltando generación con IA.');
        return { questions: [], characters: [] };
    }

    const allQuestions: GeneratedQuestion[] = [];
    const allCharacters: CharacterWithAttributes[] = [];

    const batchSize = 15;
    for (let i = 0; i < characterNames.length; i += batchSize) {
        const batch = characterNames.slice(i, i + batchSize);

        const prompt = `Eres un experto en cultura popular y diseño de juegos de deducción.
        Temática: "${themeName}"
        Personajes a analizar: ${JSON.stringify(batch)}

        Tu tarea es:
        1. Generar entre 5 y 8 preguntas de SÍ/NO que sirvan para distinguir a estos personajes (ej. "¿Es de Gryffindor?", "¿Es un Vengador?", "¿Usa magia?"). Las preguntas deben ser lógicas y basadas en la temática.
        2. Para cada personaje de la lista, asignar los valores (true/false o string) correspondientes a los atributos de esas preguntas.

        Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
        {
          "questions": [
            { "text": "¿Es de Gryffindor?", "attribute": "house", "value": "Gryffindor" },
            { "text": "¿Es un villano?", "attribute": "is_villain", "value": true }
          ],
          "characters": [
            { "name": "Harry Potter", "attributes": { "house": "Gryffindor", "is_villain": false } }
          ]
        }
        No incluyas texto adicional, ni markdown, solo el JSON puro.`;

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-20b',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                console.error('❌ Error de Groq:', err);
                continue;
            }

            const data = (await res.json()) as any;
            const content = data.choices?.[0]?.message?.content;
            if (!content) continue;

            const parsed = JSON.parse(content);

            if (parsed.questions) allQuestions.push(...parsed.questions);
            if (parsed.characters) allCharacters.push(...parsed.characters);

            console.log(`🤖 IA procesó lote de ${batch.length} personajes.`);
        } catch (error) {
            console.error('Error generando preguntas con IA:', error);
        }
    }

    return { questions: allQuestions, characters: allCharacters };
}

// --- 2. Pregunta libre en lenguaje natural durante el juego ---
export interface AiFreeResult {
    answer: 'yes' | 'no' | 'unknown';
    matchedIds: string[];
    filters: Record<string, string | number | boolean>;
    message?: string;
}

function readAttribute(character: Record<string, unknown>, key: string): unknown {
    const attributes = character.attributes;
    if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
        const value = (attributes as Record<string, unknown>)[key];
        if (value !== undefined) return value;
    }
    return character[key];
}

export async function askAiFree(
    freeText: string,
    secretCharacter: Record<string, unknown>,
    boardCharacters: Array<Record<string, unknown> & { id: string }>
): Promise<AiFreeResult> {
    const apiKey = env.groqApiKey;
    if (!apiKey) throw new Error('La IA no está configurada en el servidor');

    const question = freeText.trim().slice(0, 200);
    if (question.length < 3) throw new Error('La pregunta es demasiado corta');

    // 1. Extraer los atributos que existen en el tablero
    const availableAttributes = new Set<string>();
    boardCharacters.forEach(ch => {
        if (ch.attributes && typeof ch.attributes === 'object' && !Array.isArray(ch.attributes)) {
            Object.keys(ch.attributes as Record<string, unknown>).forEach(k => availableAttributes.add(k));
        }
        ['is_hero', 'is_villain', 'is_human', 'has_powers', 'uses_weapon', 'is_royal',
            'is_soldier', 'is_scientist', 'is_alien', 'is_mutant', 'has_magic',
            'is_immortal', 'is_criminal', 'gender', 'species'].forEach(k => {
                if (ch[k] !== undefined && ch[k] !== null) availableAttributes.add(k);
            });
    });

    const attrsList = Array.from(availableAttributes);

    // 2. Prompt: solo puede usar atributos presentes en la partida.
    const prompt = `Eres un asistente para un juego de adivinanzas. El usuario pregunta: "${question}".
    Los atributos disponibles en esta partida son: ${JSON.stringify(attrsList)}.

    Traduce la pregunta a un objeto JSON con los filtros aplicables usando SOLO esos atributos.
    Si la pregunta no se puede traducir a ninguno de los atributos disponibles, devuelve un objeto vacío {}.

    Ejemplo de respuesta: {"is_villain": true}
    No incluyas texto adicional, solo el JSON.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.1,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            await res.text().catch(() => '');
            throw new Error('La IA no está disponible en este momento');
        }

        const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Respuesta vacía de la IA');

        const parsed: unknown = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Respuesta inválida de la IA');
        }

        // Solo aceptamos atributos existentes y valores primitivos.
        const filters: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!availableAttributes.has(key)) continue;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                filters[key] = value;
            }
        }

        if (Object.keys(filters).length === 0) {
            return {
                answer: 'unknown',
                matchedIds: [],
                filters: {},
                message: 'La IA no ha podido interpretar la pregunta con los atributos de esta temática. Prueba a reformularla o usa las preguntas rápidas.'
            };
        }

        // 3. Evaluar el personaje secreto
        let answer: 'yes' | 'no' | 'unknown' = 'yes';
        for (const [key, value] of Object.entries(filters)) {
            const secretValue = readAttribute(secretCharacter, key);
            if (secretValue === undefined || secretValue === null) {
                answer = 'unknown';
                break;
            }
            if (String(secretValue).toLowerCase() !== String(value).toLowerCase()) {
                answer = 'no';
                break;
            }
        }

        if (answer === 'unknown') {
            return {
                answer: 'unknown',
                matchedIds: [],
                filters,
                message: `El personaje secreto no tiene información sobre "${Object.keys(filters).join(', ')}". Prueba otra pregunta.`
            };
        }

        // 4. Evaluar el tablero
        const matchedIds: string[] = [];
        for (const ch of boardCharacters) {
            let match = true;
            for (const [key, value] of Object.entries(filters)) {
                const attrValue = readAttribute(ch, key);
                if (attrValue === undefined || attrValue === null) {
                    match = false;
                    break;
                }
                if (String(attrValue).toLowerCase() !== String(value).toLowerCase()) {
                    match = false;
                    break;
                }
            }
            if (answer === 'yes' && !match) matchedIds.push(ch.id);
            if (answer === 'no' && match) matchedIds.push(ch.id);
        }

        return { answer, matchedIds, filters };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('La IA tardó demasiado en responder');
        }
        console.error('Error en askAiFree:', error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export interface BookInfo {
    title: string;
    authors: string[];
    description: string;
    firstPublishYear: number | null;
}

export interface BookCharacterExtract {
    name: string;
    species?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    is_human?: boolean | null;
    is_hero?: boolean | null;
    is_villain?: boolean | null;
    is_protagonist?: boolean | null;
    has_powers?: boolean | null;
    uses_weapon?: boolean | null;
    extraAttributes?: Record<string, string | boolean | number>;
}

/**
 * Pide a Groq que extraiga los personajes principales del libro con sus atributos.
 * Devuelve un array listo para insertar en `characters`. Si la IA falla, devuelve [].
 */
export async function extractBookCharacters(book: BookInfo): Promise<BookCharacterExtract[]> {
    const apiKey = env.groqApiKey;
    if (!apiKey) {
        console.warn('⚠️ GROQ_API_KEY no configurada. No se pueden extraer personajes del libro.');
        return [];
    }

    // Sanitizar título: quita "(series) 1-7", "(Saga)", "(Trilogía)", etc.
    const cleanTitle = book.title
        .replace(/\s*\(\s*(series|saga|trilog[ií]a|colecci[oó]n)\s*\)\s*\d*\s*(-\s*\d+)?/gi, '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const prompt = `Eres un experto en literatura. Extrae los personajes de la obra "${cleanTitle}".

Autor: ${book.authors.join(', ') || 'desconocido'}
Año: ${book.firstPublishYear ?? 'desconocido'}

Sinopsis:
${book.description.slice(0, 2000) || '(sin sinopsis; usa tu conocimiento de la obra)'}

Devuelve ÚNICAMENTE un JSON válido, sin markdown, con esta forma exacta:
{"characters":[{"name":"Nombre del personaje","species":"humano","gender":"male","is_hero":true,"is_villain":false,"is_protagonist":true,"has_powers":false,"uses_weapon":false,"is_human":true,"extraAttributes":{}}]}

Reglas:
- Extrae entre 8 y 12 personajes principales/secundarios.
- Solo personajes que aparezcan en la obra. NO inventes.
- Si dudas de un campo usa null. Solo "name" es obligatorio.
- "gender" debe ser "male", "female" u "other".
- "extraAttributes" es un objeto (vacío {} si no hay atributos extra).
- No incluyas texto adicional, solo el JSON puro.`;

    // Cadena de fallbacks: modelos + modo JSON.
    // 1) llama-3.3-70b: el más fiable con JSON en Groq.
    // 2) gpt-oss-20b: el que ya usas en otras funciones.
    // 3) llama-3.1-8b: último recurso rápido.
    // Para cada modelo probamos con y sin response_format json_object,
    // porque algunos modelos devuelven vacío con json_object en prompts largos.
    const attempts: Array<{ model: string; jsonMode: boolean }> = [
        { model: 'openai/gpt-oss-20b', jsonMode: false },
        { model: 'openai/gpt-oss-20b', jsonMode: true },
        { model: 'meta-llama/llama-4-scout-17b-16e-instruct', jsonMode: false },
        { model: 'openai/gpt-oss-120b', jsonMode: false },
    ];

    for (const { model, jsonMode } of attempts) {
        try {
            const content = await callGroq(apiKey, model, prompt, jsonMode);
            if (!content) {
                console.warn(`[ai] ${model} (jsonMode=${jsonMode}) devolvió vacío`);
                continue;
            }

            const parsed = extractJson(content);
            const list = parsed?.characters;
            if (!Array.isArray(list) || list.length === 0) {
                console.warn(`[ai] ${model} (jsonMode=${jsonMode}) no devolvió "characters" válidos`);
                continue;
            }

            const cleaned: BookCharacterExtract[] = list
                .filter((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0)
                .slice(0, 12)
                .map((c: any) => ({
                    name: String(c.name).trim(),
                    species: typeof c.species === 'string' && c.species.trim() ? c.species.trim() : null,
                    gender: ['male', 'female', 'other'].includes(c.gender) ? c.gender : null,
                    is_human: typeof c.is_human === 'boolean' ? c.is_human : null,
                    is_hero: typeof c.is_hero === 'boolean' ? c.is_hero : null,
                    is_villain: typeof c.is_villain === 'boolean' ? c.is_villain : null,
                    is_protagonist: typeof c.is_protagonist === 'boolean' ? c.is_protagonist : null,
                    has_powers: typeof c.has_powers === 'boolean' ? c.has_powers : null,
                    uses_weapon: typeof c.uses_weapon === 'boolean' ? c.uses_weapon : null,
                    extraAttributes:
                        c.extraAttributes && typeof c.extraAttributes === 'object' && !Array.isArray(c.extraAttributes)
                            ? c.extraAttributes
                            : {},
                }));

            if (cleaned.length > 0) {
                console.log(`✅ Extraídos ${cleaned.length} personajes de "${cleanTitle}" con ${model} (jsonMode=${jsonMode})`);
                return cleaned;
            }
        } catch (err) {
            console.warn(`[ai] Fallo con ${model} (jsonMode=${jsonMode}):`, (err as Error).message);
        }
    }

    console.error(`❌ No se pudieron extraer personajes de "${cleanTitle}" con ningún modelo.`);
    return [];
}

// --- Helpers privados para extractBookCharacters ---

async function callGroq(
    apiKey: string,
    model: string,
    prompt: string,
    jsonMode: boolean,
): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
        const body: Record<string, unknown> = {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 4000,
        };
        if (jsonMode) body.response_format = { type: 'json_object' };

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.warn(
                `[ai:${model}] (jsonMode=${jsonMode}) HTTP ${res.status}: ${errText.slice(0, 400)}`,
            );
            return null;
        }

        const data = (await res.json()) as {
            choices?: Array<{
                message?: { content?: string | null; reasoning?: string | null };
                finish_reason?: string;
            }>;
        };
        const choice = data.choices?.[0];
        const content = choice?.message?.content ?? null;

        // Log cuando viene vacío: casi siempre es "finish_reason=length" o
        // el modelo devolvió reasoning sin content.
        if (!content) {
            console.warn(
                `[ai:${model}] (jsonMode=${jsonMode}) content vacío. finish_reason=${choice?.finish_reason ?? '?'} ` +
                `reasoning=${choice?.message?.reasoning ? 'sí' : 'no'}`,
            );
            return null;
        }

        return content;
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            console.warn(`[ai:${model}] (jsonMode=${jsonMode}) Timeout de 45s`);
        } else {
            console.warn(`[ai:${model}] (jsonMode=${jsonMode}) Error:`, (err as Error).message);
        }
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Intenta parsear JSON de una respuesta que puede venir:
 * - Como JSON puro.
 * - Dentro de ```json ... ``` o ``` ... ```.
 * - Con texto alrededor; extraemos el primer {...} balanceado.
 */
function extractJson(text: string): any {
    // 1. Parse directo
    try { return JSON.parse(text); } catch { /* noop */ }

    // 2. Bloque markdown
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlock) {
        try { return JSON.parse(codeBlock[1].trim()); } catch { /* noop */ }
    }

    // 3. Primer {...} balanceado
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
        try { return JSON.parse(text.slice(first, last + 1)); } catch { /* noop */ }
    }

    return null;
}

// ============================================================
// 4. Enriquecer atributos de manga/cómic con IA (Groq)
// ============================================================
//
// A diferencia de extractBookCharacters, aquí NO inventamos nombres:
// pasamos los nombres reales que devuelve la API y solo pedimos atributos.

export interface MangaCharacterAttributes {
    name: string;
    species?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    is_human?: boolean | null;
    is_hero?: boolean | null;
    is_villain?: boolean | null;
    is_protagonist?: boolean | null;
    has_powers?: boolean | null;
    uses_weapon?: boolean | null;
}

/**
 * Rellena atributos de juego para personajes de manga/cómic.
 * Igual que libros: mensaje único de usuario, sin system, y reintento sin
 * response_format si el modelo lo rechaza. Loguea el cuerpo del error de Groq.
 */
export async function enrichMangaAttributes(
    title: string,
    characterNames: string[],
): Promise<MangaCharacterAttributes[]> {
    const apiKey = env.groqApiKey;
    if (!apiKey) {
        console.warn('[ai:manga] GROQ_API_KEY no configurada');
        return [];
    }
    if (characterNames.length === 0) return [];

    const names = characterNames.slice(0, 15);

    const prompt = `Obra: "${title}"

Personajes (usa el nombre EXACTO, sin inventar ni añadir):
${JSON.stringify(names)}

Devuelve ÚNICAMENTE un JSON con esta forma exacta:
{"characters":[{"name":"Naruto Uzumaki","species":"humano","gender":"male","is_human":true,"is_hero":true,"is_villain":false,"is_protagonist":true,"has_powers":true,"uses_weapon":false}]}

Reglas:
- "gender" debe ser "male", "female" u "other". null si no aplica.
- Todos los booleanos pueden ser null si no estás seguro.
- "species" es una cadena corta ("humano", "elfo", "alien", "dios"…) o null.
- No incluyas texto adicional, solo el JSON.`;

    // Patrón que YA funciona en libros: solo user, y si falla reintenta sin json_object.
    const attempts: Array<{ jsonMode: boolean }> = [
        { jsonMode: false }, // primero SIN response_format (el más compatible)
        { jsonMode: true },  // después CON response_format
    ];

    for (const { jsonMode } of attempts) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30_000);

            const body: Record<string, unknown> = {
                model: 'openai/gpt-oss-20b',
                messages: [{ role: 'user', content: prompt }], // SOLO user
                temperature: 0.1,
                max_tokens: 3000,
            };
            if (jsonMode) body.response_format = { type: 'json_object' };

            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            }).finally(() => clearTimeout(timer));

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.warn(
                    `[ai:manga] gpt-oss-20b (jsonMode=${jsonMode}) HTTP ${res.status}: ${errText.slice(0, 400)}`,
                );
                continue;
            }

            const data = (await res.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                console.warn(`[ai:manga] gpt-oss-20b (jsonMode=${jsonMode}) respuesta vacía`);
                continue;
            }

            // Parseo tolerante (a veces el modelo devuelve ```json … ```).
            const parsed = parseJsonLoose(content);
            const list = parsed?.characters;
            if (!Array.isArray(list) || list.length === 0) {
                console.warn(
                    `[ai:manga] gpt-oss-20b (jsonMode=${jsonMode}) sin "characters" válidos. Raw: ${content.slice(0, 200)}`,
                );
                continue;
            }

            const nameSet = new Set(names);
            const cleaned: MangaCharacterAttributes[] = list
                .filter((c: any) => c && typeof c.name === 'string' && nameSet.has(c.name))
                .map((c: any) => ({
                    name: c.name,
                    species:
                        typeof c.species === 'string' && c.species.trim()
                            ? c.species.trim()
                            : null,
                    gender: ['male', 'female', 'other'].includes(c.gender)
                        ? (c.gender as 'male' | 'female' | 'other')
                        : null,
                    is_human: typeof c.is_human === 'boolean' ? c.is_human : null,
                    is_hero: typeof c.is_hero === 'boolean' ? c.is_hero : null,
                    is_villain: typeof c.is_villain === 'boolean' ? c.is_villain : null,
                    is_protagonist: typeof c.is_protagonist === 'boolean' ? c.is_protagonist : null,
                    has_powers: typeof c.has_powers === 'boolean' ? c.has_powers : null,
                    uses_weapon: typeof c.uses_weapon === 'boolean' ? c.uses_weapon : null,
                }));

            if (cleaned.length > 0) {
                console.log(
                    `[ai:manga] ✅ Enriquecidos ${cleaned.length}/${names.length} personajes de "${title}" (jsonMode=${jsonMode})`,
                );
                return cleaned;
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.warn(`[ai:manga] Timeout de 30s (jsonMode=${jsonMode})`);
            } else {
                console.warn(`[ai:manga] Fallo (jsonMode=${jsonMode}):`, (err as Error).message);
            }
        }
    }

    console.warn(`[ai:manga] ❌ No se pudieron enriquecer atributos de "${title}"`);
    return [];
}

/** Parsea JSON aunque venga dentro de ```json … ``` o con texto alrededor. */
function parseJsonLoose(text: string): any {
    try { return JSON.parse(text); } catch { /* noop */ }

    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (block) {
        try { return JSON.parse(block[1].trim()); } catch { /* noop */ }
    }

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
        try { return JSON.parse(text.slice(first, last + 1)); } catch { /* noop */ }
    }
    return null;
}