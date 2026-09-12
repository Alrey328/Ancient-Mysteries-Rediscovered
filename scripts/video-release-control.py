import json
import os
import re
from html import escape
from pathlib import Path

config_path = Path("data/video-releases.json")
investigation_page_path = Path("mysteries/goliath-of-gath/index.html")
homepage_path = Path("index.html")
data = json.loads(config_path.read_text(encoding="utf-8"))
releases = data.setdefault("releases", {})
current = releases.get("goliath-of-gath", {})

state = os.environ["STATE"].strip().lower()
entered_url = os.environ.get("VIDEO_URL_INPUT", "").strip()
saved_url = current.get("videoUrl", "").strip()
url = entered_url or saved_url

if state not in {"off", "on"}:
    raise SystemExit("State must be off or on")

if entered_url and not (
    entered_url.startswith("https://www.facebook.com/")
    or entered_url.startswith("https://facebook.com/")
    or entered_url.startswith("https://youtu.be/")
    or entered_url.startswith("https://www.youtube.com/")
):
    raise SystemExit("URL must be a Facebook Reel or YouTube HTTPS URL")

if state == "on" and not url:
    raise SystemExit("No saved video URL. Paste the URL once before turning ON.")

releases["goliath-of-gath"] = {
    "title": "Goliath of Gath",
    "state": state,
    "videoUrl": url,
}

investigation_page = investigation_page_path.read_text(encoding="utf-8")
companion_pattern = re.compile(
    r'<section class="companion world-section" aria-labelledby="companion-title">.*?</section>',
    re.S,
)

homepage = homepage_path.read_text(encoding="utf-8")
homepage_card_pattern = re.compile(
    r'<article class="[^"]*goliath-reel-card[^"]*" data-video-release="goliath-of-gath" data-release-state="(?:off|on)">.*?</article>',
    re.S,
)

if state == "on":
    safe_url = escape(url, quote=True)
    companion_replacement = f'''<section class="companion world-section" aria-labelledby="companion-title">
    <div class="film-mark" aria-hidden="true">▷</div>
    <p class="eyebrow">Companion film</p>
    <h2 id="companion-title">Goliath of Gath</h2>
    <a class="source-link" href="{safe_url}" target="_blank" rel="noopener noreferrer" aria-label="Watch Goliath of Gath">▶ WATCH THE STORY ↗</a>
    <p>The companion Reel is now live. Continue the story on Facebook or YouTube.</p>
  </section>'''
    homepage_card_replacement = f'''<article class="reel-card featured has-investigation goliath-reel-card" data-video-release="goliath-of-gath" data-release-state="on">
      <a class="thumb-link" href="{safe_url}" target="_blank" rel="noopener" aria-label="Watch Goliath of Gath on Facebook">
        <div class="thumb">
          <img src="goliath-of-gath-reel-poster.png" alt="Official Goliath of Gath Reel poster, showing Goliath entering the city of Gath" loading="eager">
          <div class="badge">Newest</div>
          <div class="play"><span>&#9654;</span></div>
        </div>
      </a>
      <div class="meta">
        <div class="tag">Newest Reel</div>
        <h3><a class="title-link" href="{safe_url}" target="_blank" rel="noopener">GOLIATH OF GATH</a></h3>
        <a class="reel-watch" href="{safe_url}" target="_blank" rel="noopener" aria-label="Watch Goliath of Gath on Facebook">▶ Watch the Story ↗</a>
        <a class="investigation-cta" href="/mysteries/goliath-of-gath/" aria-label="Investigate the Goliath of Gath mystery">
          <span>Investigate the Mystery</span><span class="arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </article>'''
else:
    companion_replacement = '''<section class="companion world-section" aria-labelledby="companion-title">
    <div class="film-mark" aria-hidden="true">▷</div>
    <p class="eyebrow">Companion film</p>
    <h2 id="companion-title">Goliath of Gath</h2>
    <span class="coming-soon">Coming soon</span>
    <p>The companion film has been prepared and will be revealed when it goes live.</p>
  </section>'''
    homepage_card_replacement = '''<article class="reel-card featured has-investigation goliath-reel-card pending" data-video-release="goliath-of-gath" data-release-state="off">
      <div class="thumb">
        <img src="goliath-of-gath-reel-poster.png" alt="Official Goliath of Gath Reel poster, showing Goliath entering the city of Gath" loading="eager">
        <div class="badge">Newest</div>
      </div>
      <div class="meta">
        <div class="tag">Newest Reel</div>
        <h3>GOLIATH OF GATH</h3>
        <span class="reel-watch disabled" aria-label="Goliath of Gath Reel coming soon">Coming Soon</span>
        <a class="investigation-cta" href="/mysteries/goliath-of-gath/" aria-label="Investigate the Goliath of Gath mystery">
          <span>Investigate the Mystery</span><span class="arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </article>'''

updated_investigation, companion_count = companion_pattern.subn(
    companion_replacement, investigation_page, count=1
)
if companion_count != 1:
    raise SystemExit("Safety stop: could not uniquely locate the Goliath companion section.")

updated_homepage, homepage_card_count = homepage_card_pattern.subn(
    homepage_card_replacement, homepage, count=1
)
if homepage_card_count != 1:
    raise SystemExit("Safety stop: could not uniquely locate the Goliath homepage Reel card.")

config_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
investigation_page_path.write_text(updated_investigation, encoding="utf-8")
homepage_path.write_text(updated_homepage, encoding="utf-8")
