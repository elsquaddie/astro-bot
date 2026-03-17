/**
 * Elliptical orbit rings based on real Keplerian elements.
 * Uses true anomaly parametrization for proper ellipses centered on focus (Sun).
 * Converts from ecliptic to equatorial (ICRF) frame to match Skyfield positions.
 */
import * as THREE from 'three';

// Obliquity of the ecliptic (J2000) — rotation from ecliptic to equatorial frame
const OBLIQUITY = 23.4393 * Math.PI / 180;
const COS_OBL = Math.cos(OBLIQUITY);
const SIN_OBL = Math.sin(OBLIQUITY);

// Real orbital elements (J2000, simplified for vis)
// a = semi-major axis (AU), e = eccentricity
// i = inclination (deg), lan = longitude of ascending node (deg)
// w = argument of perihelion (deg)
const ORBIT_DATA = {
    mercury: { a: 0.387, e: 0.2056, i: 7.00, lan: 48.33,  w: 29.12,  color: 0xaaaaaa },
    venus:   { a: 0.723, e: 0.0068, i: 3.39, lan: 76.68,  w: 54.88,  color: 0xddbb66 },
    earth:   { a: 1.000, e: 0.0167, i: 0.00, lan: 0,      w: 114.21, color: 0x5588cc },
    mars:    { a: 1.524, e: 0.0934, i: 1.85, lan: 49.56,  w: 286.50, color: 0xcc6644 },
    jupiter: { a: 5.203, e: 0.0489, i: 1.30, lan: 100.46, w: 273.87, color: 0xcc9966 },
    saturn:  { a: 9.537, e: 0.0565, i: 2.49, lan: 113.67, w: 339.39, color: 0xccbb88 },
};

export function createOrbits(auScale) {
    const lines = [];

    for (const [name, orb] of Object.entries(ORBIT_DATA)) {
        const segments = 256;
        const points = [];

        const iRad = orb.i * Math.PI / 180;
        const lanRad = orb.lan * Math.PI / 180;
        const wRad = orb.w * Math.PI / 180;

        for (let j = 0; j <= segments; j++) {
            // True anomaly
            const nu = (j / segments) * Math.PI * 2;

            // Distance from focus (Sun) at this anomaly
            const r = orb.a * (1 - orb.e * orb.e) / (1 + orb.e * Math.cos(nu));

            // Position in orbital plane (perihelion along x)
            const xOrb = r * Math.cos(nu);
            const yOrb = r * Math.sin(nu);

            // Rotate by argument of perihelion (w) in orbital plane
            const x1 = xOrb * Math.cos(wRad) - yOrb * Math.sin(wRad);
            const y1 = xOrb * Math.sin(wRad) + yOrb * Math.cos(wRad);

            // Rotate by inclination (i) — tilt orbital plane
            const x2 = x1;
            const y2 = y1 * Math.cos(iRad);
            const z2 = y1 * Math.sin(iRad);

            // Rotate by longitude of ascending node (LAN)
            const x3 = x2 * Math.cos(lanRad) - y2 * Math.sin(lanRad);
            const y3 = x2 * Math.sin(lanRad) + y2 * Math.cos(lanRad);
            const z3 = z2;

            // Convert ecliptic (x3,y3,z3) → equatorial (ICRF) to match Skyfield
            // Rotation around x-axis by obliquity ε:
            //   x_eq = x_ecl
            //   y_eq = y_ecl * cos(ε) - z_ecl * sin(ε)
            //   z_eq = y_ecl * sin(ε) + z_ecl * cos(ε)
            const xEq = x3;
            const yEq = y3 * COS_OBL - z3 * SIN_OBL;
            const zEq = y3 * SIN_OBL + z3 * COS_OBL;

            // Three.js mapping (same as main.js planet positions):
            // API x → Three x, API z → Three y, API -y → Three z
            points.push(new THREE.Vector3(
                xEq * auScale,
                zEq * auScale,
                -yEq * auScale,
            ));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);

        const mat = new THREE.LineBasicMaterial({
            color: orb.color,
            transparent: true,
            opacity: orb.a > 2 ? 0.35 : 0.5,
        });

        const line = new THREE.Line(geo, mat);
        line.name = `orbit_${name}`;
        lines.push(line);
    }

    return lines;
}
