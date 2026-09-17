import json
import os
import re
from html import escape
from pathlib import Path

config_path = Path("data/video-releases.json")
investigation_page_path = Path("mysteries/giant-of-kandahar/index.html")
homepage_path = Path("index.html")
data = json.loads(config_path.read_text(encoding="utf-8"))
releases = data.setdefault("releases", {})
current = releases.get("giant-of-kandahar-2", {})

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

releases["giant-of-kandahar-2"] = {
    "title": "The Kandahar Giant: The Story Didn't End There",
    "state": state,
    "videoUrl": url,
}

homepage = homepage_path.read_text(encoding="utf-8")
investigation_page = investigation_page_path.read_text(encoding="utf-8")

# The current Kandahar card is the uniquely registered legacy card. During the
# 2.0 pilot it becomes the release-controlled Featured Reel card. The original
# Reel URL is preserved on the Investigation page as a legacy link after launch.
homepage_card_pattern = re.compile(
    r'<article class="reel-card featured has-investigation kandahar-investigation-card(?: pending)?"(?: data-video-release="giant-of-kandahar-2" data-release-state="(?:off|on)")?>.*?</article>',
    re.S,
)

poster_style = "background-image:url('kandahar-giant-2-poster.png')"

if state == "on":
    safe_url = escape(url, quote=True)
    homepage_card_replacement = f'''<article class="reel-card featured has-investigation kandahar-investigation-card" data-video-release="giant-of-kandahar-2" data-release-state="on">
      <a class="thumb-link" href="{safe_url}" target="_blank" rel="noopener" aria-label="Watch The Kandahar Giant: The Story Didn't End There on Facebook">
        <div class="thumb" style="{poster_style}">
          <div class="badge">Newest</div>
          <div class="play"><span>&#9654;</span></div>
        </div>
      </a>
      <div class="meta">
        <div class="tag">Newest Reel</div>
        <h3><a class="title-link" href="{safe_url}" target="_blank" rel="noopener">THE KANDAHAR GIANT: THE STORY DIDN'T END THERE</a></h3>
        <a class="reel-watch" href="{safe_url}" target="_blank" rel="noopener" aria-label="Watch Kandahar Giant 2.0 on Facebook">▶ Watch the Story ↗</a>
        <a class="investigation-cta" href="mysteries/giant-of-kandahar/" aria-label="Investigate the Giant of Kandahar mystery">
          <span>Investigate the Mystery</span><span class="arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </article>'''
else:
    homepage_card_replacement = f'''<article class="reel-card featured has-investigation kandahar-investigation-card pending" data-video-release="giant-of-kandahar-2" data-release-state="off">
      <div class="thumb" style="{poster_style}">
        <div class="badge">Newest</div>
      </div>
      <div class="meta">
        <div class="tag">Newest Reel</div>
        <h3>THE KANDAHAR GIANT: THE STORY DIDN'T END THERE</h3>
        <span class="reel-watch disabled" aria-label="Kandahar Giant 2.0 Reel coming soon">Coming Soon</span>
        <a class="investigation-cta" href="mysteries/giant-of-kandahar/" aria-label="Investigate the Giant of Kandahar mystery">
          <span>Investigate the Mystery</span><span class="arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </article>'''

updated_homepage, homepage_count = homepage_card_pattern.subn(
    homepage_card_replacement, homepage, count=1
)
if homepage_count != 1:
    raise SystemExit("Safety stop: could not uniquely locate the Kandahar homepage Reel card.")

# OFF intentionally leaves the currently live original Kandahar Reel on the
# Investigation page. ON promotes 2.0 to the primary Watch the Story link and
# preserves the original as a subordinate legacy link.
updated_investigation = investigation_page
if state == "on":
    safe_url = escape(url, quote=True)
    watch_section_pattern = re.compile(
        r'(<section class="section" aria-labelledby="watch-reconstruction">.*?<div class="video-card">)(.*?)(</div>\s*</section>)',
        re.S,
    )
    match = watch_section_pattern.search(investigation_page)
    if not match:
        raise SystemExit("Safety stop: could not uniquely locate the Kandahar Watch section.")
    new_video = f'''
      <a class="video-frame portrait poster-link" href="{safe_url}" target="_blank" rel="noopener" style="background-image:url('giant-of-kandahar-reel-image.png')" aria-label="Open Kandahar Giant 2.0 on Facebook">
        <span class="poster-play">&#9654;</span>
        <span class="poster-label">Open New Reel on Facebook</span>
      </a>
      <p class="note"><strong>This video is a cinematic reconstruction of an unverified account. It is not documentary footage of the alleged event.</strong></p>
      <p class="note legacy-reel"><a class="text-link" href="https://www.facebook.com/share/r/1DNeJrgAUu/" target="_blank" rel="noopener">Watch the Original Kandahar Reel ↗</a></p>
    '''
    updated_investigation = (
        investigation_page[:match.start()]
        + match.group(1)
        + new_video
        + match.group(3)
        + investigation_page[match.end():]
    )

config_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
homepage_path.write_text(updated_homepage, encoding="utf-8")
investigation_page_path.write_text(updated_investigation, encoding="utf-8")
