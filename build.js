// build.js
// Node bawaan saja (tanpa dependency npm) supaya ringan & bebas biaya.
// Baca semua file JSON di /content, render ke template HTML di /templates,
// hasilkan file statis di /dist/<slug>/index.html

const fs = require("fs");
const path = require("path");

const CONTENT_DIR = path.join(__dirname, "content");
const TEMPLATE_DIR = path.join(__dirname, "templates");
const DIST_DIR = path.join(__dirname, "dist");
const ADMIN_DIR = path.join(__dirname, "admin");

// --- helper: copy folder beserta isinya (rekursif) ---
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// --- helper: ratakan object bersarang jadi "a.b.c": value ---
function flatten(obj, prefix = "", out = {}) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatten(val, newKey, out);
    } else {
      out[newKey] = val ?? "";
    }
  }
  return out;
}

// --- helper: ganti semua {{a.b.c}} di template dengan nilainya ---
function renderTemplate(template, flatData) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(flatData, key)
      ? String(flatData[key])
      : "";
  });
}

// --- bangun tag <img>/<video> sesuai tipe media ---
function buildMediaHtml(hero) {
  const media = hero.media || {};
  if (media.type === "video") {
    return `<video src="${media.url}" autoplay muted loop playsinline></video>`;
  }
  return `<img src="${media.url || "https://placehold.co/720x480"}" alt="${media.alt || ""}" loading="lazy">`;
}

// --- bangun blok <script> tracking (pixel client-side + helper CAPI) ---
function buildTrackingScripts(cfg) {
  const t = cfg.tracking || {};
  const meta = t.meta || {};
  const google = t.google || {};
  const tiktok = t.tiktok || {};

  let scripts = "";

  // Meta Pixel
  if (meta.pixelId) {
    scripts += `
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${meta.pixelId}');
fbq('track', 'PageView');
</script>`;
  }

  // Google gtag
  if (google.gtagId) {
    scripts += `
<script async src="https://www.googletagmanager.com/gtag/js?id=${google.gtagId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${google.gtagId}');
</script>`;
  }

  // TikTok Pixel
  if (tiktok.pixelId) {
    scripts += `
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${tiktok.pixelId}');
  ttq.page();
}(window, document, 'ttq');
</script>`;
  }

  // Helper klik CTA: fire pixel client-side + kirim ke fungsi CAPI (dedup via event_id)
  scripts += `
<script>
(function(){
  function uuid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }

  var CAPI_ENABLED = ${Boolean(meta.capiEnabled || tiktok.capiEnabled)};

  document.querySelectorAll('[data-track-event]').forEach(function(el){
    el.addEventListener('click', function(){
      var eventName = el.getAttribute('data-track-event');
      if (!eventName) return;

      var eventId = uuid();
      var value = parseFloat(el.getAttribute('data-track-value')) || 0;
      var currency = el.getAttribute('data-track-currency') || 'IDR';

      // Pixel client-side (pakai eventID yang sama untuk dedup dengan CAPI)
      if (window.fbq) {
        fbq('track', eventName, { value: value, currency: currency }, { eventID: eventId });
      }
      if (window.gtag) {
        gtag('event', eventName, { value: value, currency: currency });
      }
      if (window.ttq) {
        ttq.track(eventName, { value: value, currency: currency }, { event_id: eventId });
      }

      // Kirim ke server (Netlify Function) untuk CAPI, kalau diaktifkan
      if (CAPI_ENABLED) {
        try {
          navigator.sendBeacon(
            '/.netlify/functions/track',
            JSON.stringify({
              event: eventName,
              event_id: eventId,
              value: value,
              currency: currency,
              page_url: window.location.href,
              meta_pixel_id: '${meta.pixelId || ""}',
              tiktok_pixel_id: '${tiktok.pixelId || ""}'
            })
          );
        } catch (e) { /* diamkan kalau gagal, jangan blok user */ }
      }
    });
  });
})();
</script>`;

  return scripts;
}

function build() {
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("Tidak ada file config di /content. Tidak ada yang di-build.");
    return;
  }

  for (const file of files) {
    const cfg = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
    const templateName = cfg.template || "leadgen";
    const templatePath = path.join(TEMPLATE_DIR, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      console.warn(`Template "${templateName}" tidak ditemukan untuk ${file}, dilewati.`);
      continue;
    }

    let html = fs.readFileSync(templatePath, "utf8");
    const flatData = flatten(cfg);

    // suntik blok dinamis dulu, sebelum replace placeholder biasa
    flatData["MEDIA_HTML"] = buildMediaHtml(cfg.hero || {});
    flatData["TRACKING_SCRIPTS"] = buildTrackingScripts(cfg);

    html = renderTemplate(html, flatData);

    const outDir = path.join(DIST_DIR, cfg.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

    console.log(`✔ Build: /${cfg.slug}/`);
  }

  // Salin folder admin/ (panel CMS) ke dist/admin/ supaya ikut ter-deploy
  copyDir(ADMIN_DIR, path.join(DIST_DIR, "admin"));
  console.log("✔ Panel admin ikut di-copy ke /admin/");
}

build();
