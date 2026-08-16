// devtools.js — runs inside DevTools context when DevTools is open for a tab
// Purpose: read DevTools Network HAR and provide a simple snapshot of failed requests

const devtoolsEntries = [];

function _log(...args) {
  try { console.debug.apply(console, ['Notwork(devtools):'].concat(args)); } catch (e) { }
}
function _forwardLog(...args) {
  try {
    const payload = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a)));
    // use callback to avoid unhandled promise rejections when no receiver exists
    try {
      chrome.runtime.sendMessage({ action: 'devtoolsLog', msg: payload }, () => {
        if (chrome.runtime.lastError) {
          try { console.debug('Notwork(devtools): forwardLog failed', chrome.runtime.lastError.message); } catch (e) { }
        }
      });
    } catch (e) {
      try { console.debug('Notwork(devtools): sendMessage threw', e && e.message); } catch (e) { }
    }
  } catch (e) { }
}

function storeError(entry) {
  try {
    // simple dedupe: avoid pushing exact duplicates
    const key = (entry.url || '') + '|' + (entry.statusCode || '') + '|' + (entry.method || '');
    for (let i = devtoolsEntries.length - 1; i >= 0; i--) {
      const e = devtoolsEntries[i];
      const k = (e.url || '') + '|' + (e.statusCode || '') + '|' + (e.method || '');
      if (k === key) return; // already present
    }
    devtoolsEntries.push(entry);
    if (devtoolsEntries.length > 1000) devtoolsEntries.shift();
  } catch (e) { }
}

// Create panel
try {
  chrome.devtools.panels.create('Log45', '', 'panel.html', panel => {
    try { scanHarAndStore(); } catch (e) { }
    try { panel.onShown.addListener(() => { try { scanHarAndStore(); } catch (e) { } }); } catch (e) { }
  });
} catch (e) { }

function scanHarAndStore() {
  try {
    if (!chrome.devtools || !chrome.devtools.network || !chrome.devtools.network.getHAR) return;
    chrome.devtools.network.getHAR(har => {
      try {
        const entries = (har && har.log && har.log.entries) ? har.log.entries : [];
        _log('getHAR returned', entries.length);
        const now = Date.now();
        for (let i = 0; i < entries.length; i++) {
          try {
            const he = entries[i];
            const resp = he.response || {};
            const status = resp.status || 0;
            if (status >= 400) {
              const entry = {
                url: (he.request && he.request.url) ? he.request.url : null,
                statusCode: status,
                method: (he.request && he.request.method) ? he.request.method : 'GET',
                time: now,
                tabId: null,
                requestId: null,
                payload: null,
                response: (resp.content && typeof resp.content.text === 'string') ? resp.content.text : null
              };
              try { storeError(entry); _log('storeError from HAR', entry.url, entry.statusCode); } catch (err) { }
            }
          } catch (e) { }
        }
      } catch (e) { }
    });
  } catch (e) { }
}

chrome.devtools.network.onRequestFinished.addListener(request => {
  try {
    const resp = request.response || {};
    const status = resp.status || 0;
    if (status >= 400) {
      const entry = {
        url: request.request && request.request.url ? request.request.url : null,
        statusCode: status,
        method: request.request && request.request.method ? request.request.method : 'GET',
        time: Date.now(),
        tabId: null,
        requestId: request.requestId || null,
        payload: (request.request && request.request.postData && request.request.postData.text) ? request.request.postData.text : null,
        response: null
      };
      try {
        request.getContent((body, encoding) => {
          try { entry.response = body || null; } catch (e) { entry.response = null; }
          storeError(entry);
          _log('onRequestFinished captured', entry.url, entry.statusCode);
          _forwardLog('onRequestFinished', entry.url, entry.statusCode);
        });
      } catch (e) { try { storeError(entry); } catch (_) { } }
    }
  } catch (e) { }
});

// Clear entries on navigation
try {
  if (chrome.devtools && chrome.devtools.network && chrome.devtools.network.onNavigated) {
    chrome.devtools.network.onNavigated.addListener(() => {
      try { devtoolsEntries.length = 0; chrome.runtime.sendMessage({ action: 'devtoolsNavigated' }); } catch (e) { }
    });
  }
} catch (e) { }

// Message handler: return a fresh HAR-based snapshot for failed requests
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || !msg.action) return;
      if (msg.action === 'takeSnapshot' || msg.action === 'getSnapshot' || msg.action === 'getDevtoolsEntries') {
        if (!chrome.devtools || !chrome.devtools.network || !chrome.devtools.network.getHAR) {
          _forwardLog('getHAR not available - returning memory');
          try { sendResponse({ ok: true, entries: devtoolsEntries.slice().reverse() }); } catch (_) { }
          return false;
        }
        chrome.devtools.network.getHAR(har => {
          try {
            const harEntries = (har && har.log && har.log.entries) ? har.log.entries : [];
            _forwardLog('getHAR entries count', harEntries.length);
            try {
              // sample first 10 entries for diagnostics
              const diagSample = harEntries.slice(0, 10).map(h => ({ url: (h.request && h.request.url) ? h.request.url : '', status: (h.response && h.response.status) ? h.response.status : 0 }));
              _forwardLog('getHAR sample', JSON.stringify(diagSample));
            } catch (e) { }
            const now = Date.now();
            const snapshot = [];
            for (let i = 0; i < harEntries.length; i++) {
              try {
                const e = harEntries[i];
                const resp = e.response || {};
                const status = resp.status || 0;
                if (status >= 400) {
                  snapshot.push({
                    url: (e.request && e.request.url) ? e.request.url : null,
                    statusCode: status,
                    method: (e.request && e.request.method) ? e.request.method : 'GET',
                    time: now,
                    tabId: null,
                    requestId: null,
                    payload: null,
                    response: (resp.content && typeof resp.content.text === 'string') ? resp.content.text : null
                  });
                }
              } catch (e) { }
            }
            _forwardLog('snapshot returning', snapshot.length);
            try {
              if (snapshot.length === 0) {
                _forwardLog('snapshot empty - devtoolsEntries memory length', devtoolsEntries.length);
                try {
                  const memSample = devtoolsEntries.slice(-5).map(x => ({ url: x.url, status: x.statusCode }));
                  _forwardLog('devtoolsEntries sample', JSON.stringify(memSample));
                } catch (e) { }
              }
            } catch (e) { }
            try {
              if ((!snapshot || snapshot.length === 0) && devtoolsEntries && devtoolsEntries.length > 0) {
                _forwardLog('sending devtoolsEntries fallback', devtoolsEntries.length);
                try { sendResponse({ ok: true, entries: devtoolsEntries.slice().reverse() }); } catch (_) { }
              } else {
                try { sendResponse({ ok: true, entries: snapshot.reverse() }); } catch (_) { }
              }
            } catch (_) { try { sendResponse({ ok: true, entries: devtoolsEntries.slice().reverse() }); } catch (_) { } }
          } catch (e) { try { sendResponse({ ok: true, entries: devtoolsEntries.slice().reverse() }); } catch (_) { } }
        });
        return true;
      }
    } catch (e) { }
  });
} catch (e) { }
