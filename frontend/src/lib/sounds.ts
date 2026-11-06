export const playSound = (type: 'flip' | 'win' | 'lose' | 'click') => {
    const sounds = {
        flip: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
        win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
        lose: 'https://assets.mixkit.co/active_storage/sfx/2530/2530-preview.mp3',
        click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.3;
    audio.play().catch(() => { /* Ignorar bloqueos del navegador */ });
};