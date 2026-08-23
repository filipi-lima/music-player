import Music from "./classes/Music.js";
import Playlist from "./classes/Playlist.js";
import decodeImage from "./utils/decodeImage.js";
import { generatePlaylistCover } from "./utils/generatePlaylistImage.js";
import { saveAudioFile, getAudioFile, deleteAudioFile } from "./utils/storage.js";

const jsmediatags = window.jsmediatags;

const PLAYER_LAYOUT = document.querySelector(".player-layout");

// Botões do Player
const PLAYER_BTN = document.querySelector("#btn-player");
const PAUSE_BTN = document.querySelector("#btn-pause");
const BTN_PREV = document.querySelector("#btn-prev");
const BTN_NEXT = document.querySelector("#btn-next");

// Criar Playlist
const CREATE_PLAYLIST_BTN = document.querySelector("#create-playlist");
const CREATE_PLAYLIST_FORM = document.querySelector("#create-playlist-form");
const CREATE_PLAYLIST_SUBMIT = document.querySelector(
    "#create-playlist-submit",
);
const CREATE_PLAYLIST_CANCEL = document.querySelector(
    "#create-playlist-cancel",
);
const PLAYLIST_NAME_INPUT = document.querySelector("#playlist-name__input");
const PLAYLISTS_GRID = document.querySelector(".playlists-grid");

// Adicionar Música
const ADD_MUSIC_FORM = document.querySelector("#add-music-form");
const ADD_MUSIC_SUBMIT = document.querySelector("#add-music-submit");
const ADD_MUSIC_CANCEL = document.querySelector("#add-music-cancel");
const FILE_INPUT = document.querySelector("#file");

// Pré-visualização da Música
const LABEL = document.querySelector(".file-input");
const MUSIC_VIEW = document.querySelector("#music__view");
const IMAGE_VIEW = document.querySelector(".image__view");
const MUSIC_NAME_VIEW = document.querySelector(".music-name__view");
const ARTIST_NAME_VIEW = document.querySelector(".artist-name__view");

// Containers de Músicas e Playlists
const MUSIC_LIST = document.querySelector("#music-list");
const PLAYLIST_NAME_TITLE = document.querySelector(".playlist-title");

// Informações do Card Principal
const CARD_MUSIC_IMAGE = document.querySelector("#music-image");
const CARD_MUSIC_NAME = document.querySelector("#music-name");
const CARD_ARTIST_NAME = document.querySelector("#artist-name");

// Informações da Barra Inferior (Dock)
const DOCK_MUSIC_IMAGE = document.querySelector(".dock-img");
const DOCK_MUSIC_NAME =
    document.querySelector(".dock-music__name") ||
    document.querySelector(".current-music-dock .list-music__name");
const DOCK_ARTIST_NAME =
    document.querySelector(".dock-music__artist") ||
    document.querySelector(".current-music-dock .list-music__artist");

// Informações da Barra de Progresso
const PROGRESS_BAR = document.querySelector("#progress-bar");
const CURRENT_TIME = document.querySelector("#current-time");
const MUSIC_TIME = document.querySelector("#music-time");

// Botões de random e repeat
const PLAYLIST_TOOLS_BTN = document.querySelectorAll(".playlist-tools");
const BTN_RANDOM_PLAYER = document.querySelector("#random-player");
const BTN_REPEAT_PLAYER = document.querySelector("#repeat-player");

const PLACEHOLDER_IMAGE = "url(./assets/images/molde.png)";

let currentPlaylist = null;
let currentMusic = null;
let selectedPlaylistForAdd = null;
let animationFrameId = null;
let isRandomPlayer = false;
let isRepeatPlayer = false;

let rawArrayBuffer = null;
let musicImageData = null;
let uploadedMusicName = "";
let uploadedArtistName = "";

// Usado para descartar respostas assíncronas "atrasadas" de uma seleção de
// arquivo que já foi substituída por outra (ver FILE_INPUT change listener).
let uploadToken = 0;

