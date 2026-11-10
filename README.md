# OGI // octgiristya — website

Link hub + interactive CV. FastAPI · Jinja2 · vanilla JS/CSS. No external CDNs, no trackers.

## Jalankan di server

```bash
# 1. upload folder `web` ke server, lalu:
cd web
chmod +x run.sh

# 2a. coba jalan dulu (foreground, Ctrl+C untuk berhenti)
./run.sh

# 2b. kalau sudah oke, pasang sebagai service (auto-start saat reboot)
./run.sh service
```

Butuh Python 3.10+. App jalan di `127.0.0.1:8000` (sengaja hanya localhost).
Ekspos ke internet lewat reverse proxy dengan HTTPS:

### Caddy (paling gampang — HTTPS otomatis)
```
octgiristya.com, www.octgiristya.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8000
}
```

### Nginx
```nginx
server {
    server_name octgiristya.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # lalu: sudo certbot --nginx -d octgiristya.com
}
```

## Edit isi website
Semua teks ada di **`app/content.yaml`** — nama, link, project, pengalaman, sertifikat, award.
Perubahan langsung terbaca tanpa restart (cukup refresh browser).

Ganti `site.url` dengan domain kamu sebelum online (dipakai untuk SEO, preview link, sitemap).

## Perintah lain
```
./run.sh dev        # mode edit (auto-reload)
./run.sh restart    # restart service
./run.sh status     # status service
./run.sh logs       # lihat log
./run.sh uninstall  # hapus service
```

## Keamanan bawaan
- Content-Security-Policy ketat (nonce per request, tanpa inline script, tanpa pihak ketiga)
- HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP
- `/.well-known/security.txt`, header `server` disembunyikan, docs FastAPI dimatikan
- systemd service dengan sandboxing (NoNewPrivileges, ProtectSystem, dll.)

Cek setelah online: https://securityheaders.com dan https://observatory.mozilla.org

## Easter egg
Tekan tombol <kbd>`</kbd> (backtick) di halaman → terminal interaktif. Coba `help`, `whoami`, `sudo`.

## Deploy statis (Cloudflare Pages)
Situs ini bisa diekspor jadi HTML statis — tidak perlu server.

```bash
pip install jinja2 pyyaml
python build.py        # hasil di ./dist  (sudah termasuk _headers untuk security headers)
```

Setting Cloudflare Pages:
- Build command: `pip install jinja2 pyyaml && python build.py`
- Build output directory: `dist`

Setiap `git push` → Cloudflare build & deploy otomatis.
`security.txt` berlaku 180 hari sejak build — push/redeploy minimal tiap ~5 bulan.
