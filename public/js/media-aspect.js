(function initMediaAspect() {
  const UI = window.__UI || {};

  function t(key, vars, fallback) {
    let text = UI[key] || fallback || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }

  function buildWarningPanel(w) {
    const panel = document.createElement('div');
    panel.className = 'aspect-warning';

    const title = document.createElement('p');
    title.className = 'aspect-warning__title';
    title.textContent = t(
      'media.aspectWarningTitle',
      {
        filename: w.filename || '',
        size: `${w.width}×${w.height}`,
        target: `${w.targetWidth}×${w.targetHeight}`,
      },
      `Image is ${w.width}×${w.height} — recommended ${w.targetWidth}×${w.targetHeight} (16:9).`,
    );

    const hint = document.createElement('p');
    hint.className = 'muted sm aspect-warning__hint';
    hint.textContent = t(
      'media.aspectWarningHint',
      {},
      'Use an AI image tool with the prompt below to extend the canvas without changing existing content.',
    );

    const prompt = document.createElement('textarea');
    prompt.className = 'aspect-warning__prompt';
    prompt.readOnly = true;
    prompt.rows = 8;
    prompt.value = w.aiPrompt || '';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--sm btn--secondary aspect-warning__copy';
    copyBtn.textContent = t('media.copyAiPrompt', {}, 'Copy AI prompt');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(w.aiPrompt || '');
        copyBtn.textContent = t('media.promptCopied', {}, 'Copied!');
        setTimeout(() => {
          copyBtn.textContent = t('media.copyAiPrompt', {}, 'Copy AI prompt');
        }, 2000);
      } catch {
        prompt.select();
        document.execCommand('copy');
      }
    });

    panel.append(title, hint, prompt, copyBtn);
    return panel;
  }

  window.renderAspectWarnings = function renderAspectWarnings(container, warnings) {
    if (!container) return;
    container.innerHTML = '';
    if (!warnings?.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    warnings.forEach((w) => container.appendChild(buildWarningPanel(w)));
  };
})();
