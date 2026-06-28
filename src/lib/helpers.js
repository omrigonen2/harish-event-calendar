import { LANGUAGES, DEFAULT_LANGUAGE } from '../config/constants.js';
import { resolveLabel, languageLabel as langLabel } from '../lib/i18n.js';
import { translate, uiStringsFor, uiLang } from '../lib/ui-i18n.js';

export function i18n(value, lang = DEFAULT_LANGUAGE, fallbackOrder = []) {
  return resolveLabel(value, lang, fallbackOrder);
}

export function formatDate(date, { withTime = false, locale = 'en-GB' } = {}) {
  if (!date) return '';
  const d = new Date(date);
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
  }
  return d.toLocaleString(locale, opts);
}

export function formatDateInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export function formatTimeInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().slice(11, 16);
}

export function languageLabel(code) {
  return langLabel(code);
}

export function viewHelpers(req, res, next) {
  const getLang = () => uiLang(res.locals.lang || res.locals.adminLang || DEFAULT_LANGUAGE);
  const lang = getLang();
  res.locals.adminLang = lang;
  if (!res.locals.adminDir) {
    res.locals.adminDir = lang === 'he' ? 'rtl' : 'ltr';
  }
  res.locals.t = (key, vars) => translate(key, getLang(), vars);
  res.locals.tView = (view) => translate(`view.${view}`, getLang()) || view;
  res.locals.tStatus = (status) => translate(`status.${status}`, getLang()) || status;
  res.locals.tSort = (sort) => translate(`sort.${sort}`, getLang()) || sort;
  res.locals.tPlatform = (platform) => translate(`platformSocial.${platform}`, getLang()) || platform;
  res.locals.uiStrings = uiStringsFor(lang);
  res.locals.i18n = (value, l) => {
    const resolved = l || lang;
    const fallback = res.locals.tenantSettings?.defaultLanguage
      ? [res.locals.tenantSettings.defaultLanguage]
      : [];
    return resolveLabel(value, resolved, fallback);
  };
  res.locals.formatDate = (date, opts = {}) => {
    const locale = getLang() === 'he' ? 'he-IL' : getLang() === 'en' ? 'en-GB' : getLang();
    return formatDate(date, { ...opts, locale });
  };
  res.locals.formatDateInput = formatDateInput;
  res.locals.formatTimeInput = formatTimeInput;
  res.locals.languageLabel = languageLabel;
  res.locals.LANGUAGES = LANGUAGES;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
}
