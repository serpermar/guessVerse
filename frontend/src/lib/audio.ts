/**
 * Motor de audio de guessVerse.
 *
 * - Música ambiental generada en tiempo real con Web Audio API: no depende de
 *   archivos externos ni de conexión a Internet.
 * - Cada temática tiene su propia paleta sonora y cada modo de juego cambia el
 *   tempo, la energía y la percusión.
 * - Efectos de sonido sintetizados para interacciones y eventos de partida.
 * - Respeta las políticas de autoplay: el audio arranca tras la primera
 *   interacción del usuario.
 * - Preferencias persistentes en `localStorage`.
 */

export type SfxName =
  | 'click'
  | 'flip'
  | 'eliminate'
  | 'restore'
  | 'correct'
  | 'wrong'
  | 'win'
  | 'lose'
  | 'hint'
  | 'tick'
  | 'join'
  | 'message'
  | 'start'
  | 'guess'
  | 'turn';

export type MusicMode = 'menu' | 'solo' | 'timed' | 'multiplayer' | 'lobby';

export interface MusicScene {
  mode: MusicMode;
  theme?: string | null;
  /** Tipo de temática en BD: superheroes, manga, comics, videogames, fantasy… */
  themeType?: string | null;
}

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
}

type DrumStyle = 'none' | 'soft' | 'driving';

interface TrackConfig {
  bpm: number;
  chords: number[][];
  bass: number[];
  padWave: OscillatorType;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  padGain: number;
  leadGain: number;
  bassGain: number;
  arpGain: number;
  arpPattern: (number | null)[];
  arpOctave: number;
  leadPattern: (number | null)[];
  leadOctave: number;
  filter: number;
  drums: DrumStyle;
}

interface ActiveTrack {
  bus: GainNode;
  timer: number;
  nextBarTime: number;
  barIndex: number;
  config: TrackConfig;
}

interface NoteOptions {
  wave: OscillatorType;
  gain: number;
  attack?: number;
  filter?: number;
  detune?: number;
}

interface SweepOptions {
  wave: OscillatorType;
  gain: number;
  attack?: number;
  filter?: number;
}

interface NoiseOptions {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  q?: number;
  sweepTo?: number;
}

const STORAGE_KEY = 'guessverse:audio';
const MUSIC_LEVEL = 0.3;
const SFX_LEVEL = 0.55;

const DEFAULT_SETTINGS: AudioSettings = {
  music: true,
  sfx: true,
  musicVolume: 0.55,
  sfxVolume: 0.75,
};

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function loadSettings(): AudioSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      music: typeof parsed.music === 'boolean' ? parsed.music : DEFAULT_SETTINGS.music,
      sfx: typeof parsed.sfx === 'boolean' ? parsed.sfx : DEFAULT_SETTINGS.sfx,
      musicVolume: clamp01(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next: AudioSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible: la sesión sigue funcionando */
  }
}

let settings = loadSettings();
const listeners = new Set<() => void>();

export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAudioSettings(): AudioSettings {
  return settings;
}

let ctx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let unlocked = false;
let activeTrack: ActiveTrack | null = null;
let currentSceneKey = '';
let scene: MusicScene = { mode: 'menu' };

// ==========================================================================
// Sonidos sintetizados: tablas por temática
// ==========================================================================