// Carrega tudo salvo ao abrir o site
window.addEventListener("DOMContentLoaded", () => {
    Playlist.loadPlaylistsData(); // Puxa os dados do localStorage

    // Playlists criadas antes dessa funcionalidade existir não têm capa
    // salva. Gera uma pra cada uma agora, uma única vez, e persiste — assim
    // toda playlist (antiga ou nova) fica com uma capa estável, em vez de
    // regenerar (e mudar) a cada carregamento da página.
    let generatedMissingCover = false;
    Playlist.playlists.forEach((playlist) => {
        if (!playlist.image) {
            playlist.image = generatePlaylistCover();
            generatedMissingCover = true;
        }
    });
    if (generatedMissingCover) Playlist.savePlaylistsData();

    // Desenha as playlists recuperadas
    Playlist.playlists.forEach((playlist) => {
        renderNewPlaylist(playlist);
    });

    if (Playlist.playlists.length > 0) {
        currentPlaylist = Playlist.playlists[0];
        PLAYLIST_NAME_TITLE.innerHTML = currentPlaylist.name;
        renderMusicList(currentPlaylist.musics);
    }
});

// Dispara quando uma música termina SOZINHA (evento nativo do Web Audio
// API). Continua funcionando com a aba em segundo plano, diferente da
// lógica antiga baseada em requestAnimationFrame.
Music.onTrackEnded = (finishedMusic) => {
    let nextMusic;

    if (isRandomPlayer) {
        nextMusic = Music.getRandomMusic(finishedMusic);
    } else if (isRepeatPlayer) {
        nextMusic = finishedMusic;
    } else {
        nextMusic = Music.nextMusic(finishedMusic);
    }

    if (nextMusic) {
        switchToMusic(nextMusic);
    } else {
        resetProgressBar();
        Music.unloadAudioBuffer(finishedMusic);
        PLAYER_BTN.style.display = "flex";
        PAUSE_BTN.style.display = "none";
    }
};

const renderNewPlaylist = (playlist) => {
    const coverImage = playlist.image
        ? decodeImage("image/png", playlist.image)
        : PLACEHOLDER_IMAGE;

    const html = `
    <div class="playlist-card-item" data-id="${playlist.id}">
        <div class="playlist-card-img" style="background-image: ${coverImage}"></div>
        <div class="playlist-card-info">
            <p class="playlist-name-text">${playlist.name}</p>
            <p class="musics-number-text">${playlist.size === 1 ? "1 Música" : playlist.size + " Músicas"}</p>
        </div>
        <button class="add-music-btn" title="Adicionar música">
            <i class="fa-solid fa-plus"></i>
        </button>
        <button class="delete-playlist-btn" title="Excluir playlist">
            <i class="fa-solid fa-minus"></i>
        </button>
    </div>`;

    PLAYLISTS_GRID.insertAdjacentHTML("beforeend", html);
};

const renderMusicList = (musics) => {
    if (!musics || musics.length === 0) {
        MUSIC_LIST.innerHTML = `<span style="font-size: 14px; color: var(--text-muted, #a0a0ab); padding: 10px;">Nenhuma música encontrada</span>`;
        return;
    }

    const html = musics
        .map(
            (music) => `
        <div class="music-item" data-id="${music.id}">
            <div class="music-item-content">
                <div class="music-item-img" style="background-image: ${decodeImage("image/jpg", music.image)}">
                    <img src="./assets/images/sound-wave.gif" class="sound-wave-icon">
                </div>
                <div class="music-item-details">
                    <p class="list-music__name">${music.name}</p>
                    <p class="list-music__artist">${music.artist}</p>
                </div>
            </div>

            <button class="remove-music-btn" title="Remover desta Playlist">
                <i class="fa-solid fa-minus"></i>
            </button>
        </div>
    `,
        )
        .join("");

    MUSIC_LIST.innerHTML = html;
};

const updatePlaylistCardInfo = (playlist) => {
    const card = PLAYLISTS_GRID.querySelector(
        `.playlist-card-item[data-id="${playlist.id}"]`,
    );
    if (card) {
        const textElement = card.querySelector(".musics-number-text");
        if (textElement) {
            textElement.textContent = `${playlist.size} ${playlist.size === 1 ? "Música" : "Músicas"}`;
        }
    }
};

