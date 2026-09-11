import json
import os
import re
from html import escape
from pathlib import Path

config_path = Path("data/video-releases.json")
page_path = Path("mysteries/goliath-of-gath/index.html")
data = json.loads(config_path.read_text())
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
config_path.write_text(json.dumps(data, indent=2) + "\n")

page = page_path.read_text()
pattern = re.compile(
    r'<section class="companion world-section" aria-labelledby="companion-title">.*?</section>',
    re.S,
)

if state == "on":
    safe_url = escape(url, quote=True)
    replacement = f'''<section class="companion world-section" aria-labelledby="companion-title">
    <div class="film-mark" aria-hidden="true">▷</div>
    <p class="eyebrow">Companion film</p>
    <h2 id="companion-title">Goliath of Gath</h2>
    <a class="source-link" href="{safe_url}" target="_blank" rel="noopener noreferrer" aria-label="Watch Goliath of Gath">▶ WATCH THE STORY ↗</a>
    <p>The companion Reel is now live. Continue the story on Facebook or YouTube.</p>
  </section>'''
else:
    replacement = '''<section class="companion world-section" aria-labelledby="companion-title">
    <div class="film-mark" aria-hidden="true">▷</div>
    <p class="eyebrow">Companion film</p>
    <h2 id="companion-title">Goliath of Gath</h2>
    <span class="coming-soon">Coming soon</span>
    <p>The companion film has been prepared and will be revealed when it goes live.</p>
  </section>'''

updated, count = pattern.subn(replacement, page, count=1)
if count != 1:
    raise SystemExit("Safety stop: could not uniquely locate the Goliath companion section.")
page_path.write_text(updated)