const THEME_TRACKS: Record<string, TrackConfig> = {
  default: {
    bpm: 92,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    bass: [45, 41, 36, 43],
    padWave: 'sine',
    leadWave: 'triangle',
    bassWave: 'sine',
    padGain: 0.05,
    leadGain: 0.032,
    bassGain: 0.055,
    arpGain: 0.024,
    arpPattern: [0, 1, 2, 1, 0, 2, 1, 2],
    arpOctave: 1,
    leadPattern: [0, null, 2, null, 1, null, 2, null],
    leadOctave: 1,
    filter: 1800,
    drums: 'none',
  },
  marvel: {
    bpm: 112,
    chords: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [41, 48, 53, 57],
      [48, 55, 60, 64],
    ],
    bass: [38, 34, 29, 36],
    padWave: 'sawtooth',
    leadWave: 'square',
    bassWave: 'sawtooth',
    padGain: 0.032,
    leadGain: 0.028,
    bassGain: 0.052,
    arpGain: 0.019,
    arpPattern: [0, 1, 2, 3, 2, 1, 3, 2],
    arpOctave: 1,
    leadPattern: [0, null, 1, 2, null, 1, 3, null],
    leadOctave: 1,
    filter: 2200,
    drums: 'driving',
  },
  starwars: {
    bpm: 84,
    chords: [
      [48, 55, 60, 63],
      [44, 51, 56, 60],
      [39, 46, 51, 55],
      [46, 53, 58, 62],
    ],
    bass: [36, 32, 27, 34],
    padWave: 'triangle',
    leadWave: 'sine',
    bassWave: 'triangle',
    padGain: 0.048,
    leadGain: 0.03,
    bassGain: 0.05,
    arpGain: 0.017,
    arpPattern: [0, null, 2, 1, null, 2, null, 1],
    arpOctave: 2,
    leadPattern: [0, null, null, 2, null, 1, null, null],
    leadOctave: 1,
    filter: 1600,
    drums: 'none',
  },
  harry: {
    bpm: 96,
    chords: [
      [57, 60, 64, 69],
      [53, 57, 60, 65],
      [48, 52, 55, 60],
      [55, 59, 62, 67],
    ],
    bass: [45, 41, 36, 43],
    padWave: 'sine',
    leadWave: 'triangle',
    bassWave: 'sine',
    padGain: 0.044,
    leadGain: 0.03,
    bassGain: 0.04,
    arpGain: 0.03,
    arpPattern: [0, 2, 1, 3, 2, 3, 1, 2],
    arpOctave: 2,
    leadPattern: [null, 0, null, 2, null, 1, null, 3],
    leadOctave: 1,
    filter: 2400,
    drums: 'none',
  },
  pokemon: {
    bpm: 132,
    chords: [
      [48, 52, 55, 60],
      [43, 47, 50, 55],
      [45, 48, 52, 57],
      [41, 45, 48, 53],
    ],
    bass: [36, 31, 33, 29],
    padWave: 'triangle',
    leadWave: 'square',
    bassWave: 'square',
    padGain: 0.032,
    leadGain: 0.034,
    bassGain: 0.05,
    arpGain: 0.025,
    arpPattern: [0, 2, 1, 3, 2, 3, 1, 2],
    arpOctave: 1,
    leadPattern: [0, 2, 1, null, 2, 3, null, 1],
    leadOctave: 1,
    filter: 3000,
    drums: 'driving',
  },
  dc: {
    bpm: 104,
    chords: [
      [40, 47, 52, 55],
      [36, 43, 48, 52],
      [43, 50, 55, 59],
      [38, 45, 50, 54],
    ],
    bass: [28, 24, 31, 26],
    padWave: 'sawtooth',
    leadWave: 'triangle',
    bassWave: 'sawtooth',
    padGain: 0.033,
    leadGain: 0.028,
    bassGain: 0.058,
    arpGain: 0.017,
    arpPattern: [0, 1, 2, 1, 0, 2, 1, 0],
    arpOctave: 1,
    leadPattern: [null, 0, null, 1, null, 2, null, 1],
    leadOctave: 1,
    filter: 1400,
    drums: 'driving',
  },
  horror: {
    bpm: 72,
    chords: [
      [38, 45, 50, 53],
      [34, 41, 46, 50],
      [43, 50, 55, 58],
      [33, 40, 45, 49],
    ],
    bass: [26, 22, 31, 21],
    padWave: 'sawtooth',
    leadWave: 'sine',
    bassWave: 'sawtooth',
    padGain: 0.038,
    leadGain: 0.024,
    bassGain: 0.058,
    arpGain: 0.013,
    arpPattern: [0, null, 1, null, 2, null, 1, null],
    arpOctave: 1,
    leadPattern: [null, null, 0, null, null, 1, null, null],
    leadOctave: 2,
    filter: 900,
    drums: 'none',
  },
  comics: {
    bpm: 118,
    chords: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [43, 50, 55, 59],
      [48, 55, 60, 64],
    ],
    bass: [38, 34, 31, 36],
    padWave: 'sawtooth',
    leadWave: 'square',
    bassWave: 'sawtooth',
    padGain: 0.03,
    leadGain: 0.03,
    bassGain: 0.056,
    arpGain: 0.018,
    arpPattern: [0, 2, 1, 2, 3, 2, 1, 2],
    arpOctave: 1,
    leadPattern: [0, null, 2, null, 1, 3, null, 2],
    leadOctave: 1,
    filter: 2400,
    drums: 'driving',
  },
  manga: {
    bpm: 138,
    chords: [
      [52, 59, 64, 67],
      [48, 55, 60, 64],
      [45, 52, 57, 60],
      [50, 57, 62, 65],
    ],
    bass: [40, 36, 33, 38],
    padWave: 'triangle',
    leadWave: 'square',
    bassWave: 'square',
    padGain: 0.028,
    leadGain: 0.034,
    bassGain: 0.052,
    arpGain: 0.026,
    arpPattern: [0, 2, 1, 3, 2, 3, 1, 2],
    arpOctave: 1,
    leadPattern: [0, null, 2, 1, null, 3, 2, null],
    leadOctave: 1,
    filter: 3200,
    drums: 'driving',
  },
  videogames: {
    bpm: 144,
    chords: [
      [48, 52, 55, 60],
      [43, 47, 50, 55],
      [45, 49, 52, 57],
      [41, 45, 48, 53],
    ],
    bass: [36, 31, 33, 29],
    padWave: 'square',
    leadWave: 'square',
    bassWave: 'triangle',
    padGain: 0.022,
    leadGain: 0.028,
    bassGain: 0.045,
    arpGain: 0.026,
    arpPattern: [0, 2, 1, 3, 2, 1, 3, 2],
    arpOctave: 1,
    leadPattern: [0, null, 2, 1, null, 3, 2, null],
    leadOctave: 1,
    filter: 3600,
    drums: 'driving',
  },
  fantasy: {
    bpm: 88,
    chords: [
      [57, 60, 64, 69],
      [53, 57, 60, 65],
      [48, 52, 55, 60],
      [55, 59, 62, 67],
    ],
    bass: [45, 41, 36, 43],
    padWave: 'sine',
    leadWave: 'triangle',
    bassWave: 'sine',
    padGain: 0.05,
    leadGain: 0.032,
    bassGain: 0.045,
    arpGain: 0.028,
    arpPattern: [0, 2, null, 1, 3, null, 2, 1],
    arpOctave: 2,
    leadPattern: [null, 0, null, 1, null, 2, null, 3],
    leadOctave: 1,
    filter: 2200,
    drums: 'none',
  },
  cinematic: {
    bpm: 76,
    chords: [
      [45, 52, 57, 60],
      [41, 48, 53, 57],
      [38, 45, 50, 53],
      [43, 50, 55, 58],
    ],
    bass: [33, 29, 26, 31],
    padWave: 'sawtooth',
    leadWave: 'sine',
    bassWave: 'sine',
    padGain: 0.05,
    leadGain: 0.036,
    bassGain: 0.05,
    arpGain: 0.012,
    arpPattern: [0, null, null, 2, null, null, 1, null],
    arpOctave: 2,
    leadPattern: [0, null, null, null, 2, null, null, null],
    leadOctave: 1,
    filter: 1300,
    drums: 'none',
  },
  book: {
    bpm: 84,
    chords: [
      [53, 57, 60, 64],
      [48, 52, 55, 59],
      [50, 53, 57, 60],
      [55, 59, 62, 66],
    ],
    bass: [41, 36, 38, 43],
    padWave: 'sine',
    leadWave: 'triangle',
    bassWave: 'sine',
    padGain: 0.04,
    leadGain: 0.026,
    bassGain: 0.04,
    arpGain: 0.022,
    arpPattern: [0, 1, 2, 1, 0, 2, 3, 1],
    arpOctave: 1,
    leadPattern: [null, 0, null, 2, null, 1, null, null],
    leadOctave: 1,
    filter: 1700,
    drums: 'none',
  },
  scifi: {
    bpm: 90,
    chords: [
      [50, 57, 60, 64],
      [45, 52, 57, 60],
      [41, 48, 53, 57],
      [48, 55, 60, 63],
    ],
    bass: [38, 33, 29, 36],
    padWave: 'triangle',
    leadWave: 'sine',
    bassWave: 'sawtooth',
    padGain: 0.045,
    leadGain: 0.028,
    bassGain: 0.05,
    arpGain: 0.02,
    arpPattern: [0, null, 2, 1, null, 3, 2, null],
    arpOctave: 2,
    leadPattern: [0, null, null, 1, null, 2, null, null],
    leadOctave: 1,
    filter: 1200,
    drums: 'soft',
  },
};

