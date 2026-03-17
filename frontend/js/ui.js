/**
 * HUD and UI controls.
 */
import { EVENT_LABELS } from './events.js';

const hudDate = document.getElementById('hud-date');
const hudInfo = document.getElementById('hud-info');
const timeLabel = document.getElementById('time-label');
const popup = document.getElementById('event-popup');
const popupTitle = document.getElementById('popup-title');
const popupBody = document.getElementById('popup-body');
const popupClose = document.getElementById('popup-close');

popupClose.addEventListener('click', () => popup.classList.add('hidden'));

export function updateHUD(data) {
    const dt = new Date(data.time_utc);
    const dateStr = dt.toISOString().split('T')[0];

    hudDate.textContent = dateStr;
    timeLabel.textContent = dateStr;

    // Show event summary
    if (data.events.length === 0) {
        hudInfo.textContent = 'NO EVENTS IN RANGE';
    } else {
        const lines = data.events.map(ev => {
            const label = EVENT_LABELS[ev.type] || ev.type.toUpperCase();
            const d = new Date(ev.time_utc);
            return `> ${label} ${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
        });
        hudInfo.textContent = lines.join('\n');
    }
}

export function showEventPopup(event) {
    const label = EVENT_LABELS[event.type] || event.type;
    popupTitle.textContent = label;

    const dt = new Date(event.time_utc);
    let body = `DATE: ${dt.toISOString().split('T')[0]}\n`;
    body += `TIME: ${dt.toISOString().split('T')[1].slice(0, 5)} UTC\n`;
    body += `CLASS: ${event.class_type.toUpperCase()}\n`;

    if (event.parameters) {
        const params = event.parameters;
        if (params.shower_name) body += `NAME: ${params.shower_name}\n`;
        if (params.eclipse_type) body += `TYPE: ${params.eclipse_type}\n`;
        if (params.zhr) body += `ZHR: ${params.zhr}\n`;
        if (params.duration_min) body += `DURATION: ${params.duration_min} MIN\n`;
        if (params.distance_km) body += `DIST: ${params.distance_km} KM\n`;
    }

    popupBody.textContent = body;
    popup.classList.remove('hidden');
}

export function hideEventPopup() {
    popup.classList.add('hidden');
}
