import Playlist from "./Playlist.js";

export default class Music {
    static isPlaying = false;
    static startTime = 0;
    static pauseOffset = 0;
    static currentSourceNode = null;

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

        const offset = this.pauseOffset;
        this.startTime = this.audioContext.currentTime - offset;

        SOURCE_NODE.start(0, offset);

        // Adionar a lista de músicas já tocadas
        const PLAYLIST = Playlist.getPlaylistById(music.playlistId);
        PLAYLIST.musicsPlayed.push(music.id)

        this.currentSourceNode = SOURCE_NODE;
        this.isPlaying = true;
    }

    static pauseMusic() {
        if (!this.isPlaying || !this.currentSourceNode) return;

        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
        this.currentSourceNode = null;

        this.pauseOffset = this.audioContext.currentTime - this.startTime;
        this.isPlaying = false;
    }

    static stopMusic() {
        if (this.currentSourceNode) {
            this.currentSourceNode.stop();
            this.currentSourceNode.disconnect();
            this.currentSourceNode = null;
        }

        this.pauseOffset = 0;
        this.isPlaying = false;
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
            : playlist.musics[playlist.size -1];
    }

    static getRandomMusic(currentMusic) {
        if (!currentMusic) return null;
        const PLAYLIST = Playlist.getPlaylistById(currentMusic.playlistId);
        if (!PLAYLIST || PLAYLIST.musics.length === 0) return null;
        if (PLAYLIST.size == PLAYLIST.musicsPlayed.length) PLAYLIST.musicsPlayed = [];

        let randomNumber = 0;

        do {
            randomNumber = Math.floor(Math.random() * PLAYLIST.size);
        } while (PLAYLIST.musicsPlayed.includes(randomNumber));

        return PLAYLIST.musics[randomNumber];
    }
}
