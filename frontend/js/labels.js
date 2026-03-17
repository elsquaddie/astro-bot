/**
 * Sprite-based text labels for planets.
 * Clean, modern monospace font rendered to canvas.
 */
import * as THREE from 'three';

const labelCache = new Map();

function createLabelTexture(text, color = '#fff') {
    const key = `${text}_${color}`;
    if (labelCache.has(key)) return labelCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 48);

    // Subtle glow behind text
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.font = '500 16px "JetBrains Mono", "SF Mono", monospace';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 24);

    // Reset shadow
    ctx.shadowBlur = 0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    labelCache.set(key, texture);
    return texture;
}

/**
 * Create a sprite label that floats above a body.
 */
export function createLabel(text, color = '#fff', scale = 0.6) {
    const texture = createLabelTexture(text, color);
    const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale * 0.19, 1);
    sprite.center.set(0.5, 0);
    return sprite;
}
