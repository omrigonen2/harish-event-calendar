import { chatComplete, listModels } from '../lib/openai.js';
import { getOpenAIConfig } from './settingsService.js';
import { languageLabel, mapGet } from '../lib/i18n.js';
import { stripHtml } from '../lib/sanitize.js';

export async function availableModels(tenantId = null) {
  const config = await getOpenAIConfig(tenantId);
  return listModels(config);
}

export async function translateEvent({ event, sourceLang, targetLangs, model, tenantId = null }) {
  const config = await getOpenAIConfig(tenantId);
  const t = event.translations;
  const src = mapGet(t, sourceLang);
  if (!src || !src.title) {
    throw new Error(`Source language "${sourceLang}" has no content to translate.`);
  }

  const results = {};
  for (const target of targetLangs) {
    if (target === sourceLang) continue;
    const system =
      'You are a professional translator for a public events calendar. Translate accurately and keep the same tone. Preserve any HTML tags in the description exactly. Respond ONLY with a JSON object: {"title": "...", "descriptionHtml": "..."}.';
    const user = `Translate from ${languageLabel(sourceLang)} to ${languageLabel(target)}.

Title: ${src.title}

DescriptionHTML: ${src.descriptionHtml || ''}`;
    const raw = await chatComplete(config, { model, system, user, temperature: 0.3 });
    results[target] = parseTranslation(raw, src);
  }
  return results;
}

function parseTranslation(raw, fallback) {
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const slice = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(slice);
    return {
      title: parsed.title || fallback.title,
      descriptionHtml: parsed.descriptionHtml || '',
    };
  } catch {
    return { title: raw.slice(0, 200), descriptionHtml: '' };
  }
}

/**
 * Translate a short label (e.g. a category or audience name) into multiple
 * languages. `context` describes what the text represents so the model produces
 * a natural, domain-appropriate label rather than a literal word swap.
 * Returns a map of { [targetLang]: translatedText }.
 */
export async function translateText({
  text,
  sourceLang,
  targetLangs,
  model,
  tenantId = null,
  context = '',
}) {
  const source = (text || '').trim();
  if (!source) return {};
  const config = await getOpenAIConfig(tenantId);

  const results = {};
  for (const target of targetLangs) {
    if (target === sourceLang) continue;
    const system =
      'You are a professional translator for a public events calendar. ' +
      'Translate the given short label accurately and concisely, keeping it natural as a UI label. ' +
      (context ? `Context: ${context} ` : '') +
      'Respond ONLY with a JSON object: {"text": "..."}.';
    const user = `Translate from ${languageLabel(sourceLang)} to ${languageLabel(target)}.

Text: ${source}`;
    const raw = await chatComplete(config, { model, system, user, temperature: 0.3 });
    results[target] = parseLabel(raw, source);
  }
  return results;
}

function parseLabel(raw, fallback) {
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return (parsed.text || '').trim() || fallback;
  } catch {
    return raw.replace(/[{}"]/g, '').trim().slice(0, 120) || fallback;
  }
}

export async function generateMarketing({
  tenantPrompt,
  events,
  language,
  platform,
  audience = '',
  categories = '',
  keywords = '',
  model,
  tenantId = null,
  calendarLink = '',
}) {
  const config = await getOpenAIConfig(tenantId);

  const eventSummaries = events
    .map((ev) => {
      const tr = mapGet(ev.translations, language);
      const title = tr?.title || ev.titleIn(language);
      const desc = stripHtml(tr?.descriptionHtml || '').slice(0, 280);
      const when = ev.startAt ? new Date(ev.startAt).toLocaleString() : '';
      return `- ${title} (${when}): ${desc}`;
    })
    .join('\n');

  const system = tenantPrompt;
  const linkInstruction = calendarLink
    ? `\nA filtered public calendar link is available. Include it naturally as a call-to-action when the message calls for one (e.g. "see all events", "full calendar"). Use this exact URL: ${calendarLink}`
    : '';

  const user = `Write a ${platform} marketing message in ${languageLabel(language)}.
${audience ? `Target audience: ${audience}.` : ''}
${categories ? `Categories: ${categories}.` : ''}
${keywords ? `Keywords to emphasize: ${keywords}.` : ''}
${linkInstruction}

Events to promote:
${eventSummaries || '(no matching events)'}

Make it engaging and appropriate for ${platform}. Keep platform conventions (length, hashtags, emojis where suitable).`;

  return chatComplete(config, { model, system, user, temperature: 0.8 });
}
