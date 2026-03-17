/**
 * Three.js scene setup: renderer, camera, ambient elements.
 */
import * as THREE from 'three';

export function createScene(canvas) {
    // Renderer — pixelated for PS1 feel
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x010208);

    const scene = new THREE.Scene();

    // Camera — top-down view to see orbits clearly
    const camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.01, 500
    );
    camera.position.set(0, 8, 5);
    camera.lookAt(0, 0, 0);

    // Ambient light
    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    scene.add(ambient);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 200;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        // Slight color variation
        const brightness = 0.3 + Math.random() * 0.7;
        starColors[i * 3] = brightness * (0.8 + Math.random() * 0.2);
        starColors[i * 3 + 1] = brightness * (0.8 + Math.random() * 0.2);
        starColors[i * 3 + 2] = brightness;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Handle resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { renderer, scene, camera };
}
