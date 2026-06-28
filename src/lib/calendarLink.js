import { nanoid } from 'nanoid';
import ShareLink from '../models/ShareLink.js';

export const CALENDAR_QUERY_KEYS = ['view', 'lang', 'category', 'audience', 'character', 'from', 'to', 'q', 'price'];

export function pickCalendarContext(query = {}) {
  const ctx = {};
  for (const k of CALENDAR_QUERY_KEYS) {
    const v = query[k];
    if (v !== undefined && v !== null && v !== '') ctx[k] = String(v);
  }
  return ctx;
}

export function buildCalendarContextQuery(context = {}) {
  const params = new URLSearchParams();
  for (const k of CALENDAR_QUERY_KEYS) {
    if (context[k]) params.set(k, context[k]);
  }
  return params.toString();
}

export function buildFilteredCalendarQuery(filters = {}, { share = false } = {}) {
  const params = new URLSearchParams();
  if (filters.lang) params.set('lang', filters.lang);
  if (filters.view) params.set('view', filters.view);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.category) params.set('category', filters.category);
  if (filters.audience) params.set('audience', filters.audience);
  if (filters.character) params.set('character', filters.character);
  if (filters.q) params.set('q', filters.q);
  if (filters.price) params.set('price', filters.price);
  if (share) params.set('share', '1');
  return params.toString();
}

export function buildFilteredCalendarPath(tenantSlug, filters = {}, opts = {}) {
  const qs = buildFilteredCalendarQuery(filters, opts);
  return `/c/${tenantSlug}${qs ? `?${qs}` : ''}`;
}

export function buildFilteredCalendarUrl(baseUrl, tenantSlug, filters = {}, opts = {}) {
  const path = buildFilteredCalendarPath(tenantSlug, filters, opts);
  return `${String(baseUrl).replace(/\/$/, '')}${path}`;
}

export function buildShortSharePath(code) {
  return `/s/${code}`;
}

export function buildShortShareUrl(baseUrl, code) {
  return `${String(baseUrl).replace(/\/$/, '')}${buildShortSharePath(code)}`;
}

export function buildEventUrl(tenantSlug, eventId, calendarContext = {}) {
  const qs = buildCalendarContextQuery(calendarContext);
  return `/c/${tenantSlug}/events/${eventId}${qs ? `?${qs}` : ''}`;
}

export function buildCalendarBackUrl(tenantSlug, calendarContext = {}) {
  const qs = buildCalendarContextQuery(calendarContext);
  return `/c/${tenantSlug}${qs ? `?${qs}` : ''}`;
}

export function buildClearFiltersUrl(tenantSlug, { lang, view } = {}) {
  const params = new URLSearchParams();
  if (lang) params.set('lang', lang);
  if (view) params.set('view', view);
  const qs = params.toString();
  return `/c/${tenantSlug}${qs ? `?${qs}` : ''}`;
}

export function hasActivePublicFilters(filters = {}) {
  return Boolean(filters.category || filters.audience || filters.character || filters.from || filters.to || filters.q || filters.price);
}

export async function createShareLink(tenantId, userId, filters) {
  const code = nanoid(8);
  await ShareLink.create({
    tenantId,
    code,
    filters: {
      from: filters.from || '',
      to: filters.to || '',
      category: filters.category || '',
      audience: filters.audience || '',
      character: filters.character || '',
      lang: filters.lang || '',
      view: filters.view || 'list',
    },
    createdBy: userId,
  });
  return code;
}

export async function resolveShareLink(code) {
  return ShareLink.findOne({ code });
}
