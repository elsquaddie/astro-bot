/**
 * Main entry point: ties together scene, bodies, events, controls, UI.
 * Features: time playback, click-to-fly, real elliptical orbits, planet labels.
 */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createControls } from './controls.js';
import { createSun } from './sun.js';
import { createEarth } from './earth.js';
import { createMoon } from './moon.js';
import { EventMarkers } from './events.js';
import { createPlanets, updatePlanetPositions } from './planets.js';
import { createOrbits } from './orbits.js';
import { createLabel } from './labels.js';
import { fetchSolarSystem, fetchEventsCalendar } from './api.js';
import { updateHUD, showEventPopup } from './ui.js';
import { Calendar } from './calendar.js';

// --- State ---
let currentDate = new Date();
let solarData = null;

// Time playback
let isPlaying = false;
let playSpeed = 1;
let lastPlayTime = 0;
let playAccumulator = 0;

// Camera fly-to
let flyTarget = null;
let flyStartPos = null;
let flyStartTarget = null;

// --- Setup ---
const canvas = document.getElementById('scene');
const { renderer, scene, camera } = createScene(canvas);
const controls = createControls(camera, canvas);

const AU_SCALE = 3.0;
const MOON_EXAGGERATE = 80.0;

// --- Bodies ---
const sun = createSun();
scene.add(sun);
const sunLabel = createLabel('SUN', '#fa0', 0.4);
sunLabel.position.set(0, 0.35, 0);
sun.add(sunLabel);

const earth = createEarth();
scene.add(earth);
const earthLabel = createLabel('EARTH', '#4af', 0.4);
earthLabel.position.set(0, 0.22, 0);
earth.add(earthLabel);

const moon = createMoon();
scene.add(moon);
const moonLabel = createLabel('MOON', '#999', 0.25);
moonLabel.position.set(0, 0.08, 0);
moon.add(moonLabel);

// Other planets (with built-in labels)
const { meshes: planetMeshes } = createPlanets();
for (const group of Object.values(planetMeshes)) {
    scene.add(group);
}

// --- Elliptical Orbit Rings ---
const orbitLines = createOrbits(AU_SCALE);
for (const line of orbitLines) {
    scene.add(line);
}

// --- Event Markers ---
const eventMarkers = new EventMarkers(scene);

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- All clickable bodies ---
function getAllBodies() {
    return [
        { group: sun, name: 'SUN', viewDist: 1.5 },
        { group: earth, name: 'EARTH', viewDist: 0.8 },
        { group: moon, name: 'MOON', viewDist: 0.3 },
        ...Object.entries(planetMeshes).map(([name, group]) => ({
            group, name: name.toUpperCase(),
            viewDist: { mercury: 0.3, venus: 0.5, mars: 0.4, jupiter: 1.2, saturn: 1.5 }[name] || 0.8,
        })),
    ];
}

// --- Data Loading ---
async function loadData() {
    try {
        const timeStr = currentDate.toISOString();
        solarData = await fetchSolarSystem(timeStr);
        updatePositions();
        updateHUD(solarData);
    } catch (err) {
        console.error('Failed to load solar system data:', err);
        document.getElementById('hud-info').textContent = 'LOADING DATA...';
    }
}

function updatePositions() {
    if (!solarData) return;
    const { bodies, events } = solarData;

    sun.position.set(0, 0, 0);

    const ex = bodies.earth.x * AU_SCALE;
    const ey = bodies.earth.z * AU_SCALE;
    const ez = -bodies.earth.y * AU_SCALE;
    earth.position.set(ex, ey, ez);

    const dx = (bodies.moon.x - bodies.earth.x) * AU_SCALE * MOON_EXAGGERATE;
    const dy = (bodies.moon.z - bodies.earth.z) * AU_SCALE * MOON_EXAGGERATE;
    const dz = -(bodies.moon.y - bodies.earth.y) * AU_SCALE * MOON_EXAGGERATE;
    moon.position.set(ex + dx, ey + dy, ez + dz);

    updatePlanetPositions(planetMeshes, bodies, AU_SCALE);
    eventMarkers.update(events, { x: ex, y: ey, z: ez });
}

// --- Time Controls ---
document.getElementById('btn-prev').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadData();
});

document.getElementById('btn-next').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadData();
});

document.getElementById('btn-today').addEventListener('click', () => {
    currentDate = new Date();
    isPlaying = false;
    updatePlayButton();
    loadData();
});

// --- Time Playback ---
const btnPlay = document.getElementById('btn-play');
const speedLabel = document.getElementById('speed-label');
const btnSpeedDown = document.getElementById('btn-speed-down');
const btnSpeedUp = document.getElementById('btn-speed-up');

const SPEED_STEPS = [1, 7, 30, 365];
let speedIndex = 0;

function updatePlayButton() {
    btnPlay.textContent = isPlaying ? '||' : '>';
}

function updateSpeedLabel() {
    const labels = ['1D/S', '1W/S', '1M/S', '1Y/S'];
    speedLabel.textContent = labels[speedIndex];
}

btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
        lastPlayTime = performance.now();
        playAccumulator = 0;
    }
    updatePlayButton();
});