const MODE_TRACKS: Record<'multiplayer' | 'timed', TrackConfig> = {
  multiplayer: {
    bpm: 126,
    chords: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [41, 48, 53, 57],
      [48, 55, 60, 64],
    ],
    bass: [38, 34, 29, 36],
    padWave: 'sawtooth',
    leadWave: 'square',
    bassWave: 'sawtooth',
    padGain: 0.03,
    leadGain: 0.033,
    bassGain: 0.058,
    arpGain: 0.021,
    arpPattern: [0, 2, 1, 3, 2, 3, 1, 2],
    arpOctave: 1,
    leadPattern: [0, null, 1, 2, null, 3, 1, null],
    leadOctave: 1,
    filter: 2600,
    drums: 'driving',
  },
  timed: {
    bpm: 150,
    chords: [
      [52, 59, 64, 67],
      [48, 55, 60, 64],
      [43, 50, 55, 59],
      [50, 57, 62, 66],
    ],
    bass: [40, 36, 31, 38],
    padWave: 'sawtooth',
    leadWave: 'square',
    bassWave: 'sawtooth',
    padGain: 0.028,
    leadGain: 0.035,
    bassGain: 0.062,
    arpGain: 0.022,
    arpPattern: [0, 2, 1, 2, 3, 2, 1, 2],
    arpOctave: 1,
    leadPattern: [0, null, 1, null, 2, null, 3, null],
    leadOctave: 1,
    filter: 3200,
    drums: 'driving',
  },
};

