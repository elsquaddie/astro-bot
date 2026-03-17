/**
 * PS1-style vertex snapping shader material.
 * Snaps vertices to a grid for that classic jittery look.
 */
import * as THREE from 'three';

const PS1_VERTEX = `
    uniform float u_resolution;
    varying vec3 vColor;
    varying float vFog;

    void main() {
        vColor = color;

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

        // PS1 vertex snapping: snap to grid in screen space
        vec4 snapped = projectionMatrix * mvPos;
        snapped.xyz = floor(snapped.xyz * u_resolution) / u_resolution;

        // Distance fog
        vFog = smoothstep(2.0, 30.0, -mvPos.z);

        gl_Position = snapped;
    }
`;

const PS1_FRAGMENT = `
    varying vec3 vColor;
    varying float vFog;
    uniform vec3 u_fogColor;

    void main() {
        // Posterize colors (limited palette)
        vec3 col = floor(vColor * 8.0) / 8.0;

        // Mix with fog
        col = mix(col, u_fogColor, vFog * 0.6);

        gl_FragColor = vec4(col, 1.0);
    }
`;

export function createPS1Material(baseColor, resolution = 120.0) {
    return new THREE.ShaderMaterial({
        vertexShader: PS1_VERTEX,
        fragmentShader: PS1_FRAGMENT,
        uniforms: {
            u_resolution: { value: resolution },
            u_fogColor: { value: new THREE.Color(0x000800) },
        },
        vertexColors: true,
        side: THREE.FrontSide,
    });
}

/**
 * Apply vertex colors to geometry based on a base color with slight variation.
 */
export function applyVertexColors(geometry, baseColor, variation = 0.08) {
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color(baseColor);

    for (let i = 0; i < count; i++) {
        const r = c.r + (Math.random() - 0.5) * variation;
        const g = c.g + (Math.random() - 0.5) * variation;
        const b = c.b + (Math.random() - 0.5) * variation;
        colors[i * 3] = Math.max(0, Math.min(1, r));
        colors[i * 3 + 1] = Math.max(0, Math.min(1, g));
        colors[i * 3 + 2] = Math.max(0, Math.min(1, b));
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
