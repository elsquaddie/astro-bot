/**
 * Earth: textured sphere with atmosphere glow.
 */
import * as THREE from 'three';
import { earthTexture } from './textures.js';

export function createEarth() {
    const group = new THREE.Group();
    group.name = 'EARTH';

    const geo = new THREE.SphereGeometry(0.15, 20, 14);
    const mat = new THREE.MeshBasicMaterial({
        map: earthTexture(),
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Atmosphere glow ring
    const atmGeo = new THREE.RingGeometry(0.155, 0.18, 32);
    const atmMat = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
    });
    const atm = new THREE.Mesh(atmGeo, atmMat);
    atm.rotation.x = Math.PI / 2;
    group.add(atm);

    return group;
}