const updateCurrentMusicUI = () => {
    if (!currentMusic) return;

    // A imagem já vem em base64 (convertida uma única vez no upload), então
    // não precisamos mais rodar window.btoa() toda vez que a UI atualiza.
    const bgImage = `url(data:image/jpg;base64,${currentMusic.image})`;
    const srcImage = `data:image/jpg;base64,${currentMusic.image}`;

    CARD_MUSIC_IMAGE.style.backgroundImage = bgImage;
    if (CARD_MUSIC_IMAGE.tagName === "IMG") CARD_MUSIC_IMAGE.src = srcImage;

    CARD_MUSIC_NAME.innerHTML = currentMusic.name;
    CARD_ARTIST_NAME.innerHTML = currentMusic.artist;

    if (DOCK_MUSIC_IMAGE) {
        DOCK_MUSIC_IMAGE.style.backgroundImage = bgImage;
        if (DOCK_MUSIC_IMAGE.tagName === "IMG") DOCK_MUSIC_IMAGE.src = srcImage;
    }

    if (DOCK_MUSIC_NAME) DOCK_MUSIC_NAME.innerHTML = currentMusic.name;
    if (DOCK_ARTIST_NAME) DOCK_ARTIST_NAME.innerHTML = currentMusic.artist;

    MUSIC_TIME.innerHTML = currentMusic.duration;
    selectActiveMusicElement();
};

// Usado quando não há mais nenhuma música "atual" (ex: playlist esvaziada).
const resetCurrentMusicUI = () => {
    CARD_MUSIC_IMAGE.style.backgroundImage = PLACEHOLDER_IMAGE;
    if (CARD_MUSIC_IMAGE.tagName === "IMG") CARD_MUSIC_IMAGE.src = "./assets/images/molde.png";
    CARD_MUSIC_NAME.innerHTML = "Nome da Música";
    CARD_ARTIST_NAME.innerHTML = "Nome do Artista";
    MUSIC_TIME.innerHTML = "00:00";

    if (DOCK_MUSIC_IMAGE) DOCK_MUSIC_IMAGE.style.backgroundImage = PLACEHOLDER_IMAGE;
    if (DOCK_MUSIC_NAME) DOCK_MUSIC_NAME.innerHTML = "";
    if (DOCK_ARTIST_NAME) DOCK_ARTIST_NAME.innerHTML = "";

    resetProgressBar();
    PLAYER_BTN.style.display = "flex";
    PAUSE_BTN.style.display = "none";
};

// Exclui uma playlist por completo: apaga o áudio de cada música dela no
// IndexedDB (senão fica "lixo" ocupando espaço pra sempre), para o player
// se a música tocando era dessa playlist, e atualiza a barra lateral e a
// seção principal.
const deletePlaylist = async (playlist) => {
    for (const music of playlist.musics) {
        const key = `${playlist.id}_${music.id}`;
        try {
            await deleteAudioFile(key);
        } catch (error) {
            console.error(
                `Não foi possível apagar o áudio da música "${music.name}":`,
                error,
            );
        }
    }

    if (currentMusic && currentMusic.playlistId == playlist.id) {
        Music.stopMusic();
        Music.unloadAudioBuffer(currentMusic);
        currentMusic = null;
        resetCurrentMusicUI();
    }

    if (selectedPlaylistForAdd && selectedPlaylistForAdd.id == playlist.id) {
        selectedPlaylistForAdd = null;
        if (ADD_MUSIC_FORM.style.display === "block") {
            ADD_MUSIC_CANCEL.click();
        }
    }

    Playlist.removePlaylist(playlist.id);

    const card = PLAYLISTS_GRID.querySelector(
        `.playlist-card-item[data-id="${playlist.id}"]`,
    );
    if (card) card.remove();

    if (currentPlaylist && currentPlaylist.id == playlist.id) {
        currentPlaylist = Playlist.playlists[0] || null;

        if (currentPlaylist) {
            PLAYLIST_NAME_TITLE.innerHTML = currentPlaylist.name;
            renderMusicList(currentPlaylist.musics);

            const newCard = PLAYLISTS_GRID.querySelector(
                `.playlist-card-item[data-id="${currentPlaylist.id}"]`,
            );
            if (newCard) newCard.classList.add("select");
        } else {
            PLAYLIST_NAME_TITLE.innerHTML = "Selecione uma Playlist";
            renderMusicList([]);
        }
    }
};

