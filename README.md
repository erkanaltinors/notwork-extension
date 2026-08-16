# Notwork - Hatalı Network İstekleri (DevTools paneli)

Basit bir DevTools paneli uzantısıdır; hatalı (HTTP >=400) istekleri DevTools Network verisinden okur ve istek/yanıt içeriğini istenen formatta panoya kopyalamanızı sağlar.

Kurulum

1. Chrome'da `chrome://extensions/` sayfasını açın.
2. Sağ üstten "Developer mode" açıkken "Load unpacked" ile proje klasörünü seçin.
3. Bir sekmede geliştirici araçlarını açın (F12 veya sağ tık → Inspect).
4. Üstteki sekme listesinde `Notwork` panelini seçin.

Kullanım

- `Hatalı İstekleri Listele`: DevTools'taki anlık Network verisini okuyup hatalı istekleri listeler. Butona bastığınızda kısa bir "Yükleniyor…" göstergesi görünür.
- `Temizle`: Sadece paneldeki listeyi temizler; tekrar `Hatalı İstekleri Listele` tıklayınca anlık veriler tekrar alınır.
- Her bir list öğesinde `Kopyala` butonu vardır; tıklayınca formatlı metin panoya kopyalanır.

Notlar

- Uzantı artık tüm yakalama işini DevTools tarafında yapar; arka plan servisi minimal tutulmuştur. Bu nedenle `manifest.json` izinleri azaltılmıştır.
- Bazı response body'leri CORS veya zamanlama nedeniyle alınamayabilir; bu durumda listede yalnızca başlık/istatü görünebilir.

Hızlı test

1. `chrome://extensions/` sayfasından uzantıyı yükleyin veya Reload yapın.
2. Hedef sayfada DevTools → `Notwork` panelini açın.
3. Ağda başarısız istekler tetikleyin ve `Hatalı İstekleri Listele` butonuna basın.
4. Liste görüntülendiğinde `Kopyala` ile panoya alın.

Geliştirme notu

- Eğer ek özellik isterseniz (zaman filtresi, deduplikasyon, otomatik takip) söyleyin, ekleyeyim.
