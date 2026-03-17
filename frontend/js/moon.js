/**
 * Moon: textured sphere with craters.
 */
import * as THREE from 'three';
import { moonTexture } from './textures.js';

export function createMoon() {
    const group = new THREE.Group();
    group.name = 'MOON';

    const geo = new THREE.SphereGeometry(0.04, 14, 10);
    const mat = new THREE.MeshBasicMaterial({
        map: moonTexture(),
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    return group;
}