const selectActiveMusicElement = () => {
    if (!MUSIC_LIST || !currentMusic || !currentPlaylist) return;
    if (currentPlaylist.id != currentMusic.playlistId) return;

    MUSIC_LIST.querySelectorAll(".music-item").forEach((element) => {
        element.classList.remove("select");
        element.querySelector(".sound-wave-icon").style.display = "none"
        if (element.getAttribute("data-id") == currentMusic.id) {
            element.classList.add("select");
            element.querySelector(".sound-wave-icon").style.display = "block"
        }
    });
};

// Atualiza SÓ a barra de progresso / relógio. A troca de música ao terminar
// uma faixa não depende mais daqui — fica a cargo de Music.onTrackEnded,
// que usa o evento nativo "onended" do Web Audio API e por isso continua
// funcionando com a aba em segundo plano (requestAnimationFrame é pausado
// pelo navegador nesse cenário, então não pode ser o gatilho da troca).
const updateProgressBar = () => {
    if (!Music.isPlaying || !currentMusic || !currentMusic.audioBuffer) return;

    const duration = currentMusic.audioBuffer.duration;
    const currentTime = Math.min(Music.getCurrentTime(), duration);
    const progressPercent = Math.min((currentTime / duration) * 100, 100);

    PROGRESS_BAR.style.width = `${progressPercent}%`;
    CURRENT_TIME.innerHTML = Music.getDurationMusic(currentTime);

    animationFrameId = requestAnimationFrame(updateProgressBar);
};

// Ponto único de troca de música: para o que estava tocando, libera o
// AudioBuffer da música anterior da memória (é a causa do consumo de
// memória crescer com o tempo de uso), atualiza a UI e toca a nova.
const switchToMusic = (newMusic) => {
    if (!newMusic) return;

    const previousMusic = currentMusic;

    Music.stopMusic();
    resetProgressBar();

    if (previousMusic && previousMusic.id !== newMusic.id) {
        Music.unloadAudioBuffer(previousMusic);
    }

    currentMusic = newMusic;
    updateCurrentMusicUI();
    loadAndPlayMusic(currentMusic);
};

const loadAndPlayMusic = async (music) => {
    if (!music.audioBuffer) {
        // Se recarregou a página (ou o buffer foi liberado da memória), a
        // música não tem o buffer ainda. Puxamos do IndexedDB.
        try {
            const key = `${music.playlistId}_${music.id}`;
            const arrayBuffer = await getAudioFile(key);

            if (arrayBuffer) {
                music.audioBuffer =
                    await Music.audioContext.decodeAudioData(arrayBuffer);
            } else {
                alert(
                    "Erro: Arquivo de áudio não encontrado no banco de dados.",
                );
                return;
            }
        } catch (error) {
            console.error("Erro ao carregar o áudio do IndexedDB:", error);
            return;
        }
    }

    // A música pode ter sido trocada de novo enquanto aguardávamos o
    // IndexedDB/decode acima — se não é mais a atual, não inicia a
    // reprodução por cima da que já está tocando.
    if (currentMusic !== music) return;

    PLAYER_BTN.style.display = "none";
    PAUSE_BTN.style.display = "flex";

    Music.playMusic(music);
    animationFrameId = requestAnimationFrame(updateProgressBar);
};

const playCurrentMusic = () => {
    if (!currentMusic || Music.isPlaying) return;
    loadAndPlayMusic(currentMusic);
};

const pauseCurrentMusic = () => {
    PLAYER_BTN.style.display = "flex";
    PAUSE_BTN.style.display = "none";

    Music.pauseMusic();
    cancelAnimationFrame(animationFrameId);
};

const resetProgressBar = () => {
    PROGRESS_BAR.style.width = "0%";
    CURRENT_TIME.innerHTML = "00:00";
    cancelAnimationFrame(animationFrameId);
};

async function getRawArrayBuffer(file) {
    return await new Promise((resolve, reject) => {
        const FILE_READER = new FileReader();
        FILE_READER.onload = (evento) => resolve(evento.target.result);
        FILE_READER.onerror = (erro) => reject(erro);
        FILE_READER.readAsArrayBuffer(file);
    });
}

