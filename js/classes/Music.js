import Playlist from "./Playlist.js";

export default class Music {
    static isPlaying = false;
    static startTime = 0;
    static pauseOffset = 0;
    static currentSourceNode = null;

    // Callback opcional, definido pelo main.js, chamado quando uma música
    // termina NATURALMENTE (chegou ao fim sozinha). Não é chamado quando a
    // música é pausada, parada ou trocada manualmente pelo usuário.
    static onTrackEnded = null;

    // 1. Instância ÚNICA global do motor de áudio para toda a aplicação
    static audioContext = new (
        window.AudioContext || window.webkitAudioContext
    )();

    constructor(name, artist, image, audioBuffer, duration, id, playlistId) {
        this.name = name;
        this.artist = artist;
        this.image = image;
        this.audioBuffer = audioBuffer; // Agora recebe apenas os dados de som decodificados
        this.duration = duration;
        this.id = id;
        this.playlistId = playlistId;
    }

    static getDurationMusic(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    static playMusic(music) {
        if (this.isPlaying || !music || !music.audioBuffer) return;

        // Desbloqueia o contexto de áudio se o navegador tiver pausado por segurança
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume();
        }

        const SOURCE_NODE = this.audioContext.createBufferSource();
        SOURCE_NODE.buffer = music.audioBuffer;
        SOURCE_NODE.connect(this.audioContext.destination);

        // Disparado pelo próprio Web Audio API quando o áudio termina sozinho.
        // Isso continua funcionando mesmo com a aba em segundo plano, ao
        // contrário de uma lógica baseada em requestAnimationFrame.
        SOURCE_NODE.onended = () => {
            // Se esse node não é mais o node "atual", foi um stop/pause manual
            // (que já limpa onended antes de chamar .stop()) ou já foi trocado.
            if (this.currentSourceNode !== SOURCE_NODE) return;

            this.currentSourceNode = null;
            this.isPlaying = false;
            this.pauseOffset = 0;

            if (typeof this.onTrackEnded === "function") {
                this.onTrackEnded(music);
            }
        };

        const offset = this.pauseOffset;
        this.startTime = this.audioContext.currentTime - offset;

        SOURCE_NODE.start(0, offset);

        // Adionar a lista de músicas já tocadas
        const PLAYLIST = Playlist.getPlaylistById(music.playlistId);
        if (PLAYLIST) PLAYLIST.musicsPlayed.push(music.id);

        this.currentSourceNode = SOURCE_NODE;
        this.isPlaying = true;
    }

    static pauseMusic() {
        if (!this.isPlaying || !this.currentSourceNode) return;

        // Remove o listener ANTES de parar, senão o pause dispararia
        // "onTrackEnded" como se a música tivesse acabado sozinha.
        this.currentSourceNode.onended = null;
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
        this.currentSourceNode = null;

        this.pauseOffset = this.audioContext.currentTime - this.startTime;
        this.isPlaying = false;
    }

    static stopMusic() {
        if (this.currentSourceNode) {
            this.currentSourceNode.onended = null;
            this.currentSourceNode.stop();
            this.currentSourceNode.disconnect();
            this.currentSourceNode = null;
        }

        this.pauseOffset = 0;
        this.isPlaying = false;
    }

    // Libera o AudioBuffer (PCM decodificado) de uma música da memória.
    // Chame isso sempre que sair de uma música para outra diferente, pra
    // evitar acúmulo de buffers decodificados ao longo da sessão. O buffer
    // volta a ser carregado do IndexedDB automaticamente quando a música
    // for tocada de novo (ver loadAndPlayMusic no main.js).
    static unloadAudioBuffer(music) {
        if (music) music.audioBuffer = null;
    }

    static getCurrentTime() {
        if (!this.isPlaying) return this.pauseOffset;
        return this.audioContext.currentTime - this.startTime;
    }

    static getMusicByID(playlistId, musicId) {
        const playlist = Playlist.getPlaylistById(playlistId);
        return playlist.musics.find((m) => m.id == musicId);
    }

    static nextMusic(currentMusic) {
        const playlist = Playlist.getPlaylistById(currentMusic.playlistId);
        const currentIndex = playlist.musics.findIndex(
            (m) => m.id == currentMusic.id,
        );

        return currentIndex < (playlist.size - 1)
            ? playlist.musics[currentIndex + 1]
            : playlist.musics[0];
    }

    static prevMusic(currentMusic) {
        const playlist = Playlist.getPlaylistById(currentMusic.playlistId);
        const currentIndex = playlist.musics.findIndex(
            (m) => m.id == currentMusic.id,
        );

        return currentIndex > 0
            ? playlist.musics[currentIndex - 1]
            : playlist.musics[playlist.size - 1];
    }

    static getRandomMusic(currentMusic) {
        if (!currentMusic) return null;
        const PLAYLIST = Playlist.getPlaylistById(currentMusic.playlistId);
        if (!PLAYLIST || PLAYLIST.musics.length === 0) return null;

        if (PLAYLIST.size <= PLAYLIST.musicsPlayed.length) {
            PLAYLIST.musicsPlayed = [];
        }

        // Sorteia diretamente entre os objetos de música ainda não tocados,
        // em vez de sortear um número e usar como índice do array. Assim o
        // resultado nunca depende de "id == posição no array", que deixa de
        // ser verdade assim que uma música é removida da playlist.
        const availableMusics = PLAYLIST.musics.filter(
            (m) => !PLAYLIST.musicsPlayed.includes(m.id),
        );

        const pool = availableMusics.length > 0 ? availableMusics : PLAYLIST.musics;
        const randomIndex = Math.floor(Math.random() * pool.length);

        return pool[randomIndex];
    }
}
