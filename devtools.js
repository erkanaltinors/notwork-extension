// devtools.js

// Sadece hatalı (400 ve 500) istekleri hafızada tutacağımız dizi
let failedRequests = [];

// Paneli oluştur
chrome.devtools.panels.create('Log45', '', 'panel.html', panel => { });

// Sayfa yenilendiğinde (navigation) eski hata listesini temizle
chrome.devtools.network.onNavigated.addListener(() => {
  failedRequests = [];
});

// AĞ İSTEKLERİNİ DİNLEME: Tüm istekleri eksiksiz yakalamanın en güvenilir yolu
chrome.devtools.network.onRequestFinished.addListener(request => {
  const status = request.response?.status || 0;

  // Sadece 400 ve 500 hatalarını yakala
  if (status >= 400) {
    const entry = {
      url: request.request?.url || null,
      statusCode: status,
      method: request.request?.method || 'GET',
      time: Date.now(),
      payload: request.request?.postData?.text || null,
      response: null // Yanıt içeriğini (body) aşağıda asenkron alacağız
    };

    // İstek hatalıysa içeriğini (response body) çek ve listeye ekle
    request.getContent((body) => {
      entry.response = body || null;
      failedRequests.push(entry);

      // Bellek şişmesini önlemek için sadece son 1000 hatayı tut
      if (failedRequests.length > 1000) {
        failedRequests.shift();
      }
    });
  }
});

// panel.js'den (arayüzden) gelen "Listele" butonu tetiklemesini dinle
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'getSnapshot' || msg?.action === 'takeSnapshot') {
    // Arayüze veriyi gönder (En yeni istek en üstte olsun diye kopyasını ters çeviriyoruz)
    sendResponse({ ok: true, entries: [...failedRequests].reverse() });

    // Asenkron yanıt döndüreceğimizi belirtmek için true döndürüyoruz
    return true;
  }
});