// Converte bytes crus (ex: capa de álbum extraída pelo jsmediatags) para
// base64 em pedaços, em vez de concatenar caractere por caractere — bem
// mais rápido/leve pra imagens grandes, e evita manter a string binária
// crua (2 bytes por caractere em JS) na memória e no localStorage.
function bytesToBase64(bytes) {
    const CHUNK_SIZE = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + CHUNK_SIZE),
        );
    }
    return window.btoa(binary);
}

CREATE_PLAYLIST_BTN.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    CREATE_PLAYLIST_FORM.style.display = "block";
    document.body.style.overflowY = "hidden";
    PLAYER_LAYOUT.style.filter = "blur(10px)";
});

CREATE_PLAYLIST_CANCEL.addEventListener("click", () => {
    CREATE_PLAYLIST_FORM.style.display = "none";
    document.body.style.overflowY = "auto";
    PLAYER_LAYOUT.style.filter = "blur(0px)";
    PLAYLIST_NAME_INPUT.value = "";
});

CREATE_PLAYLIST_SUBMIT.addEventListener("click", (event) => {
    event.preventDefault();
    const name = PLAYLIST_NAME_INPUT.value.trim();
    if (!name) return;

    try {
        const coverImage = generatePlaylistCover();
        const newPlaylist = Playlist.createPlaylist(name, coverImage);
        renderNewPlaylist(newPlaylist);

        if (!currentPlaylist) {
            currentPlaylist = newPlaylist;
            PLAYLIST_NAME_TITLE.innerHTML = newPlaylist.name;
            renderMusicList(newPlaylist.musics);
        }

        CREATE_PLAYLIST_FORM.style.display = "none";
        document.body.style.overflowY = "auto";
        PLAYER_LAYOUT.style.filter = "blur(0px)";
        PLAYLIST_NAME_INPUT.value = "";
    } catch (err) {
        alert(err.message);
    }
});

PLAYLISTS_GRID.addEventListener("click", async (event) => {
    const card = event.target.closest(".playlist-card-item");
    if (!card) return;

    const playlistId = card.getAttribute("data-id");
    const targetPlaylist = Playlist.getPlaylistById(playlistId);

    if (event.target.closest(".add-music-btn")) {
        event.stopPropagation();
        selectedPlaylistForAdd = targetPlaylist;

        window.scrollTo({ top: 0, behavior: "smooth" });
        ADD_MUSIC_FORM.style.display = "block";
        document.body.style.overflowY = "hidden";
        PLAYER_LAYOUT.style.filter = "blur(10px)";
        return;
    }

    if (event.target.closest(".delete-playlist-btn")) {
        event.stopPropagation();
        if (!targetPlaylist) return;

        const confirmDelete = confirm(
            `Tem certeza que deseja excluir a playlist "${targetPlaylist.name}"?\nEssa ação não pode ser desfeita.`,
        );
        if (!confirmDelete) return;

        await deletePlaylist(targetPlaylist);
        return;
    }

    if (targetPlaylist) {
        const allCards = PLAYLISTS_GRID.querySelectorAll(".playlist-card-item");
        allCards.forEach((c) => c.classList.remove("select"));
        card.classList.add("select");

        currentPlaylist = targetPlaylist;
        PLAYLIST_NAME_TITLE.innerHTML = targetPlaylist.name;
        renderMusicList(targetPlaylist.musics);
        selectActiveMusicElement();
    }
});

