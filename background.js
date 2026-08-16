// Minimal MV3 service worker — DevTools handles capture and UI now.
try { console.log('Background service worker loaded — no-op', Date.now()); } catch (e) { }

chrome.runtime.onInstalled.addListener(() => { try { console.log('Extension installed'); } catch (e) { } });
chrome.runtime.onStartup.addListener(() => { try { console.log('Service worker startup'); } catch (e) { } });

// No runtime message handlers — DevTools page is the single source of truth.
// Minimal onMessage handler to acknowledge messages and avoid "Receiving end does not exist" errors
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      // Only acknowledge devtoolsLog messages here. For other actions, let other listeners (e.g. devtools page)
      // handle and respond so we don't short-circuit their responses.
      if (msg && msg.action === 'devtoolsLog') {
        try { console.debug('Notwork(background) received devtoolsLog', msg.msg); } catch (e) { }
        try { sendResponse && sendResponse({ ok: true }); } catch (e) { }
        return true;
      }
      // do not send a response for other messages — allow other contexts to reply
      return false;
    } catch (e) { return false; }
  });
} catch (e) { }
