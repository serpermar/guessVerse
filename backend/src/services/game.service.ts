import { supabaseAdmin } from '../db/supabase.js';

interface CharacterCard {
    id: string;
    name: string;
    image_url: string | null;
}

type Answer = 'yes' | 'no' | 'unknown';

function evaluate(value: unknown, operator: string, expected: unknown): Answer {
    if (value === null || value === undefined) return 'unknown';
    switch (operator) {
        case 'eq': return value === expected ? 'yes' : 'no';
        case 'ne': return value !== expected ? 'yes' : 'no';
        case 'in': return Array.isArray(expected) && expected.includes(value) ? 'yes' : 'no';
        case 'not_in': return Array.isArray(expected) && !expected.includes(value) ? 'yes' : 'no';
        default: return 'unknown';
    }
}

export async function createGame(themeSlug: string, boardSize = 16) {
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes')
        .select('id, name, slug, image_url')
        .eq('slug', themeSlug)
        .eq('is_active', true)
        .single();
    if (themeErr || !theme) throw new Error(`Theme "${themeSlug}" no encontrado`);

    // Traer todos los personajes del theme a través de sus franchises
    const { data: franchises } = await supabaseAdmin
        .from('franchises')
        .select('id')
        .eq('theme_id', theme.id);
    const franchiseIds = (franchises ?? []).map((f) => f.id);
    if (franchiseIds.length === 0) throw new Error('La temática no tiene personajes todavía');

    const { data: chars, error: charsErr } = await supabaseAdmin
        .from('characters')
        .select('id, name, image_url')
        .in('franchise_id', franchiseIds);
    if (charsErr || !chars || chars.length < 4) {
        throw new Error('La temática necesita al menos 4 personajes');
    }

    // Shuffle y recorte
    const shuffled = [...chars].sort(() => Math.random() - 0.5);
    const board = shuffled.slice(0, Math.min(boardSize, shuffled.length));
    const secret = board[Math.floor(Math.random() * board.length)];

    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .insert({
            theme_id: theme.id,
            mode: 'classic',
            status: 'playing',
            secret_character_id: secret.id,
            started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (gameErr || !game) throw new Error(`Error creando partida: ${gameErr?.message}`);

    // Insertar tablero
    await supabaseAdmin.from('game_characters').insert(
        board.map((c) => ({ game_id: game.id, character_id: c.id }))
    );

    return {
        gameId: game.id,
        theme,
        board: board as CharacterCard[],
        status: 'playing' as const,
    };
}

export async function askQuestion(gameId: string, questionCode: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, secret_character_id')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw new Error('Partida no encontrada');
    if (game.status !== 'playing') throw new Error(`La partida ya terminó (${game.status})`);

    const { data: question } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('code', questionCode)
        .eq('is_active', true)
        .single();
    if (!question) throw new Error(`Pregunta "${questionCode}" no existe`);

    const { data: secretChar } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', game.secret_character_id)
        .single();
    if (!secretChar) throw new Error('Personaje secreto no encontrado');

    const expected = (question.value as { v: unknown }).v;
    const secretValue = (secretChar as Record<string, unknown>)[question.attribute];
    const answer = evaluate(secretValue, question.operator, expected);

    // 👇 SELECT ESTÁTICO con todos los atributos posibles
    const { data: boardRows } = await supabaseAdmin
        .from('game_characters')
        .select(
            'character_id, characters(id, name, image_url, gender, is_human, is_hero, is_villain, is_protagonist, has_powers, uses_weapon, species)'
        )
        .eq('game_id', gameId);

    const yes: string[] = [];
    const no: string[] = [];
    const unknown: string[] = [];

    for (const row of boardRows ?? []) {
        const raw = row.characters as unknown;
        const ch: Record<string, unknown> | null = Array.isArray(raw)
            ? ((raw[0] as Record<string, unknown> | undefined) ?? null)
            : ((raw as Record<string, unknown> | null) ?? null);

        if (!ch) continue;
        const v = evaluate(ch[question.attribute], question.operator, expected);
        if (v === 'yes') yes.push(row.character_id);
        else if (v === 'no') no.push(row.character_id);
        else unknown.push(row.character_id);
    }

    await supabaseAdmin.from('game_questions').insert({
        game_id: gameId,
        question_id: question.id,
        answer,
    });

    return {
        question: { code: question.code, text: question.text_es },
        answer,
        matches: { yes, no, unknown },
    };
}

export async function guessCharacter(gameId: string, characterId: string) {
    const { data: game } = await supabaseAdmin
        .from('games')
        .select('id, status, secret_character_id')
        .eq('id', gameId)
        .single();
    if (!game) throw new Error('Partida no encontrada');
    if (game.status !== 'playing') throw new Error(`La partida ya terminó (${game.status})`);

    const isCorrect = game.secret_character_id === characterId;

    await supabaseAdmin.from('guesses').insert({
        game_id: gameId,
        character_id: characterId,
        is_correct: isCorrect,
    });

    if (isCorrect) {
        await supabaseAdmin
            .from('games')
            .update({ status: 'won', finished_at: new Date().toISOString() })
            .eq('id', gameId);
        const { data: secret } = await supabaseAdmin
            .from('characters')
            .select('id, name, image_url')
            .eq('id', game.secret_character_id)
            .single();
        return { correct: true, status: 'won', secret };
    }

    return { correct: false, status: 'playing' };
}

export async function getGame(gameId: string) {
    const { data: game } = await supabaseAdmin
        .from('games')
        .select('id, status, theme_id, started_at, finished_at, secret_character_id, themes(id, name, slug, image_url)')
        .eq('id', gameId)
        .single();
    if (!game) throw new Error('Partida no encontrada');

    const { data: board } = await supabaseAdmin
        .from('game_characters')
        .select('character_id, is_eliminated, characters(id, name, image_url)')
        .eq('game_id', gameId);

    return { game, board: board ?? [] };
}