function normalizeKey(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s.]+/g, ' ')
    .trim();
}

/**
 * Franquicias y géneros reconocibles por su slug. La primera coincidencia
 * manda; después se usa el tipo de la temática en BD y, por último, la
 * ambientación genérica.
 */
const THEME_KEYWORDS: Array<{ theme: string; matches: string[] }> = [
  { theme: 'marvel', matches: ['marvel'] },
  {
    theme: 'dc',
    matches: [
      'batman', 'superman', 'wonder woman', 'aquaman', 'green lantern',
      'justice league', 'suicide squad', 'teen titans', 'detective comics',
    ],
  },
  { theme: 'starwars', matches: ['star wars', 'starwars', 'skywalker', 'mandalorian'] },
  { theme: 'harry', matches: ['harry potter', 'potter', 'wizarding world', 'fantastic beasts'] },
  { theme: 'pokemon', matches: ['pokemon'] },
  {
    theme: 'horror',
    matches: [
      'resident evil', 'silent hill', 'horror', 'terror', 'outlast',
      'dead space', 'until dawn', 'five nights', 'fnaf', 'alien isolation',
    ],
  },
  {
    theme: 'scifi',
    matches: [
      'star trek', 'dune', 'alien', 'terminator', 'matrix', 'blade runner',
      'halo', 'mass effect', 'cyberpunk', 'interstellar', 'starcraft',
    ],
  },
  {
    theme: 'manga',
    matches: [
      'manga', 'anime', 'naruto', 'one piece', 'bleach', 'berserk',
      'attack on titan', 'shingeki', 'my hero academia', 'boku no hero',
      'jujutsu', 'demon slayer', 'kimetsu', 'fullmetal alchemist', 'death note',
      'tokyo ghoul', 'chainsaw man', 'hunter x hunter', 'sailor moon',
      'evangelion', 'sword art online', 'inuyasha', 'fairy tail', 'black clover',
      'spy x family', 'vinland saga', 'one punch man', 'mob psycho', 'dragon ball',
      'jojo', 'saint seiya', 'gintama', 'haikyuu', 'slam dunk', 'rurouni kenshin',
      'cardcaptor', 'doraemon', 'akira',
    ],
  },
  {
    theme: 'videogames',
    matches: [
      'videojuego', 'videogame', 'zelda', 'mario', 'sonic', 'final fantasy',
      'kingdom hearts', 'dark souls', 'elden ring', 'god of war', 'last of us',
      'minecraft', 'fortnite', 'overwatch', 'league of legends', 'valorant',
      'genshin', 'metal gear', 'warcraft', 'diablo', 'assassins creed',
    ],
  },
  {
    theme: 'fantasy',
    matches: [
      'fantasy', 'fantasia', 'lord of the rings', 'hobbit', 'game of thrones',
      'narnia', 'eragon', 'percy jackson', 'dungeons', 'wheel of time', 'witcher',
    ],
  },
  {
    theme: 'comics',
    matches: [
      'comic', 'comics', 'comicvine', 'spider man', 'spiderman', 'avengers',
      'iron man', 'captain america', 'x men', 'xmen', 'wolverine', 'black panther',
      'doctor strange', 'guardians of the galaxy', 'deadpool', 'fantastic four',
      'invincible', 'the boys', 'hellboy', 'spawn', 'ninja turtles',
    ],
  },
];

