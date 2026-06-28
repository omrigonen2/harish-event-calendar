// Generic tab switching used across admin pages.
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const container = tab.closest('.card') || document;
  const targetId = tab.dataset.tab;
  container.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
  container.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('is-active', p.id === targetId);
  });
});

// Media uploader (drag & drop + async upload) on the media library page.
(function initUploader() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const form = document.getElementById('uploader');
  const status = document.getElementById('uploadStatus');
  const UI = window.__UI || {};
  const t = (key, vars, fallback) => {
    let text = UI[key] || fallback || key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)); });
    return text;
  };
  if (!dropzone || !fileInput || !form) return;

  dropzone.addEventListener('click', () => fileInput.click());
  ['dragover', 'dragenter'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-drag');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-drag');
    }),
  );
  dropzone.addEventListener('drop', (e) => {
    fileInput.files = e.dataTransfer.files;
    if (status) status.textContent = t('media.filesReady', { count: fileInput.files.length }, `${fileInput.files.length} file(s) ready to upload.`);
  });
  fileInput.addEventListener('change', () => {
    if (status) status.textContent = t('media.filesReady', { count: fileInput.files.length }, `${fileInput.files.length} file(s) ready to upload.`);
  });
})();

// Taxonomy manager: expand/collapse, AI translate, and drag-and-drop reorder.
(function initTaxonomy() {
  const lists = document.querySelectorAll('.tax-list');
  const managers = document.querySelectorAll('.tax-manager');
  if (!lists.length && !managers.length) return;

  const UI = window.__UI || {};
  const t = (key, fallback) => UI[key] || fallback || key;
  const getCsrf = (scope) => {
    const el = (scope || document).querySelector('input[name="_csrf"]');
    return el ? el.value : '';
  };

  // Expand / collapse an item to reveal all languages.
  document.addEventListener('click', (e) => {
    const name = e.target.closest('.tax-item__name');
    if (!name) return;
    const item = name.closest('.tax-item');
    const open = item.classList.toggle('is-open');
    name.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // AI translate from the main language into every other supported language.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tax-translate');
    if (!btn) return;
    const manager = btn.closest('.tax-manager');
    const form = btn.closest('.tax-form');
    if (!manager || !form) return;
    const source = btn.dataset.source;
    const srcInput = form.querySelector(`[data-lang="${source}"]`);
    const text = srcInput ? srcInput.value.trim() : '';
    if (!text) {
      if (srcInput) srcInput.focus();
      return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('taxonomy.translating', 'Translating…');
    try {
      const res = await fetch(manager.dataset.translateUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf(form) },
        body: JSON.stringify({ text, sourceLang: source, kind: manager.dataset.kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      Object.entries(data.results || {}).forEach(([lang, value]) => {
        const input = form.querySelector(`[data-lang="${lang}"]`);
        if (input && value) input.value = value;
      });
    } catch (err) {
      alert(t('taxonomy.translateFailed', 'Translation failed') + (err.message ? `: ${err.message}` : ''));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // Drag-and-drop reordering, persisted to the server.
  lists.forEach((list) => {
    let dragEl = null;
    let timer = null;

    const elementAfter = (y) => {
      const candidates = [...list.querySelectorAll('.tax-item:not(.is-dragging)')];
      return candidates.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) return { offset, element: child };
          return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null },
      ).element;
    };

    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const order = [...list.querySelectorAll('.tax-item')].map((el) => el.dataset.id);
        try {
          await fetch(list.dataset.reorderUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf(document) },
            body: JSON.stringify({ order }),
          });
          list.classList.add('is-saved');
          setTimeout(() => list.classList.remove('is-saved'), 900);
        } catch {
          /* best-effort; order will re-sync on reload */
        }
      }, 350);
    };

    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.tax-item');
      if (!item) return;
      // Don't initiate drag from interactive controls inside an expanded item.
      if (e.target.closest('input, button, textarea, select, .tax-item__body')) {
        e.preventDefault();
        return;
      }
      dragEl = item;
      item.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragover', (e) => {
      if (!dragEl) return;
      e.preventDefault();
      const after = elementAfter(e.clientY);
      if (after == null) list.appendChild(dragEl);
      else list.insertBefore(dragEl, after);
    });

    list.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('is-dragging');
      dragEl = null;
      persist();
    });
  });
})();
