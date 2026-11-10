#!/usr/bin/env python3
"""Export the FastAPI/Jinja site to plain static files in ./dist

    pip install jinja2 pyyaml
    python build.py

Output is ready for Cloudflare Pages (or any static host). Security headers
that FastAPI used to add per request are written to dist/_headers instead.
"""
from __future__ import annotations

import hashlib
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
DIST = ROOT / "dist"

content = yaml.safe_load((APP / "content.yaml").read_text(encoding="utf-8"))
url = content["site"]["url"].rstrip("/")
now = datetime.now(timezone.utc)

h = hashlib.sha1()
for p in sorted((APP / "static").rglob("*")):
    if p.is_file() and p.suffix in {".css", ".js"}:
        h.update(p.read_bytes())
asset_v = h.hexdigest()[:10]

env = Environment(loader=FileSystemLoader(APP / "templates"),
                  autoescape=select_autoescape(["html"]))
# Static site: no per-request nonce. The only inline <script> tags are JSON
# data blocks (ld+json / application/json), which CSP does not execute.
ctx = {"c": content, "nonce": "", "v": asset_v, "year": now.year}

if DIST.exists():
    shutil.rmtree(DIST)
shutil.copytree(APP / "static", DIST / "static",
                ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))

(DIST / "index.html").write_text(env.get_template("index.html").render(**ctx), encoding="utf-8")
(DIST / "404.html").write_text(
    env.get_template("404.html").render(**ctx, path="this page"), encoding="utf-8")

(DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {url}/sitemap.xml\n")
(DIST / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    f"<url><loc>{url}/</loc><lastmod>{now.date().isoformat()}</lastmod>"
    "<priority>1.0</priority></url></urlset>\n")

wk = DIST / ".well-known"
wk.mkdir()
expires = (now + timedelta(days=180)).strftime("%Y-%m-%dT%H:%M:%SZ")
(wk / "security.txt").write_text(
    f"Contact: {content['site']['security_contact']}\n"
    f"Expires: {expires}\n"
    "Preferred-Languages: id, en\n"
    f"Canonical: {url}/.well-known/security.txt\n"
    "# Found something? Responsible disclosure appreciated. Think like an attacker, act like a defender.\n")

csp = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
       "media-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; "
       "upgrade-insecure-requests")
(DIST / "_headers").write_text(f"""/*
  Content-Security-Policy: {csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/static/*
  Cache-Control: public, max-age=31536000, immutable

/
  Cache-Control: no-cache

/.well-known/security.txt
  Content-Type: text/plain; charset=utf-8
""")

print(f"built -> {DIST}  (asset v={asset_v})")