function typeToTheme(type?: string | null): string {
  switch (normalizeKey(type)) {
    case 'superheroes':
    case 'superhero':
    case 'comics':
    case 'comic':
      return 'comics';
    case 'manga':
    case 'anime':
      return 'manga';
    case 'videogames':
    case 'videogame':
    case 'games':
      return 'videogames';
    case 'fantasy':
      return 'fantasy';
    case 'book':
    case 'books':
    case 'novel':
      return 'book';
    case 'movies':
    case 'movie':
    case 'series':
    case 'tv':
      return 'cinematic';
    case 'horror':
    case 'terror':
      return 'horror';
    default:
      return 'default';
  }
}

function resolveTheme(slug?: string | null, type?: string | null): string {
  const value = normalizeKey(slug);

  if (value === 'dc' || value.startsWith('dc ') || value.includes('dc comics')) {
    return 'dc';
  }

  for (const entry of THEME_KEYWORDS) {
    if (entry.matches.some((keyword) => value.includes(keyword))) return entry.theme;
  }

  return typeToTheme(type);
}

function buildTrack(nextScene: MusicScene): TrackConfig {
  if (nextScene.mode === 'multiplayer') return MODE_TRACKS.multiplayer;
  if (nextScene.mode === 'timed') return MODE_TRACKS.timed;

  const base = THEME_TRACKS[resolveTheme(nextScene.theme, nextScene.themeType)] ?? THEME_TRACKS.default;

  if (nextScene.mode === 'menu') {
    return {
      ...base,
      bpm: Math.round(base.bpm * 0.92),
      drums: 'none',
      leadGain: base.leadGain * 0.8,
      arpGain: base.arpGain * 0.85,
    };
  }

  if (nextScene.mode === 'lobby') {
    return {
      ...base,
      bpm: Math.round(base.bpm * 0.96),
      drums: 'soft',
      padGain: base.padGain * 1.1,
    };
  }

  return base;
}

function sceneKeyFor(nextScene: MusicScene): string {
  if (nextScene.mode === 'multiplayer' || nextScene.mode === 'timed') {
    return nextScene.mode;
  }
  return `${nextScene.mode}:${resolveTheme(nextScene.theme, nextScene.themeType)}`;
}

// ==========================================================================
// Núcleo Web Audio
// ==========================================================================

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;

  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterBus = ctx.createGain();
  masterBus.gain.value = 0.9;
  masterBus.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfxVolume * SFX_LEVEL;
  sfxBus.connect(masterBus);

  return ctx;
}

function ensureAudio(): AudioContext | null {
  const audio = ensureContext();
  if (!audio) return null;

  if (audio.state === 'suspended') {
    void audio.resume();
  }

  if (!unlocked) {
    unlocked = true;
    if (settings.music && !activeTrack) startMusic();
  }

  return audio;
}

function applyVolumes(immediate = false) {
  if (!ctx) return;
  const now = ctx.currentTime;

  if (sfxBus) {
    if (immediate) sfxBus.gain.setValueAtTime(settings.sfxVolume * SFX_LEVEL, now);
    else sfxBus.gain.setTargetAtTime(settings.sfxVolume * SFX_LEVEL, now, 0.05);
  }

  if (activeTrack) {
    const target = Math.max(0.0001, settings.musicVolume * MUSIC_LEVEL);
    if (immediate) activeTrack.bus.gain.setValueAtTime(target, now);
    else activeTrack.bus.gain.setTargetAtTime(target, now, 0.08);
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNote(
  destination: AudioNode,
  midi: number,
  start: number,
  duration: number,
  options: NoteOptions,
) {
  if (!ctx) return;

  const safeDuration = Math.max(0.04, duration);
  const attack = Math.min(options.attack ?? 0.02, safeDuration * 0.45);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = options.wave;
  oscillator.frequency.setValueAtTime(midiToFreq(midi), start);
  if (options.detune) oscillator.detune.setValueAtTime(options.detune, start);

  let tail: AudioNode = oscillator;

  if (options.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.filter, start);
    filter.Q.value = 0.8;
    oscillator.connect(filter);
    tail = filter;
  }

  tail.connect(gain);
  gain.connect(destination);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, options.gain), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + safeDuration);

  oscillator.start(start);
  oscillator.stop(start + safeDuration + 0.04);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    if (tail !== oscillator) tail.disconnect();
  };
}

