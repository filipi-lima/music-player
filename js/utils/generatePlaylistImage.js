const SIZE = 200;

const PALETTES = [
    ["#560a9d", "#190532"], 
    ["#8a2be2", "#2a0e4d"], 
    ["#bc2fd5", "#590867"], 
    ["#a967e8", "#351d53"]
];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const pickPalette = () => PALETTES[Math.floor(Math.random() * PALETTES.length)];

// Retorna a imagem já em base64 (sem o prefixo "data:image/png;base64,"),
// no mesmo formato usado pelas capas de música (ver decodeImage.js).
export function generatePlaylistCover() {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    const [colorStart, colorEnd] = pickPalette();

    // Fundo em gradiente linear, com ângulo aleatório pra cada playlist.
    const angle = randomBetween(0, Math.PI * 2);
    const x1 = SIZE / 2 + Math.cos(angle) * SIZE;
    const y1 = SIZE / 2 + Math.sin(angle) * SIZE;
    const x2 = SIZE / 2 - Math.cos(angle) * SIZE;
    const y2 = SIZE / 2 - Math.sin(angle) * SIZE;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const shapeCount = Math.round(randomBetween(3, 6));
    for (let i = 0; i < shapeCount; i++) {
        const radius = randomBetween(SIZE * 0.15, SIZE * 0.35);
        const cx = randomBetween(0, SIZE);
        const cy = randomBetween(0, SIZE);
        const opacity = randomBetween(0.05, 0.14);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity.toFixed(2)})`;
        ctx.fill();
    }

    return canvas.toDataURL("image/png").split(",")[1];
}
