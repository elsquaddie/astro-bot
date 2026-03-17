/**
 * Sun: textured sphere with radial glow.
 */
import * as THREE from 'three';
import { sunTexture } from './textures.js';

function createGlowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Radial gradient — circular glow, transparent edges
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 200, 50, 0.6)');
    grad.addColorStop(0.3, 'rgba(255, 150, 30, 0.2)');
    grad.addColorStop(0.7, 'rgba(255, 100, 10, 0.05)');
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

export function createSun() {
    const group = new THREE.Group();
    group.name = 'SUN';

    // Textured sphere
    const geo = new THREE.SphereGeometry(0.25, 24, 16);
    const mat = new THREE.MeshBasicMaterial({
        map: sunTexture(),
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Point light
    const light = new THREE.PointLight(0xffcc66, 2.0, 100);
    group.add(light);

    // Circular glow sprite (no more brown square!)
    const glowMat = new THREE.SpriteMaterial({
        map: createGlowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(1.5, 1.5, 1);
    group.add(glow);

    return group;
}
