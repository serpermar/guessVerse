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