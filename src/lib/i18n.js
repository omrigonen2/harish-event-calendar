import { LANGUAGES, DEFAULT_LANGUAGE } from '../config/constants.js';

/** Read a value from a Mongoose Map or plain object. */
export function mapGet(map, key) {
  if (!map) return undefined;
  if (typeof map.get === 'function') return map.get(key);
  return map[key];
}

/** Write a value to a Mongoose Map or plain object. */
export function mapSet(map, key, value) {
  if (!map) return;
  if (typeof map.set === 'function') {
    map.set(key, value);
  } else {
    map[key] = value;
  }
}

/** Remove a key from a Mongoose Map or plain object. */
export function mapDelete(map, key) {
  if (!map) return;
  if (typeof map.delete === 'function') {
    map.delete(key);
  } else {
    delete map[key];
  }
}

/** List language codes present on a Map or plain object. */
export function mapKeys(map) {
  if (!map) return [];
  if (typeof map.keys === 'function') return [...map.keys()];
  return Object.keys(map);
}

/** Resolve a localized string map (category/audience name) with fallback. */
export function resolveLabel(value, lang = DEFAULT_LANGUAGE, fallbackOrder = []) {
  if (!value) return '';
  const primary = mapGet(value, lang);
  if (primary) return primary;
  for (const code of fallbackOrder) {
    const v = mapGet(value, code);
    if (v) return v;
  }
  for (const l of LANGUAGES) {
    const v = mapGet(value, l.code);
    if (v) return v;
  }
  return '';
}

/**
 * Resolve event translation with fallback chain:
 * requested lang → tenant default → any available.
 */
export function resolveEventTranslation(translations, lang, fallbackOrder = []) {
  const primary = mapGet(translations, lang);
  if (primary?.title || primary?.descriptionHtml) {
    return {
      title: primary.title || '',
      descriptionHtml: primary.descriptionHtml || '',
    };
  }
  for (const code of fallbackOrder) {
    if (code === lang) continue;
    const tr = mapGet(translations, code);
    if (tr?.title || tr?.descriptionHtml) {
      return {
        title: tr.title || '',
        descriptionHtml: tr.descriptionHtml || '',
      };
    }
  }
  for (const code of mapKeys(translations)) {
    const tr = mapGet(translations, code);
    if (tr?.title || tr?.descriptionHtml) {
      return {
        title: tr.title || '',
        descriptionHtml: tr.descriptionHtml || '',
      };
    }
  }
  return { title: '', descriptionHtml: '' };
}

/** Merge translation entries onto a Mongoose event document. */
export function applyEventTranslations(event, entries) {
  if (!entries || typeof entries !== 'object') return;
  for (const [code, entry] of Object.entries(entries)) {
    if (entry && (entry.title || entry.descriptionHtml)) {
      mapSet(event.translations, code, {
        title: (entry.title || '').trim(),
        descriptionHtml: entry.descriptionHtml || '',
      });
    }
  }
}

/**
 * Apply form translations for supported languages only.
 * Clears a supported language when the form submits it empty; leaves other langs untouched.
 */
export function applySupportedEventTranslations(event, incomingMap, supportedLanguages) {
  for (const code of supportedLanguages) {
    if (incomingMap[code]) {
      mapSet(event.translations, code, incomingMap[code]);
    } else {
      mapDelete(event.translations, code);
    }
  }
}

export function languageLabel(code) {
  return LANGUAGES.find((l) => l.code === code)?.label || code;
}
