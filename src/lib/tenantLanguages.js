import { DEFAULT_LANGUAGE } from '../config/constants.js';

/**
 * Normalize tenant language settings for use across admin, public, and API.
 * Language config is tenant-level — shared by managers, editors, and visitors.
 */
export function resolveTenantLanguages(tenantSettings = {}) {
  const defaultLanguage = tenantSettings.defaultLanguage || DEFAULT_LANGUAGE;
  let supportedLanguages = Array.isArray(tenantSettings.supportedLanguages)
    ? tenantSettings.supportedLanguages.filter(Boolean)
    : [];

  if (!supportedLanguages.length) {
    supportedLanguages = [defaultLanguage];
  }

  if (!supportedLanguages.includes(defaultLanguage)) {
    supportedLanguages = [defaultLanguage, ...supportedLanguages];
  }

  return {
    defaultLanguage,
    supportedLanguages,
    autoTranslateOnSave: tenantSettings.autoTranslateOnSave !== false,
  };
}

/** Apply normalized language fields onto a tenant settings doc for this request. */
export function applyTenantLanguages(settings) {
  const langs = resolveTenantLanguages(settings);
  settings.supportedLanguages = langs.supportedLanguages;
  settings.defaultLanguage = langs.defaultLanguage;
  return settings;
}
