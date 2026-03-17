/**
 * API client for solar system data.
 */

export async function fetchSolarSystem(time = null) {
    const params = time ? `?time=${time}` : '';
    const resp = await fetch(`/api/solar-system${params}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
}

export async function fetchEventsCalendar(year) {
    const resp = await fetch(`/api/events/calendar?year=${year}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
}
