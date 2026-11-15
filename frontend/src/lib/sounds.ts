/**
 * Compatibilidad con la API anterior: `playSound` ahora usa el motor de audio
 * sintetizado de `lib/audio.ts`, sin depender de archivos externos.
 */
export { playSfx as playSound } from './audio';
export type { SfxName } from './audio';
