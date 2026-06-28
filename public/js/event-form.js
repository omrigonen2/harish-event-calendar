(function () {

  const form = document.getElementById('eventForm');

  if (!form) return;



  const UI = window.__UI || {};

  const t = (key, fallback) => UI[key] || fallback || key;



  const editors = {};

  document.querySelectorAll('.quill').forEach((el) => {

    const lang = el.dataset.lang;

    const editor = new Quill(el, {

      theme: 'snow',

      modules: {

        toolbar: [

          [{ header: [1, 2, 3, false] }],

          ['bold', 'italic', 'underline', 'strike'],

          [{ list: 'ordered' }, { list: 'bullet' }],

          ['link', 'image'],

          ['clean'],

        ],

      },

    });

    editors[lang] = editor;

    const source = el.parentElement.querySelector('.quill-source');

    editor.on('text-change', () => {

      source.value = editor.root.innerHTML;

    });

  });



  form.addEventListener('submit', () => {

    Object.keys(editors).forEach((lang) => {

      const panel = document.getElementById('lang-' + lang);

      const source = panel.querySelector('.quill-source');

      if (source) source.value = editors[lang].root.innerHTML;

    });

  });



  const clearCover = document.getElementById('clearCover');

  if (clearCover) {

    clearCover.addEventListener('click', () => {

      document.getElementById('coverMediaId').value = '';

      document.getElementById('coverPreview').innerHTML = `<span class="muted">${t('events.noImage', 'No image selected')}</span>`;

    });

  }



  const modal = document.getElementById('pickerModal');

  const grid = document.getElementById('pickerGrid');

  const closeBtn = document.getElementById('pickerClose');

  const uploadInput = document.getElementById('pickerUploadInput');

  const uploadStatus = document.getElementById('pickerUploadStatus');

  const pickerAspectWarnings = document.getElementById('pickerAspectWarnings');

  const pickerUrl = form.dataset.pickerUrl;

  const uploadUrl = form.dataset.uploadUrl;

  let pickerTarget = null;



  function renderPickerItems(items) {

    grid.innerHTML = '';

    if (!items.length) {

      grid.innerHTML = `<p class="muted">${t('media.noImagesPicker', 'No images.')}</p>`;

      return;

    }

    items.forEach((item) => {

      const img = document.createElement('img');

      img.src = item.url;

      img.alt = item.filename;

      img.addEventListener('click', () => selectImage(item));

      grid.appendChild(img);

    });

  }



  async function loadPicker() {

    grid.innerHTML = `<p class="muted">${t('common.loading', 'Loading...')}</p>`;

    try {

      const res = await fetch(pickerUrl, { headers: { Accept: 'application/json' } });

      const data = await res.json();

      renderPickerItems(data.items || []);

    } catch {

      grid.innerHTML = `<p class="flash flash--error">${t('picker.uploadFailed', 'Could not load images.')}</p>`;

    }

  }



  document.querySelectorAll('[data-picker]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      pickerTarget = btn.dataset.picker;

      modal.hidden = false;

      await loadPicker();

    });

  });



  if (uploadInput) {

    uploadInput.addEventListener('change', async () => {

      const file = uploadInput.files?.[0];

      if (!file) return;

      uploadStatus.textContent = t('common.loading', 'Loading...');
      if (window.renderAspectWarnings) window.renderAspectWarnings(pickerAspectWarnings, []);

      const fd = new FormData();

      fd.append('files', file);

      fd.append('_csrf', getCsrf());

      try {

        const res = await fetch(uploadUrl, {

          method: 'POST',

          headers: { Accept: 'application/json', 'X-CSRF-Token': getCsrf() },

          body: fd,

        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.error || t('picker.uploadError', 'Upload failed.'));

        uploadStatus.textContent = t('picker.uploadSuccess', 'Image uploaded.');

        if (data.aspectWarnings?.length && window.renderAspectWarnings) {
          window.renderAspectWarnings(pickerAspectWarnings, data.aspectWarnings);
        }

        if (data.items?.length) {

          selectImage(data.items[0]);

        } else {

          await loadPicker();

        }

      } catch (err) {

        uploadStatus.textContent = err.message;

      } finally {

        uploadInput.value = '';

      }

    });

  }



  function selectImage(item) {

    if (pickerTarget === 'cover') {

      document.getElementById('coverMediaId').value = item.id;

      document.getElementById('coverPreview').innerHTML = `<img src="${item.url}" alt="cover">`;

    }

    modal.hidden = true;

    if (uploadStatus) uploadStatus.textContent = '';
    if (window.renderAspectWarnings) window.renderAspectWarnings(pickerAspectWarnings, []);

  }



  if (closeBtn) closeBtn.addEventListener('click', () => (modal.hidden = true));

  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });



  const aiBtn = document.getElementById('aiTranslateBtn');

  const aiSource = document.getElementById('aiSource');



  function syncTargetChoices() {

    if (!aiSource) return;

    const source = aiSource.value;

    document.querySelectorAll('.ai-target-row').forEach((row) => {

      const code = row.dataset.lang;

      const input = row.querySelector('.ai-target');

      const hide = code === source;

      row.hidden = hide;

      if (hide && input) input.checked = false;

    });

  }



  if (aiSource) {

    aiSource.addEventListener('change', syncTargetChoices);

    syncTargetChoices();

  }



  if (aiBtn) {

    aiBtn.addEventListener('click', async () => {

      const source = document.getElementById('aiSource').value;

      const targets = Array.from(document.querySelectorAll('.ai-target:checked')).map((c) => c.value);

      const preview = document.getElementById('aiPreview');

      if (!targets.length) {

        preview.innerHTML = `<p class="flash flash--error">${t('events.aiSelectTarget', 'Select at least one target language.')}</p>`;

        return;

      }

      aiBtn.disabled = true;

      aiBtn.textContent = t('events.aiTranslating', 'Translating...');

      preview.innerHTML = `<p class="muted">${t('events.aiTranslating', 'Translating...')}</p>`;

      try {

        const res = await fetch(aiBtn.dataset.url, {

          method: 'POST',

          credentials: 'same-origin',

          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },

          body: JSON.stringify({ sourceLang: source, targetLangs: targets }),

        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.error || t('events.aiTranslationFailed', null, 'Translation failed'));

        renderPreview(data.results);

      } catch (err) {

        preview.innerHTML = `<p class="flash flash--error">${err.message}</p>`;

      } finally {

        aiBtn.disabled = false;

        aiBtn.textContent = t('events.aiGenerate', 'Generate translations');

      }

    });

  }



  function renderPreview(results) {

    const preview = document.getElementById('aiPreview');

    preview.innerHTML = '';

    Object.keys(results).forEach((lang) => {

      const r = results[lang];

      const wrap = document.createElement('div');

      wrap.className = 'ai-preview__item';

      wrap.innerHTML = `

        <strong>${lang.toUpperCase()}</strong>

        <label class="field"><span>${t('events.titleField', 'Title')}</span><input type="text" class="ai-title" data-lang="${lang}" value="${escapeAttr(r.title || '')}"></label>

        <label class="field"><span>${t('events.description', 'Description')}</span><textarea class="ai-desc" data-lang="${lang}" rows="5">${escapeText(r.descriptionHtml || '')}</textarea></label>

      `;

      preview.appendChild(wrap);

    });

    const saveBtn = document.createElement('button');

    saveBtn.type = 'button';

    saveBtn.className = 'btn btn--primary';

    saveBtn.textContent = t('events.aiApplySave', 'Apply & save translations');

    saveBtn.addEventListener('click', saveTranslations);

    preview.appendChild(saveBtn);

  }



  async function saveTranslations() {

    const translations = {};

    document.querySelectorAll('.ai-title').forEach((el) => {

      const lang = el.dataset.lang;

      translations[lang] = translations[lang] || {};

      translations[lang].title = el.value;

    });

    document.querySelectorAll('.ai-desc').forEach((el) => {

      const lang = el.dataset.lang;

      translations[lang] = translations[lang] || {};

      translations[lang].descriptionHtml = el.value;

    });

    const preview = document.getElementById('aiPreview');

    try {

      const res = await fetch(aiBtn.dataset.save, {

        method: 'POST',

        credentials: 'same-origin',

        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },

        body: JSON.stringify({ translations }),

      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || t('events.aiSaveFailed', 'Save failed'));

      Object.keys(translations).forEach((lang) => {

        const titleInput = form.querySelector(`input[name="translations[${lang}][title]"]`);

        if (titleInput) titleInput.value = translations[lang].title || '';

        const panel = document.getElementById('lang-' + lang);

        const source = panel?.querySelector('.quill-source');

        if (source) source.value = translations[lang].descriptionHtml || '';

        if (editors[lang]) {

          editors[lang].root.innerHTML = translations[lang].descriptionHtml || '';

        }

        const tab = document.querySelector(`.tab[data-tab="lang-${lang}"]`);

        if (tab) tab.click();

      });

      preview.innerHTML = `<p class="flash flash--success">${t('events.aiSaved', 'Translations saved')} (${(data.saved || Object.keys(translations)).join(', ')}).</p>`;

    } catch (err) {

      preview.innerHTML = `<p class="flash flash--error">${err.message}</p>`;

    }

  }



  function getCsrf() {

    const el = form.querySelector('input[name="_csrf"]');

    return el ? el.value : '';

  }

  function escapeAttr(s) {

    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

  }

  function escapeText(s) {

    return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  }

})();

