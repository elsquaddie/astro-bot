/**
 * Procedural planet textures generated via Canvas.
 * Low-res (128-256px) for PS1 aesthetic — no external files needed.
 */
import * as THREE from 'three';

const TEX_SIZE = 256;
const loader = new THREE.TextureLoader();

function createCanvas(w = TEX_SIZE, h = TEX_SIZE / 2) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function noise(ctx, w, h, alpha = 0.05) {
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 255 * alpha;
        id.data[i] += n;
        id.data[i + 1] += n;
        id.data[i + 2] += n;
    }
    ctx.putImageData(id, 0, 0);
}

/** Brighten entire canvas by a factor (1.0 = no change, 1.5 = 50% brighter) */
function brighten(ctx, w, h, factor = 1.3) {
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = Math.min(255, id.data[i] * factor);
        id.data[i + 1] = Math.min(255, id.data[i + 1] * factor);
        id.data[i + 2] = Math.min(255, id.data[i + 2] * factor);
    }
    ctx.putImageData(id, 0, 0);
}

function canvasToTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
}

// ---- Sun ----
export function sunTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    // Radial gradient
    const grad = ctx.createRadialGradient(128, 64, 10, 128, 64, 128);
    grad.addColorStop(0, '#ffffcc');
    grad.addColorStop(0.3, '#ffaa00');
    grad.addColorStop(0.7, '#ff6600');
    grad.addColorStop(1, '#cc3300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE / 2);
    // Granulation spots
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * TEX_SIZE;
        const y = Math.random() * TEX_SIZE / 2;
        const r = 1 + Math.random() * 4;
        ctx.fillStyle = `rgba(${180 + Math.random() * 75}, ${80 + Math.random() * 60}, 0, 0.3)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    noise(ctx, TEX_SIZE, TEX_SIZE / 2, 0.08);
    brighten(ctx, TEX_SIZE, TEX_SIZE / 2, 1.3);
    return canvasToTexture(c);
}

// ---- Earth ----
export function earthTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // Ocean base
    ctx.fillStyle = '#2255aa';
    ctx.fillRect(0, 0, w, h);

    // Simple continents (approximate shapes)
    ctx.fillStyle = '#3a8a3a';
    // Eurasia
    drawBlob(ctx, 150, 30, 60, 25);
    drawBlob(ctx, 180, 40, 40, 15);
    // Africa
    drawBlob(ctx, 145, 55, 20, 30);
    // Americas
    drawBlob(ctx, 55, 30, 15, 20);
    drawBlob(ctx, 60, 55, 20, 35);
    drawBlob(ctx, 45, 35, 12, 15);
    // Australia
    drawBlob(ctx, 210, 72, 18, 12);
    // Antarctica
    ctx.fillStyle = '#ccddee';
    drawBlob(ctx, 128, 120, 100, 12);

    // Polar ice
    ctx.fillStyle = '#ddeeff';
    drawBlob(ctx, 128, 3, 120, 8);

    // Desert regions
    ctx.fillStyle = '#8a7a40';
    drawBlob(ctx, 145, 45, 25, 8);
    drawBlob(ctx, 170, 42, 15, 6);

    noise(ctx, w, h, 0.06);
    brighten(ctx, w, h, 1.4);
    return canvasToTexture(c);
}

// ---- Moon ----
export function moonTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, w, h);

    // Dark maria
    ctx.fillStyle = '#555555';
    drawBlob(ctx, 60, 40, 30, 25);   // Mare Imbrium
    drawBlob(ctx, 90, 55, 25, 20);   // Mare Serenitatis
    drawBlob(ctx, 110, 65, 35, 25);  // Mare Tranquillitatis
    drawBlob(ctx, 70, 70, 20, 15);   // Oceanus Procellarum

    // Craters
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 1 + Math.random() * 4;
        const shade = 100 + Math.floor(Math.random() * 50);
        ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    noise(ctx, w, h, 0.08);
    brighten(ctx, w, h, 1.5);
    return canvasToTexture(c);
}

// ---- Mercury ----
export function mercuryTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, w, h);

    // Heavy cratering
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 1 + Math.random() * 6;
        const shade = 70 + Math.floor(Math.random() * 60);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    noise(ctx, w, h, 0.1);
    brighten(ctx, w, h, 1.5);
    return canvasToTexture(c);
}

// ---- Venus ----
export function venusTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // Thick atmosphere - yellowish cloud bands
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#c4a050');
    grad.addColorStop(0.3, '#d4b060');
    grad.addColorStop(0.5, '#c49a48');
    grad.addColorStop(0.7, '#d4aa58');
    grad.addColorStop(1, '#b49040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Horizontal cloud bands
    for (let y = 0; y < h; y += 3) {
        const alpha = 0.05 + Math.random() * 0.1;
        ctx.fillStyle = `rgba(200, 180, 100, ${alpha})`;
        ctx.fillRect(0, y, w, 2);
    }

    noise(ctx, w, h, 0.06);
    brighten(ctx, w, h, 1.3);
    return canvasToTexture(c);
}

// ---- Mars ----
export function marsTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#b44a20';
    ctx.fillRect(0, 0, w, h);

    // Dark regions (Syrtis Major etc)
    ctx.fillStyle = '#7a3015';
    drawBlob(ctx, 100, 50, 30, 20);
    drawBlob(ctx, 60, 55, 25, 15);
    drawBlob(ctx, 180, 45, 20, 18);

    // Lighter highlands
    ctx.fillStyle = '#cc6a35';
    drawBlob(ctx, 40, 35, 35, 20);
    drawBlob(ctx, 200, 60, 30, 15);

    // Polar ice caps
    ctx.fillStyle = '#ddd';
    drawBlob(ctx, 128, 3, 80, 8);
    drawBlob(ctx, 128, 122, 60, 6);

    // Olympus Mons area
    ctx.fillStyle = '#c86030';
    drawBlob(ctx, 150, 35, 10, 10);

    noise(ctx, w, h, 0.07);
    brighten(ctx, w, h, 1.4);
    return canvasToTexture(c);
}

// ---- Jupiter ----
export function jupiterTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // Base color bands
    const bands = [
        '#c4a070', '#d4b480', '#a88050', '#d4c090', '#b49060',
        '#c4a068', '#dcc898', '#a07848', '#c8b078', '#b09058',
        '#c4a070', '#d4b480', '#a88050',
    ];

    const bandH = h / bands.length;
    for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(0, i * bandH, w, bandH + 1);
    }

    // Great Red Spot
    ctx.fillStyle = '#c04820';
    drawBlob(ctx, 100, 68, 14, 8);
    ctx.fillStyle = '#d06838';
    drawBlob(ctx, 100, 68, 10, 5);

    // Subtle horizontal streaks
    for (let y = 0; y < h; y += 2) {
        const alpha = Math.random() * 0.08;
        ctx.fillStyle = `rgba(180, 150, 100, ${alpha})`;
        ctx.fillRect(0, y, w, 1);
    }

    noise(ctx, w, h, 0.04);
    brighten(ctx, w, h, 1.3);
    return canvasToTexture(c);
}

// ---- Saturn ----
export function saturnTexture() {
    const w = TEX_SIZE, h = TEX_SIZE / 2;
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');

    // Pale golden bands
    const bands = [
        '#d4c490', '#c8b880', '#ddd0a0', '#c4b478', '#d8cc98',
        '#c0b070', '#d4c890', '#c8b878', '#dcd0a0', '#c4b478',
    ];

    const bandH = h / bands.length;
    for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(0, i * bandH, w, bandH + 1);
    }

    for (let y = 0; y < h; y += 2) {
        const alpha = Math.random() * 0.06;
        ctx.fillStyle = `rgba(200, 180, 140, ${alpha})`;
        ctx.fillRect(0, y, w, 1);
    }

    noise(ctx, w, h, 0.03);
    brighten(ctx, w, h, 1.3);
    return canvasToTexture(c);
}

// ---- Saturn Ring ----
export function saturnRingTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const ctx = c.getContext('2d');

    // Ring bands with gaps
    const ringColors = [
        [0, 0.08, 'rgba(180,160,120,0.1)'],   // D ring (faint)
        [0.08, 0.22, 'rgba(180,160,120,0.6)'],  // C ring
        [0.22, 0.25, 'rgba(0,0,0,0)'],          // Colombo gap
        [0.25, 0.55, 'rgba(200,180,140,0.8)'],  // B ring (brightest)
        [0.55, 0.60, 'rgba(0,0,0,0)'],          // Cassini division
        [0.60, 0.85, 'rgba(180,160,120,0.5)'],  // A ring
        [0.85, 0.88, 'rgba(0,0,0,0)'],          // Encke gap
        [0.88, 1.0, 'rgba(140,120,90,0.2)'],    // F ring (faint)
    ];

    for (const [start, end, color] of ringColors) {
        ctx.fillStyle = color;
        ctx.fillRect(start * 512, 0, (end - start) * 512, 64);
    }

    noise(ctx, 512, 64, 0.03);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

// ---- Helper: draw irregular blob ----
function drawBlob(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const jitterX = 1 + (Math.random() - 0.5) * 0.4;
        const jitterY = 1 + (Math.random() - 0.5) * 0.4;
        const x = cx + Math.cos(angle) * rx * jitterX;
        const y = cy + Math.sin(angle) * ry * jitterY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
}
