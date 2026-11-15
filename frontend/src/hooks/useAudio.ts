import { useCallback, useSyncExternalStore } from 'react';
import {
    getAudioSettings,
    playSfx,
    setMusicEnabled,
    setMusicVolume,
    setSfxEnabled,
    setSfxVolume,
    subscribeAudio,
} from '../lib/audio';

/** Preferencias de audio reactivas (música, efectos y volúmenes). */
export function useAudio() {
    const settings = useSyncExternalStore(subscribeAudio, getAudioSettings, getAudioSettings);

    const toggleMusic = useCallback(() => setMusicEnabled(!settings.music), [settings.music]);
    const toggleSfx = useCallback(() => {
        const next = !settings.sfx;
        setSfxEnabled(next);
        if (next) playSfx('click');
    }, [settings.sfx]);
    const changeMusicVolume = useCallback((value: number) => setMusicVolume(value), []);
    const changeSfxVolume = useCallback((value: number) => setSfxVolume(value), []);

    return {
        ...settings,
        toggleMusic,
        toggleSfx,
        setMusicVolume: changeMusicVolume,
        setSfxVolume: changeSfxVolume,
    };
}