function playSweep(
  destination: AudioNode,
  fromMidi: number,
  toMidi: number,
  start: number,
  duration: number,
  options: SweepOptions,
) {
  if (!ctx) return;

  const safeDuration = Math.max(0.05, duration);
  const attack = Math.min(options.attack ?? 0.005, safeDuration * 0.4);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = options.wave;
  oscillator.frequency.setValueAtTime(midiToFreq(fromMidi), start);
  oscillator.frequency.exponentialRampToValueAtTime(midiToFreq(toMidi), start + safeDuration);

  let tail: AudioNode = oscillator;

  if (options.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.filter, start);
    filter.Q.value = 0.8;
    oscillator.connect(filter);
    tail = filter;
  }

  tail.connect(gain);
  gain.connect(destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, options.gain), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + safeDuration);

  oscillator.start(start);
  oscillator.stop(start + safeDuration + 0.04);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    if (tail !== oscillator) tail.disconnect();
  };
}

function getNoiseBuffer(): AudioBuffer | null {
  if (!ctx) return null;
  if (noiseBuffer) return noiseBuffer;

  const length = Math.floor(ctx.sampleRate);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function playNoise(
  destination: AudioNode,
  start: number,
  duration: number,
  options: NoiseOptions,
) {
  if (!ctx) return;
  const buffer = getNoiseBuffer();
  if (!buffer) return;

  const safeDuration = Math.max(0.02, duration);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  filter.type = options.type;
  filter.frequency.setValueAtTime(options.frequency, start);
  filter.Q.value = options.q ?? 0.8;
  if (options.sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(options.sweepTo, start + safeDuration);
  }

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, options.gain), start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + safeDuration);

  source.start(start);
  source.stop(start + safeDuration + 0.02);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function playKick(destination: AudioNode, start: number, gainValue: number) {
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(135, start);
  oscillator.frequency.exponentialRampToValueAtTime(45, start + 0.16);

  oscillator.connect(gain);
  gain.connect(destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainValue), start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

  oscillator.start(start);
  oscillator.stop(start + 0.25);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playHat(destination: AudioNode, start: number, gainValue: number) {
  playNoise(destination, start, 0.045, {
    type: 'highpass',
    frequency: 7200,
    gain: gainValue,
  });
}

function playSnare(destination: AudioNode, start: number, gainValue: number) {
  playNoise(destination, start, 0.11, {
    type: 'bandpass',
    frequency: 1900,
    q: 1.2,
    gain: gainValue,
  });
}

function scheduleBar(track: ActiveTrack) {
  if (!ctx) return;

  const config = track.config;
  const beat = 60 / config.bpm;
  const barLength = beat * 4;
  const start = track.nextBarTime;
  const chord = config.chords[track.barIndex % config.chords.length];

  if (!chord || chord.length === 0) {
    track.barIndex += 1;
    track.nextBarTime += barLength;
    return;
  }

  const root = config.bass[track.barIndex % config.bass.length] ?? chord[0] - 12;

  // Pad: acorde sostenido durante todo el compás.
  chord.forEach((midi, index) => {
    playNote(track.bus, midi, start, barLength * 0.98, {
      wave: config.padWave,
      gain: config.padGain * (index === 0 ? 1 : 0.7),
      attack: Math.min(0.9, barLength * 0.22),
      filter: config.filter,
    });
  });

  // Bajo: raíz en los pulsos 1 y 3 y quinta en el 4 para los modos enérgicos.
  playNote(track.bus, root, start, beat * 0.9, {
    wave: config.bassWave,
    gain: config.bassGain,
    attack: 0.02,
    filter: config.filter * 0.6,
  });
  playNote(track.bus, root, start + beat * 2, beat * 0.9, {
    wave: config.bassWave,
    gain: config.bassGain,
    attack: 0.02,
    filter: config.filter * 0.6,
  });
  if (config.drums === 'driving') {
    playNote(track.bus, root + 7, start + beat * 3, beat * 0.55, {
      wave: config.bassWave,
      gain: config.bassGain * 0.7,
      attack: 0.02,
      filter: config.filter * 0.6,
    });
  }

  // Arpegio: pequeñas notas plucadas que dan movimiento.
  config.arpPattern.forEach((step, index) => {
    if (step === null) return;
    const midi = chord[step % chord.length] + 12 * config.arpOctave;
    playNote(track.bus, midi, start + index * (beat / 2), beat * 0.42, {
      wave: config.leadWave,
      gain: config.arpGain,
      attack: 0.01,
      filter: config.filter * 1.3,
    });
  });

  // Melodía principal: más espaciada para no saturar.
  config.leadPattern.forEach((step, index) => {
    if (step === null) return;
    const midi = chord[step % chord.length] + 12 * config.leadOctave;
    playNote(track.bus, midi, start + index * (beat / 2), beat * 0.7, {
      wave: config.leadWave,
      gain: config.leadGain,
      attack: 0.03,
      filter: config.filter * 1.5,
    });
  });

  // Percusión sintética.
  if (config.drums !== 'none') {
    playKick(track.bus, start, config.drums === 'driving' ? 0.085 : 0.055);

    if (config.drums === 'driving') {
      playKick(track.bus, start + beat * 2, 0.085);
      playSnare(track.bus, start + beat, 0.045);
      playSnare(track.bus, start + beat * 3, 0.045);
      for (let index = 0; index < 8; index += 1) {
        playHat(track.bus, start + index * (beat / 2), 0.012);
      }
    } else {
      playHat(track.bus, start + beat * 2, 0.02);
    }
  }

  track.barIndex += 1;
  track.nextBarTime += barLength;
}

function scheduleAhead() {
  if (!ctx || !activeTrack) return;
  const until = ctx.currentTime + 1.2;
  let guard = 0;

  while (activeTrack && activeTrack.nextBarTime < until && guard < 8) {
    scheduleBar(activeTrack);
    guard += 1;
  }
}

function startMusic() {
  if (!ctx || !settings.music || !unlocked || document.hidden) return;

  stopMusic(0.6);

  const bus = ctx.createGain();
  const now = ctx.currentTime;
  const target = Math.max(0.0001, settings.musicVolume * MUSIC_LEVEL);

  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(target, now + 1.2);
  bus.connect(masterBus!);

  const track: ActiveTrack = {
    bus,
    config: buildTrack(scene),
    timer: 0,
    nextBarTime: now + 0.12,
    barIndex: 0,
  };

  activeTrack = track;
  scheduleBar(track);
  track.timer = window.setInterval(scheduleAhead, 220);
}

function stopMusic(fade = 0.8) {
  if (!activeTrack || !ctx) {
    activeTrack = null;
    return;
  }

  const old = activeTrack;
  activeTrack = null;
  window.clearInterval(old.timer);

  const now = ctx.currentTime;
  old.bus.gain.cancelScheduledValues(now);
  old.bus.gain.setValueAtTime(Math.max(0.0001, old.bus.gain.value), now);
  old.bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);

  window.setTimeout(() => {
    try {
      old.bus.disconnect();
    } catch {
      /* ya desconectado */
    }
  }, (fade + 0.6) * 1000);
}

