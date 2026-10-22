-- ============================================================================
-- GuessVerse — Datos semilla (temáticas, franquicias y preguntas)
-- ============================================================================
-- Idempotente. Ejecutar DESPUÉS de 0001_init.sql.
-- Los personajes NO se siembran aquí: se importan vía /api/import/* (solo dev).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Temáticas
-- ----------------------------------------------------------------------------
insert into public.themes (slug, name, description, type, source, question_categories)
values
    ('marvel',        'Marvel',        'Superhéroes y villanos del universo Marvel',      'superheroes', 'manual', '{identity,role,abilities}'),
    ('star-wars',     'Star Wars',     'Personajes de la saga galáctica',                 'movies',      'manual', '{identity,role,abilities}'),
    ('harry-potter',  'Harry Potter',  'Magos y criaturas del mundo mágico',              'fantasy',     'manual', '{identity,role,abilities}'),
    ('resident-evil', 'Resident Evil', 'Supervivientes y criaturas de Raccoon City',      'videogames',  'manual', '{identity,role,abilities}'),
    ('pokemon',       'Pokémon',       'Pokémon y entrenadores',                          'anime',       'manual', '{pokemon}')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- Franquicias
-- ----------------------------------------------------------------------------
insert into public.franchises (theme_id, slug, name, description, source)
select t.id, v.slug, v.name, v.description, 'manual'
from (values
    ('marvel',        'mcu',            'Marvel Cinematic Universe',     'Películas del MCU'),
    ('star-wars',     'skywalker-saga', 'Star Wars: Skywalker Saga',     'Episodios I–IX'),
    ('pokemon',       'gen-1',          'Pokémon Generación 1',          'Los 50 Pokémon más icónicos de Kanto')
) as v(theme_slug, slug, name, description)
join public.themes t on t.slug = v.theme_slug
on conflict (theme_id, slug) do nothing;

-- ----------------------------------------------------------------------------
-- Preguntas
-- ----------------------------------------------------------------------------
insert into public.questions (code, text_es, attribute, operator, value, category)
values
    ('is_male',          '¿Es hombre?',            'gender',         'eq', '{"v":"male"}'::jsonb,   'identity'),
    ('is_female',        '¿Es mujer?',             'gender',         'eq', '{"v":"female"}'::jsonb, 'identity'),
    ('is_human',         '¿Es humano?',            'is_human',       'eq', '{"v":true}'::jsonb,     'identity'),
    ('is_hero',          '¿Es un héroe?',          'is_hero',        'eq', '{"v":true}'::jsonb,     'role'),
    ('is_villain',       '¿Es un villano?',        'is_villain',     'eq', '{"v":true}'::jsonb,     'role'),
    ('is_protagonist',   '¿Es protagonista?',      'is_protagonist', 'eq', '{"v":true}'::jsonb,     'role'),
    ('has_powers',       '¿Tiene poderes?',        'has_powers',     'eq', '{"v":true}'::jsonb,     'abilities'),
    ('uses_weapon',      '¿Utiliza armas?',        'uses_weapon',    'eq', '{"v":true}'::jsonb,     'abilities'),
    ('pokemon_fire',     '¿Es de tipo fuego?',     'species',        'eq', '{"v":"fire"}'::jsonb,   'pokemon'),
    ('pokemon_water',    '¿Es de tipo agua?',      'species',        'eq', '{"v":"water"}'::jsonb,  'pokemon'),
    ('pokemon_grass',    '¿Es de tipo planta?',    'species',        'eq', '{"v":"grass"}'::jsonb,  'pokemon'),
    ('pokemon_electric', '¿Es de tipo eléctrico?', 'species',        'eq', '{"v":"electric"}'::jsonb,'pokemon'),
    ('pokemon_poison',   '¿Es de tipo veneno?',    'species',        'eq', '{"v":"poison"}'::jsonb, 'pokemon'),
    ('pokemon_flying',   '¿Es de tipo volador?',   'species',        'eq', '{"v":"flying"}'::jsonb, 'pokemon'),
    ('pokemon_normal',   '¿Es de tipo normal?',    'species',        'eq', '{"v":"normal"}'::jsonb, 'pokemon'),
    ('pokemon_bug',      '¿Es de tipo bicho?',     'species',        'eq', '{"v":"bug"}'::jsonb,    'pokemon'),
    ('hp_gryffindor',    '¿Es de Gryffindor?',     'house',          'eq', '{"v":"Gryffindor"}'::jsonb, 'hogwarts'),
    ('hp_slytherin',     '¿Es de Slytherin?',      'house',          'eq', '{"v":"Slytherin"}'::jsonb,  'hogwarts'),
    ('hp_ravenclaw',     '¿Es de Ravenclaw?',      'house',          'eq', '{"v":"Ravenclaw"}'::jsonb,  'hogwarts'),
    ('hp_hufflepuff',    '¿Es de Hufflepuff?',     'house',          'eq', '{"v":"Hufflepuff"}'::jsonb, 'hogwarts')
on conflict (code) do update set
    text_es = excluded.text_es,
    attribute = excluded.attribute,
    operator = excluded.operator,
    value = excluded.value,
    category = excluded.category,
    is_active = true;

-- ----------------------------------------------------------------------------
-- Temáticas adicionales (DC Comics)
-- ----------------------------------------------------------------------------
insert into public.themes (slug, name, description, type, source, question_categories)
values
    ('dc-comics', 'DC Comics', 'Héroes y villanos del universo DC', 'superheroes', 'manual', '{identity,role,abilities}')
on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    question_categories = excluded.question_categories,
    is_active = true;

-- ----------------------------------------------------------------------------
-- Franquicias adicionales
-- ----------------------------------------------------------------------------
insert into public.franchises (theme_id, slug, name, description, source)
select t.id, v.slug, v.name, v.description, 'manual'
from (values
    ('dc-comics', 'dceu', 'DC Extended Universe', 'Películas del DCEU'),
    ('dc-comics', 'dc-universe', 'DC Universe', 'Personajes del universo DC Comics')
) as v(theme_slug, slug, name, description)
join public.themes t on t.slug = v.theme_slug
on conflict (theme_id, slug) do update set
    name = excluded.name,
    description = excluded.description;
