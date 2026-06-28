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

  async function postJson(url, csrf, body = {}) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf || '',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t('media.aspectFixFailed', {}, 'Could not fix image.'));
    return data;
  }

  function hideContainer(container) {
    if (!container?.children.length) container.hidden = true;
  }

  let aiLoaderCount = 0;
  let aiLoaderEl = null;

  function ensureAiLoader() {
    if (aiLoaderEl) return aiLoaderEl;
    aiLoaderEl = document.createElement('div');
    aiLoaderEl.className = 'ai-aspect-loader';
    aiLoaderEl.hidden = true;
    aiLoaderEl.setAttribute('role', 'alertdialog');
    aiLoaderEl.setAttribute('aria-modal', 'true');
    aiLoaderEl.setAttribute('aria-busy', 'true');
    aiLoaderEl.innerHTML = `
      <div class="ai-aspect-loader__box">
        <div class="ai-aspect-loader__spinner" aria-hidden="true"></div>
        <p class="ai-aspect-loader__text"></p>
      </div>
    `;
    document.body.appendChild(aiLoaderEl);
    return aiLoaderEl;
  }

  function showAiLoader(message) {
    const el = ensureAiLoader();
    el.querySelector('.ai-aspect-loader__text').textContent = message
      || t('media.fixingAspect', {}, 'Fixing with AI...');
    aiLoaderCount += 1;
    el.hidden = false;
    document.body.classList.add('ai-aspect-loader-open');
  }

  function hideAiLoader() {
    aiLoaderCount = Math.max(0, aiLoaderCount - 1);
    if (aiLoaderCount === 0 && aiLoaderEl) {
      aiLoaderEl.hidden = true;
      document.body.classList.remove('ai-aspect-loader-open');
    }
  }

  async function withAiLoader(task, message) {
    showAiLoader(message);
    try {
      return await task();
    } finally {
      hideAiLoader();
    }
  }

  function buildImageCard(label, item) {
    const card = document.createElement('div');
    card.className = 'aspect-compare__card';
    const heading = document.createElement('p');
    heading.className = 'aspect-compare__label';
    heading.textContent = label;
    const img = document.createElement('img');
    img.className = 'aspect-compare__img';
    img.src = item.url;
    img.alt = item.filename || label;
    const meta = document.createElement('p');
    meta.className = 'muted sm';
    meta.textContent = `${item.width}×${item.height}`;
    card.append(heading, img, meta);
    return card;
  }

  function buildComparisonPanel(w, data, options) {
    const panel = document.createElement('div');
    panel.className = 'aspect-warning aspect-warning--compare';

    const title = document.createElement('p');
    title.className = 'aspect-warning__title';
    title.textContent = t('media.aspectCompareTitle', {}, 'Compare original and AI edit');

    const compare = document.createElement('div');
    compare.className = 'aspect-compare';
    compare.append(
      buildImageCard(t('media.originalImage', {}, 'Original'), data.original),
      buildImageCard(t('media.editedImage', {}, 'AI edit'), data.preview),
    );

    const actions = document.createElement('div');
    actions.className = 'aspect-warning__actions';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn btn--sm btn--primary';
    useBtn.textContent = t('media.useEdited', {}, 'Use AI edit');

    const keepBtn = document.createElement('button');
    keepBtn.type = 'button';
    keepBtn.className = 'btn btn--sm btn--ghost';
    keepBtn.textContent = t('media.keepOriginal', {}, 'Keep original');

    const remakeWrap = document.createElement('div');
    remakeWrap.className = 'aspect-remake';
    const remakeLabel = document.createElement('label');
    remakeLabel.className = 'field';
    remakeLabel.innerHTML = `<span>${t('media.remakeComment', {}, 'Remake with instructions')}</span>`;
    const commentInput = document.createElement('textarea');
    commentInput.className = 'aspect-remake__comment';
    commentInput.rows = 2;
    commentInput.placeholder = t('media.remakePlaceholder', {}, 'Describe what to change in the extension…');
    remakeLabel.appendChild(commentInput);
    const remakeBtn = document.createElement('button');
    remakeBtn.type = 'button';
    remakeBtn.className = 'btn btn--sm btn--secondary';
    remakeBtn.textContent = t('media.remakeWithAi', {}, 'Remake');
    remakeWrap.append(remakeLabel, remakeBtn);

    let previewId = data.previewId;

    async function setBusy(busy, message) {
      useBtn.disabled = busy;
      keepBtn.disabled = busy;
      remakeBtn.disabled = busy;
      commentInput.disabled = busy;
      if (busy && message) remakeBtn.textContent = message;
      else if (!busy) remakeBtn.textContent = t('media.remakeWithAi', {}, 'Remake');
    }

    useBtn.addEventListener('click', async () => {
      await setBusy(true);
      try {
        const applied = await postJson(
          `${options.fixBaseUrl}/${w.mediaId}/fix-aspect/apply`,
          options.csrf,
          { previewId },
        );
        panel.remove();
        hideContainer(options.container);
        if (typeof options.onFixed === 'function') options.onFixed(applied.item, w);
      } catch (err) {
        alert(err.message);
        await setBusy(false);
      }
    });

    keepBtn.addEventListener('click', async () => {
      await setBusy(true);
      try {
        await postJson(
          `${options.fixBaseUrl}/${w.mediaId}/fix-aspect/discard`,
          options.csrf,
          { previewId },
        );
        panel.remove();
        hideContainer(options.container);
        if (typeof options.onDismiss === 'function') options.onDismiss(w);
      } catch (err) {
        alert(err.message);
        await setBusy(false);
      }
    });

    remakeBtn.addEventListener('click', async () => {
      await setBusy(true);
      try {
        const next = await withAiLoader(
          () => postJson(
            `${options.fixBaseUrl}/${w.mediaId}/fix-aspect/preview`,
            options.csrf,
            { previewId, comment: commentInput.value },
          ),
          t('media.fixingAspect', {}, 'Fixing with AI...'),
        );
        previewId = next.previewId;
        compare.innerHTML = '';
        compare.append(
          buildImageCard(t('media.originalImage', {}, 'Original'), next.original),
          buildImageCard(t('media.editedImage', {}, 'AI edit'), next.preview),
        );
        commentInput.value = '';
      } catch (err) {
        alert(err.message);
      } finally {
        await setBusy(false);
      }
    });

    actions.append(useBtn, keepBtn);
    panel.append(title, compare, actions, remakeWrap);
    return panel;
  }

  function buildWarningPanel(w, options = {}) {
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
      'This image is not 16:9. AI can extend the canvas — you will compare the result before choosing.',
    );

    const actions = document.createElement('div');
    actions.className = 'aspect-warning__actions';

    const fixBtn = document.createElement('button');
    fixBtn.type = 'button';
    fixBtn.className = 'btn btn--sm btn--primary aspect-warning__fix';
    fixBtn.textContent = t('media.fixWithAi', {}, 'Fix with AI');

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn btn--sm btn--ghost aspect-warning__dismiss';
    dismissBtn.textContent = t('media.keepOriginal', {}, 'Keep original');

    dismissBtn.addEventListener('click', () => {
      panel.remove();
      hideContainer(options.container);
      if (typeof options.onDismiss === 'function') options.onDismiss(w);
    });

    fixBtn.addEventListener('click', async () => {
      if (!options.fixBaseUrl || !w.mediaId) return;
      fixBtn.disabled = true;
      dismissBtn.disabled = true;
      try {
        const data = await withAiLoader(
          () => postJson(
            `${options.fixBaseUrl}/${w.mediaId}/fix-aspect/preview`,
            options.csrf,
          ),
          t('media.fixingAspect', {}, 'Fixing with AI...'),
        );
        const comparePanel = buildComparisonPanel(w, data, options);
        panel.replaceWith(comparePanel);
      } catch (err) {
        fixBtn.disabled = false;
        dismissBtn.disabled = false;
        alert(err.message);
      }
    });

    actions.append(fixBtn, dismissBtn);
    panel.append(title, hint, actions);
    return panel;
  }

  window.renderAspectWarnings = function renderAspectWarnings(container, warnings, options = {}) {
    if (!container) return;
    container.innerHTML = '';
    if (!warnings?.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const merged = {
      ...options,
      container,
      fixBaseUrl: options.fixBaseUrl || container.dataset.fixBase || '',
      csrf: options.csrf || container.dataset.csrf || '',
    };
    warnings.forEach((w) => container.appendChild(buildWarningPanel(w, merged)));
  };
})();
