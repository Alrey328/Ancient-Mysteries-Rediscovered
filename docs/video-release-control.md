# Ancient Mysteries Rediscovered — Video Release Control Pilot

This pilot lets the site owner prepare the Goliath companion Reel/YouTube link before release and flip it OFF/ON from GitHub without editing HTML.

## Owner workflow

Open **GitHub → Ancient-Mysteries-Rediscovered → Actions → Video Release Control → Run workflow**.

The pilot has only two states:

- **off** — Goliath's Investigation shows the existing Coming Soon companion-film block. The saved Reel/YouTube URL remains stored for later use.
- **on** — the same companion-film block becomes an active **WATCH THE STORY** link using the saved URL.

The first time, paste the Reel/YouTube URL and choose **off**. On release day, choose **on** and leave the URL field blank; the workflow reuses the saved URL.

## Safety behavior

- This pilot touches only `mysteries/goliath-of-gath/index.html` and `data/video-releases.json`.
- Every other Reel, YouTube video, and Investigation remains unchanged and effectively ON by default.
- The workflow requires a uniquely identifiable Goliath companion section. If it cannot find exactly one, it stops without making the release change.
- Turning ON is blocked if there is no saved URL.
- There is no site-side release JavaScript or external backend in this pilot.

## Public-repository note

The repository is public, so a technically advanced visitor could inspect the repository and discover a preloaded URL while the public page is OFF. The OFF state is intended to prevent normal site visitors from accessing the video through the Investigation page before release.

## Pilot goal

Use Goliath for one real release. Confirm:

1. URL can be entered ahead of time while OFF.
2. Public Investigation remains non-clickable while OFF.
3. ON activates the correct Reel/YouTube link.
4. OFF can restore the Coming Soon state if needed.
5. No other page or video is affected.

If the pilot is successful, the same pattern can be extended to future Investigation companion videos.
