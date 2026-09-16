# Scalev Lite — LP Builder Gratisan

Tools sederhana buat bikin & kelola Landing Page iklan (Meta/Google/TikTok)
bareng tim, tanpa biaya server bulanan.

## Cara kerja singkat

```
content/*.json  --+
                   +--> build.js --> dist/<slug>/index.html --> Netlify (hosting gratis)
templates/*.html --+

admin/  --> panel edit visual buat tim (Sveltia CMS) --> commit ke content/*.json otomatis
```

Tim edit lewat panel (`/admin`) → tersimpan sebagai commit di GitHub →
Netlify otomatis build & deploy ulang. Semua gratis di skala kecil-menengah.

---

## Setup dari nol

### 1. Push project ini ke GitHub
```bash
git init
git add .
git commit -m "init scalev-lite"
# buat repo baru di github.com, lalu:
git remote add origin https://github.com/NAMA_ORG/NAMA_REPO.git
git push -u origin main
```

### 2. Deploy ke Netlify
- Buka netlify.com → "Add new site" → "Import from Git" → pilih repo tadi.
- Build command sudah otomatis kebaca dari `netlify.toml` (`npm run build`), publish folder `dist`.
- Klik Deploy. LP pertama (`contoh-produk-a`) akan bisa diakses di
  `https://namasite.netlify.app/contoh-produk-a/`

### 3. Setup panel tim (`/admin`)
Sveltia CMS butuh proses login ke GitHub, dan GitHub OAuth butuh "client secret"
yang tidak boleh ditaruh di browser — makanya butuh 1 perantara kecil (gratis):

1. Deploy worker `sveltia-cms-auth` ke Cloudflare Workers (gratis, sekali klik,
   ikuti panduan di: github.com/sveltia/sveltia-cms-auth — tinggal "Deploy to Cloudflare Workers").
2. Di GitHub, buat OAuth App baru (Settings > Developer settings > OAuth Apps),
   Authorization callback URL diisi sesuai instruksi di repo `sveltia-cms-auth`.
3. Masukkan Client ID & Secret ke environment variable Cloudflare Worker tadi.
4. Buka `admin/config.yml` di project ini, ganti:
   - `repo:` → `NAMA_ORG/NAMA_REPO` punya kamu
   - `base_url:` → URL worker Cloudflare kamu
5. Push perubahan, lalu buka `https://namasite.netlify.app/admin/` → login pakai GitHub.

### 4. Tambah anggota tim
- Undang mereka sebagai **Collaborator** di repo GitHub (Settings > Collaborators).
- Mereka login ke `/admin` pakai akun GitHub masing-masing.
- Publish mode di-set `editorial_workflow`, jadi perubahan tim masuk sebagai
  "draft" dulu — perlu di-approve (merge PR) sebelum benar-benar tayang.
  Ini mencegah salah satu anggota tim tidak sengaja langsung ubah LP yang live.

### 5. Aktifkan CAPI (opsional, untuk optimasi iklan)
- Di Netlify: Site settings > Environment variables, tambahkan:
  - `META_ACCESS_TOKEN` → ambil dari Meta Events Manager > Settings > Conversions API
  - `TIKTOK_ACCESS_TOKEN` → ambil dari TikTok Ads Manager > Events > Events API
- Di panel `/admin`, buka LP yang mau diaktifkan, centang "Aktifkan CAPI" di
  bagian Meta/TikTok.
- Pixel client-side & CAPI otomatis dedup lewat `event_id` yang sama
  (lihat `build.js` bagian `buildTrackingScripts`).

---

## Bikin LP baru

**Lewat panel (cara tim biasa pakai):**
Buka `/admin` → "Landing Page" → "New Landing Page" → isi form → Save → Publish.

**Manual (kalau perlu cepat, atau kamu sendiri):**
1. Copy `content/contoh-produk-a.json` → rename sesuai slug baru.
2. Edit isinya.
3. `npm run build` untuk cek hasil lokal di folder `dist/`.
4. Push ke GitHub → Netlify otomatis deploy.

---

## Batasan & catatan
- Free tier Netlify: 100GB bandwidth/bulan, 125rb function calls/bulan.
  Untuk beberapa campaign LP, biasanya jauh dari cukup.
- Kalau nanti traffic besar dan kena limit, baru upgrade Netlify (bukan wajib dari awal).
- Template baru (misalnya untuk pre-order/webinar) tinggal ditambah di folder
  `templates/`, lalu tambahkan opsi-nya di `admin/config.yml` bagian
  `template: widget: select: options`.
