/**
 * OrbitControls wrapper with smooth damping.
 */
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 80;
    controls.target.set(0, 0, 0);
    controls.zoomSpeed = 1.2;
    controls.rotateSpeed = 0.8;
    controls.update();
    return controls;
}
