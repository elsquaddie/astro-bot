/**
 * Event markers as 2D sprite icons orbiting Earth.
 * Cleaner than 3D octahedrons, always face camera.
 */
import * as THREE from 'three';

const EVENT_COLORS = {
    solar_eclipse: '#ff4400',
    lunar_eclipse: '#8844cc',
    meteor_peak: '#44ff44',
    supermoon: '#ffffaa',
};

const EVENT_LABELS = {
    solar_eclipse: 'SOLAR ECLIPSE',
    lunar_eclipse: 'LUNAR ECLIPSE',
    meteor_peak: 'METEOR SHOWER',
    supermoon: 'SUPERMOON',
};

const EVENT_ICONS = {
    solar_eclipse: '\u2600',   // ☀
    lunar_eclipse: '\u263D',   // ☽
    meteor_peak: '\u2605',     // ★
    supermoon: '\u25CF',       // ●
};

// Cache icon textures
const iconCache = new Map();

function createIconTexture(type) {
    if (iconCache.has(type)) return iconCache.get(type);

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const color = EVENT_COLORS[type] || '#fff';
    const icon = EVENT_ICONS[type] || '?';

    // Glow background
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color + '44');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Icon
    ctx.font = '28px serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    iconCache.set(type, tex);
    return tex;
}

export class EventMarkers {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'events';
        this.markers = [];
        scene.add(this.group);
    }

    clear() {
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material && !child.material.map?._cached) child.material.dispose();
            this.group.remove(child);
        }
        this.markers = [];
    }

    update(events, earthPos) {
        this.clear();
        this._totalCount = events.length;

        for (const ev of events) {
            const marker = this._createMarker(ev, earthPos);
            this.markers.push({ sprite: marker, data: ev });
        }
    }

    _createMarker(event, earthPos) {
        const idx = this.markers.length;
        const total = Math.max(this._totalCount || 1, 4);
        const angle = (idx / total) * Math.PI * 2;
        const radius = 0.35 + (idx % 3) * 0.12;

        const x = earthPos.x + Math.cos(angle) * radius;
        const y = earthPos.y + 0.1 + Math.sin(angle) * radius * 0.3;
        const z = earthPos.z + Math.sin(angle) * radius * 0.5;

        // Icon sprite
        const mat = new THREE.SpriteMaterial({
            map: createIconTexture(event.type),
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(x, y, z);
        sprite.scale.set(0.12, 0.12, 1);
        sprite.userData = event;
        this.group.add(sprite);

        // Thin connecting line to Earth
        const color = new THREE.Color(EVENT_COLORS[event.type] || '#fff');
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(earthPos.x, earthPos.y, earthPos.z),
            new THREE.Vector3(x, y, z),
        ]);
        const lineMat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
        });
        this.group.add(new THREE.Line(lineGeo, lineMat));

        return sprite;
    }

    animate(time) {
        for (let i = 0; i < this.markers.length; i++) {
            const { sprite } = this.markers[i];
            // Gentle floating
            const baseY = sprite.position.y;
            sprite.position.y = baseY + Math.sin(time * 2 + i) * 0.005;
            // Subtle pulse
            const s = 0.12 + Math.sin(time * 3 + i * 0.7) * 0.01;
            sprite.scale.set(s, s, 1);
        }
    }

    getClickedEvent(raycaster) {
        const intersects = raycaster.intersectObjects(this.group.children, false);
        for (const hit of intersects) {
            if (hit.object.userData && hit.object.userData.type) {
                return hit.object.userData;
            }
        }
        return null;
    }
}

export { EVENT_LABELS };