// ==========================================================================
// API pública
// ==========================================================================

export function setMusicScene(nextScene: MusicScene) {
  const nextKey = sceneKeyFor(nextScene);
  if (nextKey === currentSceneKey) return;

  currentSceneKey = nextKey;
  scene = nextScene;

  if (unlocked && settings.music) startMusic();
}

export function setMusicEnabled(enabled: boolean) {
  if (settings.music === enabled) return;

  settings = { ...settings, music: enabled };
  saveSettings(settings);
  listeners.forEach((listener) => listener());

  if (enabled) {
    ensureAudio();
    if (unlocked && !activeTrack) startMusic();
  } else {
    stopMusic(0.45);
  }
}

export function setSfxEnabled(enabled: boolean) {
  if (settings.sfx === enabled) return;

  settings = { ...settings, sfx: enabled };
  saveSettings(settings);
  listeners.forEach((listener) => listener());
}

export function setMusicVolume(volume: number) {
  const next = clamp01(volume, settings.musicVolume);
  if (next === settings.musicVolume) return;

  settings = { ...settings, musicVolume: next };
  saveSettings(settings);
  listeners.forEach((listener) => listener());
  applyVolumes();
}

export function setSfxVolume(volume: number) {
  const next = clamp01(volume, settings.sfxVolume);
  if (next === settings.sfxVolume) return;

  settings = { ...settings, sfxVolume: next };
  saveSettings(settings);
  listeners.forEach((listener) => listener());
  applyVolumes();
}

