(() => {
  const TOKEN_KEY = 'couch-remote-token';
  const POLL_MS = 3000;

  const byId = (id) => document.getElementById(id);
  const dot = byId('dot');
  const hostEl = byId('host');
  const nowSection = byId('now');
  const nowList = byId('now-list');
  const grid = byId('library');
  const toast = byId('toast');

  let token = readToken();
  let games = [];
  let running = [];
  let toastTimer;

  function readToken() {
    const url = new URL(location.href);
    const fromUrl = url.searchParams.get('pair');
    if (fromUrl) {
      try { localStorage.setItem(TOKEN_KEY, fromUrl); } catch { /* private mode: token lives for this page load only */ }
      url.searchParams.delete('pair');
      history.replaceState(null, '', url.pathname);
      return fromUrl;
    }
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  async function api(path, method = 'GET') {
    const res = await fetch('/api' + path, { method, headers: { 'X-Token': token || '' } });
    if (res.status === 401) { byId('pair').classList.remove('hidden'); throw new Error('not paired'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  function confirm(text) {
    return new Promise((resolve) => {
      byId('confirm-text').textContent = text;
      byId('confirm').classList.remove('hidden');
      const done = (value) => { byId('confirm').classList.add('hidden'); resolve(value); };
      byId('confirm-yes').onclick = () => done(true);
      byId('confirm-no').onclick = () => done(false);
    });
  }

  function elapsed(since) {
    const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function renderNow() {
    nowSection.classList.toggle('hidden', running.length === 0);
    nowList.replaceChildren(...running.map((r) => {
      const row = document.createElement('div');
      row.className = 'now-row';
      const info = document.createElement('div');
      const name = document.createElement('div'); name.className = 'now-name'; name.textContent = r.name;
      const time = document.createElement('div'); time.className = 'now-time'; time.textContent = elapsed(r.since);
      info.append(name, time);
      const btn = document.createElement('button');
      btn.className = 'close-btn'; btn.textContent = 'Close';
      btn.onclick = async () => {
        if (!(await confirm('Force close ' + r.name + '? Unsaved progress is lost.'))) return;
        try { await api('/games/' + encodeURIComponent(r.gameId) + '/kill', 'POST'); showToast('Closed ' + r.name); refresh(); }
        catch (err) { showToast(err.message); }
      };
      row.append(info, btn);
      return row;
    }));
  }

  function renderLibrary() {
    const runningIds = new Set(running.map((r) => r.gameId));
    grid.replaceChildren(...games.map((g) => {
      const card = document.createElement('button');
      card.className = 'game' + (runningIds.has(g.id) ? ' running' : '');
      if (g.cover) {
        const img = document.createElement('img');
        img.className = 'cover'; img.loading = 'lazy'; img.alt = ''; img.src = g.cover;
        img.onerror = () => {
          const header = g.cover.replace('library_600x900.jpg', 'header.jpg');
          if (img.src !== header) img.src = header; else img.replaceWith(placeholder(g.name));
        };
        card.append(img);
      } else {
        card.append(placeholder(g.name));
      }
      const name = document.createElement('div'); name.className = 'game-name'; name.textContent = g.name;
      card.append(name);
      if (runningIds.has(g.id)) { const b = document.createElement('span'); b.className = 'badge'; b.textContent = 'ON'; card.append(b); }
      card.onclick = async () => {
        try { await api('/games/' + encodeURIComponent(g.id) + '/launch', 'POST'); showToast('Starting ' + g.name + '...'); }
        catch (err) { showToast(err.message); }
      };
      return card;
    }));
  }

  function placeholder(name) {
    const el = document.createElement('div');
    el.className = 'cover placeholder';
    el.textContent = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return el;
  }

  async function refresh() {
    try {
      const status = await api('/status');
      running = status.running;
      hostEl.textContent = status.host;
      dot.className = 'dot online';
      if (games.length !== status.gameCount) games = await api('/games');
      renderLibrary();
      renderNow();
    } catch (err) {
      if (err.message !== 'not paired') { dot.className = 'dot offline'; hostEl.textContent = 'PC unreachable'; }
    }
  }

  byId('rescan').onclick = async () => {
    try { const r = await api('/library/rescan', 'POST'); games = []; showToast(r.gameCount + ' games'); refresh(); }
    catch (err) { showToast(err.message); }
  };

  document.querySelectorAll('.power-btn').forEach((btn) => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      const label = action === 'sleep' ? 'Put the PC to sleep?' : 'Shut the PC down?';
      if (!(await confirm(label))) return;
      try { await api('/power/' + action, 'POST'); showToast(action === 'sleep' ? 'Sleeping...' : 'Shutting down...'); }
      catch (err) { showToast(err.message); }
    };
  });

  if (!token) byId('pair').classList.remove('hidden');
  refresh();
  setInterval(refresh, POLL_MS);
  setInterval(renderNow, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  // Service workers need a secure context; a plain http://192.168.x.x page does not get one.
  if (window.isSecureContext && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
