// panel.js — runs in the DevTools panel
const listBtn = document.getElementById('listBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const diagEl = document.getElementById('diag');

function dedupeEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    try {
      const key = (e.url || '') + '|' + (e.statusCode || '') + '|' + (e.method || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    } catch (err) { }
  }
  return out;
}

// Receive small forwarded logs from devtools context so user can see them in panel console
try {
  chrome.runtime.onMessage.addListener((msg, sender) => {
    try {
      if (msg && msg.action === 'devtoolsNavigated') {
        console.debug('Notwork(panel): received devtoolsNavigated, clearing UI');
        clearErrors();
        return;
      }
      if (msg && msg.action === 'devtoolsLog') {
        try {
          const text = (msg.msg || []).join(' ');
          console.debug('Notwork(devtools):', text);
          appendDiag('DEVTOOLS: ' + text);
        } catch (e) { }
        return;
      }
    } catch (e) { }
  });
} catch (e) { }

function appendDiag(line) {
  try {
    if (!diagEl) return;
    const t = new Date().toISOString();
    const el = document.createElement('div');
    el.textContent = `[${t}] ${line}`;
    diagEl.appendChild(el);
    diagEl.scrollTop = diagEl.scrollHeight;
  } catch (e) { }
}

listBtn.addEventListener('click', snapshotAndList);
clearBtn.addEventListener('click', clearErrors);

function render(errors) {
  results.innerHTML = '';
  showLoading(false);
  if (!errors || errors.length === 0) {
    results.textContent = 'Hatalı istek tespit edilemedi';
    return;
  }
  errors.forEach(e => {
    const div = document.createElement('div');
    div.className = 'item';
    const pre = document.createElement('pre');
    pre.textContent = formatEntry(e);
    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = '#666';
    meta.textContent = new Date(e.time).toLocaleString();
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Kopyala';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent).then(() => { copyBtn.textContent = 'Kopyalandı'; setTimeout(() => copyBtn.textContent = 'Kopyala', 1000); });
    });
    div.appendChild(meta);
    div.appendChild(pre);
    div.appendChild(copyBtn);
    results.appendChild(div);
  });
}

function prettyPrintValue(val, indent = 2) {
  const pad = n => ' '.repeat(n);
  const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
  if (typeof val === 'string') {
    const s = val.trim();
    if ((s.startsWith('{') || s.startsWith('['))) {
      try { const parsed = JSON.parse(s); return prettyPrintValue(parsed, indent); } catch (e) { return JSON.stringify(val); }
    }
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.map(item => prettyPrintValue(item, indent + 2));
    return '[\n' + items.map(it => pad(indent) + it).join(',\n') + '\n' + pad(indent - 2) + ']';
  }
  if (isObject(val)) {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    const lines = keys.map(k => { const v = val[k]; return pad(indent) + k + ': ' + prettyPrintValue(v, indent + 2); });
    return '{\n' + lines.join(',\n') + '\n' + pad(indent - 2) + '}';
  }
  if (val === null) return 'null';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return JSON.stringify(val);
}

function formatEntry(e) {
  let payload = e.payload;
  try { payload = typeof payload === 'string' ? payload : JSON.stringify(payload); } catch (err) { }
  let formattedResponse = '';
  try {
    if (typeof e.response === 'string') {
      const s = e.response.trim();
      if (s.startsWith('{') || s.startsWith('[')) {
        try { const parsed = JSON.parse(s); formattedResponse = prettyPrintValue(parsed, 2); } catch (err) { formattedResponse = e.response; }
      } else formattedResponse = e.response;
    } else if (e.response && typeof e.response === 'object') formattedResponse = prettyPrintValue(e.response, 2);
    else formattedResponse = e.response || '';
  } catch (err) { formattedResponse = String(e.response); }
  // parse query params from URL and pretty-print with proper types
  function parseQueryParams(url) {
    try {
      const u = new URL(url);
      const obj = {};
      for (const [k, v] of u.searchParams.entries()) {
        if (/^(?:true|false)$/i.test(v)) obj[k] = v.toLowerCase() === 'true';
        else if (/^-?\d+(?:\.\d+)?$/.test(v)) obj[k] = Number(v);
        else obj[k] = v;
      }
      return Object.keys(obj).length ? obj : null;
    } catch (e) { return null; }
  }

  const qp = parseQueryParams(e.url);
  const qpBlock = qp ? '\nqueryParams: ' + prettyPrintValue(qp, 2) : '';

  return `Request URL : ${e.url}\nStatus Code: ${e.statusCode}\npayload: ${payload || ''}${qpBlock}\nResponse: ${formattedResponse}`;
}

function snapshotAndList() {
  results.innerHTML = '';
  showLoading(true, 'Anlık HAR alınıyor…');
  // sendMessageWithRetry will attempt to send and handle transient errors
  sendMessageWithRetry({ action: 'getSnapshot' }, (err, res) => {
    showLoading(false);
    if (err) {
      results.textContent = err.message || String(err);
      return;
    }
    try {
      const resultsArr = res && res.entries ? res.entries : [];
      render(dedupeEntries(resultsArr || []));
    } catch (e) { render([]); }
  });
}

function sendMessageWithRetry(msg, cb, retries = 3, delay = 500) {
  let attempts = 0;
  function attempt() {
    attempts++;
    try {
      chrome.runtime.sendMessage(msg, res => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError && chrome.runtime.lastError.message || '';
          console.debug('Notwork(panel): runtime.lastError:', errMsg);
          if (/Extension context invalidated/i.test(errMsg)) {
            if (attempts < retries) {
              setTimeout(attempt, delay);
              return;
            }
            cb(new Error('Extension context invalidated. Lütfen uzantıyı yeniden yükleyin ve DevTools penceresini kapatıp tekrar açın.'));
            return;
          }
          // other runtime error
          cb(new Error('Hata: ' + errMsg));
          return;
        }
        cb(null, res);
      });
    } catch (e) {
      console.debug('Notwork(panel): sendMessage threw:', e && e.message);
      if (/(Extension context invalidated)/i.test(e && e.message || '')) {
        if (attempts < retries) {
          setTimeout(attempt, delay);
          return;
        }
        cb(new Error('Extension context invalidated. Lütfen uzantıyı yeniden yükleyin ve DevTools penceresini kapatıp tekrar açın.'));
        return;
      }
      if (attempts < retries) {
        setTimeout(attempt, delay);
        return;
      }
      cb(e);
    }
  }
  attempt();
}

function clearErrors() {
  try { results.innerHTML = ''; } catch (e) { }
}

function showLoading(on, text) {
  try {
    if (!loadingEl) return;
    if (on) {
      loadingEl.classList.add('active');
      if (text) loadingText.textContent = text;
    } else {
      loadingEl.classList.remove('active');
      if (text) loadingText.textContent = text;
    }
  } catch (e) { }
}
