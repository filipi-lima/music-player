import Music from "./Music.js";

export default class Playlist {
    static playlists = [];

    constructor(name, musics, id) {
        this.name = name;
        this.musics = musics;
        this.id = id;
        this.size = musics ? musics.length : 0;
        this.musicsPlayed = [];
    }

    static createPlaylist(playlistName) {
        const playlistExists = this.playlists.some(
            (p) => p.name === playlistName,
        );
        if (playlistExists) {
            throw new Error("Já existe uma playlist com esse nome");
        }

        const NEW_PLAYLIST = new Playlist(
            playlistName,
            [],
            this.playlists.length,
        );
        this.playlists.push(NEW_PLAYLIST);

        this.savePlaylistsData(); // Salva no localstorage

        return NEW_PLAYLIST;
    }

    static addMusic(musicName, artistName, imageUrl, audioBuffer, playlistId) {
        const playlist = this.playlists.find((p) => p.id == playlistId);

        if (!playlist) {
            console.error("Playlist não encontrada");
            return null;
        }

        const MUSIC_DURATION = Music.getDurationMusic(audioBuffer.duration);

        const MUSIC = new Music(
            musicName,
            artistName,
            imageUrl,
            audioBuffer,
            MUSIC_DURATION,
            playlist.musics.length,
            playlistId,
        );

        playlist.musics.push(MUSIC);
        playlist.size++;

        this.savePlaylistsData(); // Atualiza o localstorage

        return playlist;
    }

    static getPlaylistById(playlistId) {
        return this.playlists.find((p) => p.id == playlistId);
    }

    static savePlaylistsData() {
        const dataToSave = this.playlists.map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            size: playlist.size,
            musics: playlist.musics.map((music) => ({
                id: music.id,
                name: music.name,
                artist: music.artist,
                image: music.image,
                duration: music.duration,
                playlistId: music.playlistId,
                // Atenção: O audioBuffer NÃO é salvo aqui!
                // Ele vai pro IndexedDB no main.js
            })),
        }));

        localStorage.setItem(
            "MusicPlayer_Playlists",
            JSON.stringify(dataToSave),
        );
    }

    static loadPlaylistsData() {
        const savedData = localStorage.getItem("MusicPlayer_Playlists");
        if (!savedData) return;

        const parsedData = JSON.parse(savedData);

        this.playlists = parsedData.map((pData) => {
            const musics = pData.musics.map(
                (mData) =>
                    // O audioBuffer começa como null ao recarregar a página
                    new Music(
                        mData.name,
                        mData.artist,
                        mData.image,
                        null,
                        mData.duration,
                        mData.id,
                        mData.playlistId,
                    ),
            );

            const playlist = new Playlist(pData.name, musics, pData.id);
            playlist.size = pData.size;
            return playlist;
        });
    }

    static removeMusic(playlistId, musicId) {
        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) return null;

        // Remove a música filtrando o array pelo ID
        playlist.musics = playlist.musics.filter((m) => m.id != musicId);
        playlist.size = playlist.musics.length;

        // Salva a lista atualizada no LocalStorage
        this.savePlaylistsData();

        return playlist;
    }
}