btnSpeedDown.addEventListener('click', () => {
    speedIndex = Math.max(0, speedIndex - 1);
    playSpeed = SPEED_STEPS[speedIndex];
    updateSpeedLabel();
});

btnSpeedUp.addEventListener('click', () => {
    speedIndex = Math.min(SPEED_STEPS.length - 1, speedIndex + 1);
    playSpeed = SPEED_STEPS[speedIndex];
    updateSpeedLabel();
});

updatePlayButton();
updateSpeedLabel();
playSpeed = SPEED_STEPS[speedIndex];

// --- Click & Double-click ---
let clickTimer = null;

canvas.addEventListener('click', (e) => {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        handleDoubleClick(e);
        return;
    }
    clickTimer = setTimeout(() => {
        clickTimer = null;
        handleSingleClick(e);
    }, 250);
});

function setMouseFromEvent(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function handleSingleClick(e) {
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    const event = eventMarkers.getClickedEvent(raycaster);
    if (event) {
        showEventPopup(event);
    }
}

function handleDoubleClick(e) {
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = [];
    for (const body of getAllBodies()) {
        body.group.traverse(child => {
            if (child.isMesh) {
                child.userData._parentBody = body;
                allMeshes.push(child);
            }
        });
    }

    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length > 0) {
        const body = hits[0].object.userData._parentBody;
        if (body) flyToBody(body.group, body.viewDist);
    }
}

// --- Fly-to Animation ---
function flyToBody(targetGroup, viewDist) {
    const targetPos = new THREE.Vector3();
    targetGroup.getWorldPosition(targetPos);

    const dir = new THREE.Vector3().subVectors(camera.position, targetPos).normalize();
    const dest = targetPos.clone().add(dir.multiplyScalar(viewDist));
    dest.y = Math.max(dest.y, targetPos.y + viewDist * 0.3);

    flyStartPos = camera.position.clone();
    flyStartTarget = controls.target.clone();
    flyTarget = {
        position: dest,
        lookAt: targetPos,
        startTime: performance.now(),
        duration: 1200,
    };
    controls.enabled = false;
}

function updateFlyTo() {
    if (!flyTarget) return;
    const elapsed = performance.now() - flyTarget.startTime;
    let t = Math.min(1, elapsed / flyTarget.duration);
    t = 1 - Math.pow(1 - t, 3); // ease out cubic

    camera.position.lerpVectors(flyStartPos, flyTarget.position, t);
    controls.target.lerpVectors(flyStartTarget, flyTarget.lookAt, t);

    if (t >= 1) {
        flyTarget = null;
        controls.enabled = true;
    }
}

// --- Hover tooltip ---
const infoEl = document.getElementById('body-info');
canvas.addEventListener('mousemove', (e) => {
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = [];
    for (const body of getAllBodies()) {
        body.group.traverse(child => {
            if (child.isMesh) {
                child.userData._parentBody = body;
                allMeshes.push(child);
            }
        });
    }

    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length > 0 && hits[0].object.userData._parentBody) {
        infoEl.textContent = `[ ${hits[0].object.userData._parentBody.name} ] DBL-CLICK TO FOCUS`;
        infoEl.style.display = 'block';
        canvas.style.cursor = 'pointer';
    } else {
        infoEl.style.display = 'none';
        canvas.style.cursor = 'grab';
    }
});

// --- Animation Loop ---
const clock = new THREE.Clock();
let loadCooldown = 0;

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const now = performance.now();

    // Time playback
    if (isPlaying) {
        const dt = (now - lastPlayTime) / 1000;
        lastPlayTime = now;
        playAccumulator += dt * playSpeed;

        if (playAccumulator >= 1) {
            const days = Math.floor(playAccumulator);
            playAccumulator -= days;
            currentDate.setDate(currentDate.getDate() + days);

            if (now - loadCooldown > 300) {
                loadCooldown = now;
                loadData();
            }
        }
    }

    updateFlyTo();

    // Rotate bodies
    if (earth.children[0]) earth.children[0].rotation.y = elapsed * 0.3;
    if (moon.children[0]) moon.children[0].rotation.y = elapsed * 0.05;
    for (const group of Object.values(planetMeshes)) {
        if (group.children[0]) group.children[0].rotation.y = elapsed * 0.15;
    }

    eventMarkers.animate(elapsed);

    // Sun glow pulse
    if (sun.children[2]) {
        const pulse = 1.0 + Math.sin(elapsed * 2) * 0.06;
        sun.children[2].scale.set(1.2 * pulse, 1.2 * pulse, 1);
    }

    controls.update();
    renderer.render(scene, camera);
}

// --- Calendar ---
const calendar = new Calendar(document.getElementById('calendar-panel'), async (dateStr) => {
    currentDate = new Date(dateStr + 'T12:00:00Z');
    isPlaying = false;
    updatePlayButton();
    await loadData();
});

document.getElementById('btn-calendar').addEventListener('click', async () => {
    const panel = document.getElementById('calendar-panel');
    const isHidden = panel.classList.toggle('hidden');
    if (!isHidden) {
        const year = currentDate.getFullYear();
        const data = await fetchEventsCalendar(year);
        calendar.render(data);
    }
});

// --- Init ---
loadData();
animate();