MUSIC_LIST.addEventListener("click", async (event) => {
    const musicItem = event.target.closest(".music-item");
    if (!musicItem || !currentPlaylist) return;

    const deleteBtn = event.target.closest(".remove-music-btn");

    if (deleteBtn) {
        event.stopPropagation();
        const musicId = musicItem.getAttribute("data-id");

        const isDeletingCurrentMusic =
            currentMusic &&
            currentMusic.id == musicId &&
            currentMusic.playlistId == currentPlaylist.id;

        // Só faz sentido calcular/trocar a música "atual" se a música
        // removida for justamente a que está tocando/selecionada. Antes o
        // código reatribuía currentMusic a uma música aleatória mesmo ao
        // apagar uma música qualquer, fazendo a UI mostrar informações de
        // uma música diferente da que continuava tocando.
        let replacementMusic = null;

        if (isDeletingCurrentMusic) {
            replacementMusic = isRandomPlayer
                ? Music.getRandomMusic(currentMusic)
                : Music.nextMusic(currentMusic);

            // Playlist só tinha essa música: não há substituto.
            if (replacementMusic && replacementMusic.id == musicId) {
                replacementMusic = null;
            }

            Music.stopMusic();
            Music.unloadAudioBuffer(currentMusic);
            currentMusic = null;
        }

        const key = `${currentPlaylist.id}_${musicId}`;
        await deleteAudioFile(key);

        Playlist.removeMusic(currentPlaylist.id, musicId);

        renderMusicList(currentPlaylist.musics);
        updatePlaylistCardInfo(currentPlaylist);

        if (isDeletingCurrentMusic) {
            if (replacementMusic) {
                currentMusic = replacementMusic;
                updateCurrentMusicUI();
            } else {
                resetCurrentMusicUI();
            }
        }

        return;
    }

    const musicId = musicItem.getAttribute("data-id");
    const selectedMusic = Music.getMusicByID(currentPlaylist.id, musicId);

    if (selectedMusic) {
        switchToMusic(selectedMusic);
    }
});

ADD_MUSIC_CANCEL.addEventListener("click", () => {
    ADD_MUSIC_FORM.style.display = "none";
    document.body.style.overflowY = "auto";
    PLAYER_LAYOUT.style.filter = "blur(0px)";
    if (LABEL) LABEL.style.display = "grid";
    if (MUSIC_VIEW) MUSIC_VIEW.style.display = "none";
    IMAGE_VIEW.style.backgroundImage = PLACEHOLDER_IMAGE;
    MUSIC_NAME_VIEW.innerHTML = "";
    ARTIST_NAME_VIEW.innerHTML = "";
    FILE_INPUT.value = "";

    // Invalida qualquer leitura de tags ainda em andamento pra essa sessão
    // do formulário, pra ela não "aparecer" mais tarde e preencher campos
    // de um upload que o usuário já cancelou/fechou.
    uploadToken++;

    uploadedMusicName = "";
    uploadedArtistName = "";
    rawArrayBuffer = null;
    musicImageData = null;
});

FILE_INPUT.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Identifica esta seleção específica. Se o usuário trocar de arquivo
    // antes da leitura (FileReader/jsmediatags) do anterior terminar, o
    // resultado atrasado do arquivo antigo é descartado em vez de
    // sobrescrever os dados do arquivo novo — essa condição de corrida era
    // a causa da música tocar com nome/artista/capa de OUTRA música.
    const thisUploadToken = ++uploadToken;

    const bufferForThisFile = await getRawArrayBuffer(file);
    if (thisUploadToken !== uploadToken) return; // seleção já foi trocada
    rawArrayBuffer = bufferForThisFile;

    const applyMetadata = (name, artist, imageBase64, imageFormat) => {
        if (thisUploadToken !== uploadToken) return; // seleção já foi trocada

        uploadedMusicName = name;
        uploadedArtistName = artist;
        musicImageData = imageBase64;

        MUSIC_NAME_VIEW.innerHTML = uploadedMusicName;
        ARTIST_NAME_VIEW.innerHTML = uploadedArtistName;
        IMAGE_VIEW.style.backgroundImage = imageBase64
            ? `url(data:${imageFormat};base64,${imageBase64})`
            : PLACEHOLDER_IMAGE;

        if (LABEL) LABEL.style.display = "none";
        if (MUSIC_VIEW) MUSIC_VIEW.style.display = "flex";
    };

    jsmediatags.read(file, {
        onSuccess: (tag) => {
            const tags = tag.tags;
            const name = tags.title || file.name.replace(/\.[^/.]+$/, "");
            const artist = tags.artist || "Artista Desconhecido";

            let imageBase64 = null;
            let imageFormat = null;

            if (tags.picture) {
                imageFormat = tags.picture.format;
                imageBase64 = bytesToBase64(new Uint8Array(tags.picture.data));
            }

            applyMetadata(name, artist, imageBase64, imageFormat);
        },
        onError: () => {
            const name = file.name.replace(/\.[^/.]+$/, "");
            applyMetadata(name, "Artista Desconhecido", null, null);
        },
    });
});

