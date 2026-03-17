/**
 * PS1-style yearly event calendar.
 * Shows 12 months with event markers, clickable to navigate.
 */

const MONTH_NAMES = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const EVENT_COLORS = {
    solar_eclipse: '#ff6633',
    lunar_eclipse: '#aa66cc',
    meteor_peak: '#66ccff',
    supermoon: '#ffdd88',
};

const EVENT_ICONS = {
    solar_eclipse: '&#9728;',   // ☀
    lunar_eclipse: '&#9789;',   // ☽
    meteor_peak: '&#9734;',     // ☆
    supermoon: '&#9790;',       // ☾
};

export class Calendar {
    constructor(container, onDateSelect) {
        this.container = container;
        this.onDateSelect = onDateSelect;
    }

    render(data) {
        const { year, months } = data;

        let html = `<div class="cal-header">
            <span class="cal-year">${year}</span>
            <span class="cal-title">EVENTS</span>
        </div>`;
        html += '<div class="cal-grid">';

        for (const { month, events } of months) {
            const name = MONTH_NAMES[month - 1];
            const hasEvents = events.length > 0;
            const cls = hasEvents ? 'cal-month has-events' : 'cal-month';

            html += `<div class="${cls}">`;
            html += `<div class="cal-month-name">${name}</div>`;

            if (hasEvents) {
                html += '<div class="cal-events">';
                for (const ev of events) {
                    const color = EVENT_COLORS[ev.type] || '#0f0';
                    const icon = EVENT_ICONS[ev.type] || '&#9679;';
                    const date = ev.time_utc.split('T')[0];
                    const label = ev.parameters?.shower_name || ev.type.replace('_', ' ');
                    html += `<div class="cal-event" data-date="${date}" style="color:${color}" title="${label} — ${date}">
                        <span class="cal-icon">${icon}</span>
                        <span class="cal-label">${label}</span>
                    </div>`;
                }
                html += '</div>';
            }

            html += '</div>';
        }

        html += '</div>';
        this.container.innerHTML = html;

        // Click handlers
        this.container.querySelectorAll('.cal-event').forEach(el => {
            el.addEventListener('click', () => {
                const date = el.dataset.date;
                if (date && this.onDateSelect) {
                    this.onDateSelect(date);
                }
            });
        });
    }
}
