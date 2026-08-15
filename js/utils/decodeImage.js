// "code" já deve vir em base64 (ver bytesToBase64 em main.js). Antes essa
// função chamava window.btoa(code) toda vez que uma capa de álbum era
// renderizada (lista de músicas, player atual, dock...), reprocessando a
// mesma imagem repetidas vezes. Agora a conversão acontece uma única vez,
// no momento do upload.
const decodeImage = (format, code) => {
    return `url(data:${format};base64,${code})`;
};

export default decodeImage;
