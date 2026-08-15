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

    // Gera um ID único e estável. Antes era "this.playlists.length" /
    // "playlist.musics.length", o que causava colisão de IDs assim que um
    // item era removido do meio da lista (o próximo item criado reutilizava
    // um ID já existente). Isso confundia getMusicByID e, mais grave, a
    // chave usada no IndexedDB ("${playlistId}_${musicId}"), fazendo o
    // áudio de uma música ser lido/sobrescrito no lugar de outra.
    static generateId() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback simples para ambientes sem crypto.randomUUID
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
            this.generateId(),
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
            this.generateId(),
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

    // Só aceita o alfabeto do base64. Bytes crus de imagem (formato antigo,
    // de antes desta correção) quase sempre têm bytes fora desse conjunto,
    // então esse teste é confiável na prática pra distinguir os dois casos.
    static #BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

    // Músicas salvas ANTES desta correção guardavam a capa do álbum como
    // bytes crus (não em base64). O código de renderização agora espera
    // sempre base64, então dados antigos precisam ser convertidos uma vez
    // ao carregar — sem isso, os bytes crus quebram o HTML gerado pela
    // lista de músicas (é a causa dos "códigos estranhos" no lugar do
    // nome/artista/capa).
    static #migrateImageToBase64(image) {
        if (!image) return image;
        if (this.#BASE64_PATTERN.test(image)) return image; // já está ok

        try {
            return window.btoa(image);
        } catch (error) {
            console.error(
                "Não foi possível migrar a capa de uma música salva (formato antigo):",
                error,
            );
            return null;
        }
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

        try {
            localStorage.setItem(
                "MusicPlayer_Playlists",
                JSON.stringify(dataToSave),
            );
        } catch (error) {
            // Pode estourar a cota do localStorage (ex: muitas capas de
            // álbum grandes). Melhor avisar no console do que quebrar o
            // fluxo de criar/adicionar música em silêncio.
            console.error("Não foi possível salvar as playlists no localStorage:", error);
        }
    }

    static loadPlaylistsData() {
        let savedData;

        try {
            savedData = localStorage.getItem("MusicPlayer_Playlists");
        } catch (error) {
            console.error("Não foi possível ler as playlists do localStorage:", error);
            return;
        }

        if (!savedData) return;

        let parsedData;
        try {
            parsedData = JSON.parse(savedData);
        } catch (error) {
            console.error("Dados de playlists corrompidos no localStorage:", error);
            return;
        }

        let neededMigration = false;

        this.playlists = parsedData.map((pData) => {
            const musics = pData.musics.map((mData) => {
                const migratedImage = this.#migrateImageToBase64(mData.image);
                if (migratedImage !== mData.image) neededMigration = true;

                // O audioBuffer começa como null ao recarregar a página
                return new Music(
                    mData.name,
                    mData.artist,
                    migratedImage,
                    null,
                    mData.duration,
                    mData.id,
                    mData.playlistId,
                );
            });

            const playlist = new Playlist(pData.name, musics, pData.id);
            playlist.size = pData.size;
            return playlist;
        });

        // Persiste a versão já migrada, pra essa conversão não precisar
        // rodar de novo a cada carregamento da página.
        if (neededMigration) this.savePlaylistsData();
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
