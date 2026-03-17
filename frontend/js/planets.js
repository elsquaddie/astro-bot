/**
 * Other solar system planets with procedural textures and labels.
 */
import * as THREE from 'three';
import { createLabel } from './labels.js';
import {
    mercuryTexture, venusTexture, marsTexture,
    jupiterTexture, saturnTexture, saturnRingTexture,
} from './textures.js';

const PLANET_CONFIG = {
    mercury: { radius: 0.05, segments: 16, texFn: mercuryTexture, labelColor: '#aaa', name: 'MERCURY' },
    venus:   { radius: 0.12, segments: 20, texFn: venusTexture,   labelColor: '#da5', name: 'VENUS' },
    mars:    { radius: 0.08, segments: 18, texFn: marsTexture,    labelColor: '#c63', name: 'MARS' },
    jupiter: { radius: 0.30, segments: 24, texFn: jupiterTexture, labelColor: '#ca8', name: 'JUPITER' },
    saturn:  { radius: 0.25, segments: 24, texFn: saturnTexture,  labelColor: '#cb8', name: 'SATURN' },
};

function createPlanetMesh(cfg) {
    const group = new THREE.Group();
    group.name = cfg.name;

    const geo = new THREE.SphereGeometry(cfg.radius, cfg.segments, cfg.segments / 2);
    const mat = new THREE.MeshBasicMaterial({
        map: cfg.texFn(),
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Label
    const label = createLabel(cfg.name, cfg.labelColor, cfg.radius > 0.2 ? 0.8 : 0.5);
    label.position.set(0, cfg.radius + 0.1, 0);
    group.add(label);

    return group;
}

function createSaturnRings(cfg) {
    const ringGroup = new THREE.Group();

    const innerR = cfg.radius * 1.3;
    const outerR = cfg.radius * 2.4;
    const geo = new THREE.RingGeometry(innerR, outerR, 64);

    // Fix UV mapping for ring texture (radial)
    const uvs = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uvs.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const dist = Math.sqrt(x * x + y * y);
        uvs.setXY(i, (dist - innerR) / (outerR - innerR), 0.5);
    }

    const mat = new THREE.MeshBasicMaterial({
        map: saturnRingTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2.3;
    ringGroup.add(ring);

    return ringGroup;
}

export function createPlanets() {
    const meshes = {};

    for (const [name, cfg] of Object.entries(PLANET_CONFIG)) {
        const planet = createPlanetMesh(cfg);
        meshes[name] = planet;

        if (name === 'saturn') {
            planet.add(createSaturnRings(cfg));
        }
    }

    return { meshes };
}

export function updatePlanetPositions(meshes, bodies, auScale) {
    for (const [name, group] of Object.entries(meshes)) {
        if (bodies[name]) {
            const b = bodies[name];
            const x = b.x * auScale;
            const y = b.z * auScale;
            const z = -b.y * auScale;
            group.position.set(x, y, z);
        }
    }
}

export { PLANET_CONFIG };