export function playSfx(name: SfxName) {
  if (!settings.sfx) return;

  const audio = ensureAudio();
  if (!audio || !sfxBus) return;

  const start = audio.currentTime + 0.01;
  const bus = sfxBus;

  switch (name) {
    case 'click':
      playNote(bus, 84, start, 0.055, { wave: 'sine', gain: 0.042, attack: 0.002 });
      break;

    case 'flip':
      playNoise(bus, start, 0.14, {
        type: 'bandpass',
        frequency: 900,
        sweepTo: 2400,
        gain: 0.032,
      });
      playSweep(bus, 76, 60, start, 0.12, { wave: 'triangle', gain: 0.028 });
      break;

    case 'eliminate':
      playSweep(bus, 79, 58, start, 0.16, { wave: 'triangle', gain: 0.042 });
      playNote(bus, 48, start + 0.03, 0.14, { wave: 'square', gain: 0.016 });
      break;

    case 'restore':
      playSweep(bus, 58, 79, start, 0.16, { wave: 'triangle', gain: 0.042 });
      playNote(bus, 84, start + 0.1, 0.12, { wave: 'sine', gain: 0.02 });
      break;

    case 'correct':
      playNote(bus, 76, start, 0.09, { wave: 'sine', gain: 0.04 });
      playNote(bus, 84, start + 0.09, 0.14, { wave: 'sine', gain: 0.045 });
      break;

    case 'wrong':
      playSweep(bus, 55, 45, start, 0.24, {
        wave: 'sawtooth',
        gain: 0.035,
        filter: 900,
      });
      break;

    case 'win':
      [72, 76, 79, 84].forEach((midi, index) => {
        playNote(bus, midi, start + index * 0.11, 0.22, {
          wave: 'triangle',
          gain: 0.045,
        });
      });
      [72, 76, 79, 84].forEach((midi) => {
        playNote(bus, midi, start + 0.46, 0.55, { wave: 'sine', gain: 0.022 });
      });
      break;

    case 'lose':
      [60, 57, 53, 48].forEach((midi, index) => {
        playNote(bus, midi, start + index * 0.17, 0.3, {
          wave: 'sawtooth',
          gain: 0.03,
          filter: 1200,
        });
      });
      break;

    case 'hint':
      playNote(bus, 88, start, 0.5, { wave: 'sine', gain: 0.038 });
      playNote(bus, 95, start + 0.06, 0.38, { wave: 'sine', gain: 0.026 });
      playNote(bus, 83, start + 0.02, 0.45, { wave: 'triangle', gain: 0.018 });
      break;

    case 'tick':
      playNote(bus, 96, start, 0.03, { wave: 'square', gain: 0.018 });
      break;

    case 'join':
      [72, 76, 79, 84].forEach((midi, index) => {
        playNote(bus, midi, start + index * 0.08, 0.14, {
          wave: 'square',
          gain: 0.03,
        });
      });
      break;

    case 'message':
      playSweep(bus, 84, 91, start, 0.08, { wave: 'sine', gain: 0.028 });
      playNote(bus, 96, start + 0.075, 0.06, { wave: 'sine', gain: 0.02 });
      break;

    case 'start':
      playNoise(bus, start, 0.38, {
        type: 'highpass',
        frequency: 300,
        sweepTo: 4200,
        gain: 0.028,
      });
      [60, 64, 67, 72].forEach((midi) => {
        playNote(bus, midi, start + 0.12, 0.45, { wave: 'sawtooth', gain: 0.022 });
      });
      playKick(bus, start + 0.12, 0.08);
      break;

    case 'guess':
      playKick(bus, start, 0.11);
      playSweep(bus, 45, 33, start, 0.3, {
        wave: 'sawtooth',
        gain: 0.035,
        filter: 700,
      });
      break;

    case 'turn':
      playNote(bus, 79, start, 0.09, { wave: 'sine', gain: 0.035 });
      playNote(bus, 88, start + 0.1, 0.12, { wave: 'sine', gain: 0.035 });
      break;

    default:
      break;
  }
}

// Desbloquea el audio con el primer gesto del usuario y pausa la música cuando
// la pestaña queda en segundo plano.
if (typeof window !== 'undefined') {
  const unlock = () => {
    ensureAudio();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;

    if (document.hidden) {
      stopMusic(0.2);
    } else if (settings.music) {
      startMusic();
    }
  });
}
