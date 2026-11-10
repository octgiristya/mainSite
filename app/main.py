"""octgiristya — personal link hub & interactive CV.

FastAPI + Jinja2. Content lives in content.yaml.
Hardened by default: strict CSP with per-request nonce, HSTS, no framing,
no MIME sniffing, minimal referrer, locked-down browser features.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.gzip import GZipMiddleware

BASE = Path(__file__).resolve().parent
CONTENT_FILE = Path(os.getenv("CONTENT_FILE", BASE / "content.yaml"))
DEBUG = os.getenv("APP_DEBUG", "0") == "1"


def _asset_version() -> str:
    """Hash of static files so browsers re-download after deploys."""
    h = hashlib.sha1()
    for p in sorted((BASE / "static").rglob("*")):
        if p.is_file() and p.suffix in {".css", ".js"}:
            h.update(p.read_bytes())
    return h.hexdigest()[:10]


@lru_cache(maxsize=1)
def _load_content(mtime: float) -> dict:
    with CONTENT_FILE.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def content() -> dict:
    # cache keyed on file mtime: edits are picked up without restart
    return _load_content(CONTENT_FILE.stat().st_mtime)


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(GZipMiddleware, minimum_size=800)
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
templates = Jinja2Templates(directory=BASE / "templates")
ASSET_V = _asset_version()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    nonce = secrets.token_urlsafe(16)
    request.state.nonce = nonce
    response: Response = await call_next(request)
    csp = (
        "default-src 'none'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "media-src 'self'; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "manifest-src 'self'; "
        "base-uri 'none'; "
        "form-action 'none'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "upgrade-insecure-requests"
    )
    h = response.headers
    h["Content-Security-Policy"] = csp
    h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    h["X-Content-Type-Options"] = "nosniff"
    h["X-Frame-Options"] = "DENY"
    h["Referrer-Policy"] = "strict-origin-when-cross-origin"
    h["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), "
        "microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()"
    )
    h["Cross-Origin-Opener-Policy"] = "same-origin"
    h["Cross-Origin-Resource-Policy"] = "same-origin"
    if "server" in h:
        del h["server"]
    path = request.url.path
    if path.startswith("/static/"):
        h["Cache-Control"] = "public, max-age=31536000, immutable"
    elif response.media_type == "text/html" or path == "/":
        h["Cache-Control"] = "no-cache"
    return response


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        request,
        "index.html",
        {"c": content(), "nonce": request.state.nonce, "v": ASSET_V, "year": datetime.now().year},
    )


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots():
    url = content()["site"]["url"].rstrip("/")
    return f"User-agent: *\nAllow: /\nSitemap: {url}/sitemap.xml\n"


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    url = content()["site"]["url"].rstrip("/")
    today = datetime.now(timezone.utc).date().isoformat()
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{url}/</loc><lastmod>{today}</lastmod><priority>1.0</priority></url>"
        "</urlset>"
    )
    return Response(xml, media_type="application/xml")


@app.get("/.well-known/security.txt", response_class=PlainTextResponse, include_in_schema=False)
async def security_txt():
    c = content()["site"]
    expires = (datetime.now(timezone.utc) + timedelta(days=180)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        f"Contact: {c['security_contact']}\n"
        f"Expires: {expires}\n"
        "Preferred-Languages: id, en\n"
        f"Canonical: {c['url'].rstrip('/')}/.well-known/security.txt\n"
        "# Found something? Responsible disclosure appreciated. Think like an attacker, act like a defender.\n"
    )


@app.exception_handler(404)
async def not_found(request: Request, exc):
    return templates.TemplateResponse(
        request,
        "404.html",
        {"c": content(), "nonce": request.state.nonce, "v": ASSET_V, "path": request.url.path},
        status_code=404,
    )
