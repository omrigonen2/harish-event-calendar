import {
  EVENT_COVER_TARGET_WIDTH,
  EVENT_COVER_TARGET_HEIGHT,
  EVENT_COVER_TARGET_RATIO,
  EVENT_COVER_ASPECT_TOLERANCE,
  DEFAULT_EVENT_COVER_ASPECT_PROMPT,
} from '../config/eventCover.js';

function roundRatio(n) {
  return Math.round(n * 100) / 100;
}

export function resolveEventCoverSettings(platformMedia = {}) {
  return {
    targetWidth: platformMedia.eventCoverTargetWidth || EVENT_COVER_TARGET_WIDTH,
    targetHeight: platformMedia.eventCoverTargetHeight || EVENT_COVER_TARGET_HEIGHT,
    aspectTolerance: platformMedia.eventCoverAspectTolerance ?? EVENT_COVER_ASPECT_TOLERANCE,
    aspectPrompt: platformMedia.eventCoverAspectPrompt?.trim() || DEFAULT_EVENT_COVER_ASPECT_PROMPT,
  };
}

export function targetRatio(settings) {
  return settings.targetWidth / settings.targetHeight;
}

export function checkEventCoverAspect(width, height, settings) {
  if (!width || !height) {
    return { ok: true, width: 0, height: 0, ratio: 0, targetRatio: targetRatio(settings) };
  }

  const ratio = width / height;
  const desired = targetRatio(settings);
  const delta = Math.abs(ratio - desired) / desired;
  const ok = delta <= settings.aspectTolerance;

  let orientation = 'landscape';
  if (Math.abs(ratio - 1) < 0.05) orientation = 'square';
  else if (ratio < 1) orientation = 'portrait';

  return {
    ok,
    width,
    height,
    ratio: roundRatio(ratio),
    targetRatio: roundRatio(desired),
    targetWidth: settings.targetWidth,
    targetHeight: settings.targetHeight,
    orientation,
    delta: roundRatio(delta),
  };
}

export function fillEventCoverPrompt(template, aspect, settings) {
  const desired = targetRatio(settings);
  const vars = {
    width: String(aspect.width),
    height: String(aspect.height),
    ratio: String(aspect.ratio),
    targetWidth: String(settings.targetWidth),
    targetHeight: String(settings.targetHeight),
    targetRatio: String(roundRatio(desired)),
    orientation: aspect.orientation,
  };
  let text = template;
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return text;
}

export function buildAspectSuggestion(aspect, settings) {
  if (aspect.ok) return null;
  return {
    width: aspect.width,
    height: aspect.height,
    ratio: aspect.ratio,
    targetWidth: settings.targetWidth,
    targetHeight: settings.targetHeight,
    targetRatio: aspect.targetRatio,
    orientation: aspect.orientation,
    aiPrompt: fillEventCoverPrompt(settings.aspectPrompt, aspect, settings),
  };
}