if (LABEL) {
    const onEnter = () => LABEL.classList.add("active");
    const onLeave = () => LABEL.classList.remove("active");

    LABEL.addEventListener("dragenter", onEnter);
    LABEL.addEventListener("dragend", onLeave);
    LABEL.addEventListener("dragleave", onLeave);
    LABEL.addEventListener("drop", () => {
        onLeave();
        LABEL.style.display = "none";
        if (MUSIC_VIEW) MUSIC_VIEW.style.display = "flex";
    });
}

ADD_MUSIC_SUBMIT.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!selectedPlaylistForAdd || !rawArrayBuffer) return;

    try {
        const decodedAudioBuffer = await Music.audioContext.decodeAudioData(
            rawArrayBuffer.slice(0),
        );

        const updatedPlaylist = Playlist.addMusic(
            uploadedMusicName,
            uploadedArtistName,
            musicImageData,
            decodedAudioBuffer,
            selectedPlaylistForAdd.id,
        );

        if (!updatedPlaylist) {
            alert("Essa playlist não existe mais.");
            ADD_MUSIC_CANCEL.click();
            return;
        }

        const newMusic = updatedPlaylist.musics[updatedPlaylist.musics.length - 1];

        // SALVA NO INDEXEDDB! Chave única baseada no ID da playlist e da música
        const key = `${selectedPlaylistForAdd.id}_${newMusic.id}`;
        await saveAudioFile(key, rawArrayBuffer.slice(0));

        updatePlaylistCardInfo(selectedPlaylistForAdd);

        if (
            currentPlaylist &&
            currentPlaylist.id === selectedPlaylistForAdd.id
        ) {
            renderMusicList(currentPlaylist.musics);
            selectActiveMusicElement();
        }

        ADD_MUSIC_CANCEL.click();
    } catch (error) {
        console.error("Erro ao processar e salvar a música: ", error);
        alert("Não foi possível salvar o áudio desta música.");
    }
});

// Botões de controle de música
PLAYER_BTN.addEventListener("click", () => {
    playCurrentMusic();
});

PAUSE_BTN.addEventListener("click", () => {
    if (currentMusic) pauseCurrentMusic();
});

BTN_NEXT.addEventListener("click", () => {
    if (!currentMusic) return;

    const nextMusic = isRandomPlayer
        ? Music.getRandomMusic(currentMusic)
        : Music.nextMusic(currentMusic);

    switchToMusic(nextMusic);
});

BTN_PREV.addEventListener("click", () => {
    if (!currentMusic) return;

    const prevMusic = Music.prevMusic(currentMusic);

    switchToMusic(prevMusic);
});

PLAYLIST_TOOLS_BTN.forEach((tool) => {
    tool.addEventListener("click", ({ target }) => {
        const BUTTON = target.closest(".tool-btn");

        if (BUTTON == BTN_RANDOM_PLAYER) {
            if (!isRandomPlayer) {
                BTN_RANDOM_PLAYER.classList.add("active");
                BTN_RANDOM_PLAYER.setAttribute(
                    "title",
                    "Desativar ordem aleatoria",
                );
                BTN_REPEAT_PLAYER.classList.remove("active");
                BTN_REPEAT_PLAYER.setAttribute("title", "Ativar repetição");
                isRandomPlayer = true;
                isRepeatPlayer = false;
            } else {
                BTN_RANDOM_PLAYER.classList.remove("active");
                BTN_RANDOM_PLAYER.setAttribute(
                    "title",
                    "Ativar ordem aleatoria",
                );
                isRandomPlayer = false;
            }
        } else {
            if (!isRepeatPlayer) {
                BTN_REPEAT_PLAYER.classList.add("active");
                BTN_REPEAT_PLAYER.setAttribute("title", "Desativar repetição");
                BTN_RANDOM_PLAYER.classList.remove("active");
                BTN_RANDOM_PLAYER.setAttribute(
                    "title",
                    "Ativar ordem aleatoria",
                );
                isRepeatPlayer = true;
                isRandomPlayer = false;
            } else {
                BTN_REPEAT_PLAYER.classList.remove("active");
                BTN_REPEAT_PLAYER.setAttribute("title", "Ativar repetição");
                isRepeatPlayer = false;
            }
        }
    });
});
