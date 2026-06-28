(function () {
  const viewMap = {
    month: 'dayGridMonth',
    week: 'timeGridWeek',
    day: 'timeGridDay',
  };

  let calendarInstance = null;

  function initFullCalendar() {
    const el = document.getElementById('calendar');
    if (!el || typeof FullCalendar === 'undefined') return;

    if (calendarInstance) {
      calendarInstance.destroy();
      calendarInstance = null;
    }

    let events = [];
    try {
      events = JSON.parse(el.dataset.events.replace(/&#39;/g, "'"));
    } catch {
      events = [];
    }

    const eventMeta = new Map(events.map((e) => [e.id, e]));

    const lang = el.dataset.lang || 'he';
    const isRtl = el.dataset.dir === 'rtl';

    const buttonText = lang === 'he'
      ? { today: 'היום', month: 'חודש', week: 'שבוע', day: 'יום', list: 'רשימה' }
      : { today: 'today', month: 'month', week: 'week', day: 'day', list: 'list' };

    calendarInstance = new FullCalendar.Calendar(el, {
      initialView: viewMap[el.dataset.view] || 'dayGridMonth',
      direction: isRtl ? 'rtl' : 'ltr',
      locale: lang === 'he' ? 'he' : undefined,
      buttonText,
      headerToolbar: { start: 'prev,next today', center: 'title', end: '' },
      height: 'auto',
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        url: e.url,
        backgroundColor: e.category,
        borderColor: e.category,
      })),
      eventContent(arg) {
        const meta = eventMeta.get(arg.event.id);
        const wrap = document.createElement('div');
        wrap.className = 'fc-event-custom';

        if (meta?.characters?.length) {
          const badge = document.createElement('span');
          badge.className = 'fc-event-character';
          badge.textContent = meta.characters.join(' · ');
          wrap.appendChild(badge);
        }

        const title = document.createElement('span');
        title.className = 'fc-event-title';
        title.textContent = arg.event.title;
        wrap.appendChild(title);

        return { domNodes: [wrap] };
      },
    });
    calendarInstance.render();
  }

  function buildFilterParams(form) {
    const params = new URLSearchParams(new FormData(form));
    params.delete('partial');
    for (const [key, value] of [...params.entries()]) {
      if (!value) params.delete(key);
    }
    return params;
  }

  async function applyFilters(form, dynamic) {
    const params = buildFilterParams(form);
    params.set('partial', '1');
    dynamic.classList.add('is-loading');

    try {
      const res = await fetch(`${form.action}?${params.toString()}`, {
        headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) throw new Error('Filter request failed');
      dynamic.innerHTML = await res.text();
      params.delete('partial');
      const qs = params.toString();
      history.replaceState(null, '', qs ? `${form.action}?${qs}` : form.action);
      initFullCalendar();
    } catch {
      form.submit();
    } finally {
      dynamic.classList.remove('is-loading');
    }
  }

  function initFilters() {
    const form = document.getElementById('publicFilters');
    const dynamic = document.getElementById('calendarDynamic');
    if (!form || !dynamic) return;

    let debounceTimer;

    form.querySelectorAll('select').forEach((el) => {
      el.addEventListener('change', () => applyFilters(form, dynamic));
    });

    const search = form.querySelector('[name="q"]');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applyFilters(form, dynamic), 350);
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters(form, dynamic);
    });
  }

  initFullCalendar();
  initFilters();
})();
