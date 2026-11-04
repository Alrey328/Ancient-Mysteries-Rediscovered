# AMR Exclusive engagement integration

The shared `engagement.js` component is enabled only on AMR-hosted originals. Each page supplies a video ID, player ID, and the existing Worker endpoint through the `amr-engagement-api` meta tag.

## API contract

For each allowlisted video ID (`enuk` and `laestrygonians`):

- `GET /videos/:id` returns `{"likes":0,"views":0}`.
- `PUT /videos/:id/like` with `{"visitorKey":"uuid"}` records an idempotent Like.
- `DELETE /videos/:id/like` with the same body removes that Like.
- `POST /videos/:id/view` with `{"visitorKey":"uuid","qualifiedSeconds":3}` records an idempotent daily qualified View.

All successful responses contain nonnegative integer totals. Mutation CORS is restricted to the AMR production origins. No secret or raw personal information is present in public JavaScript.

## Playback behavior

- Qualification accumulates wall-clock time only while the media is actually advancing, not while paused, seeking, stalled, or merely loaded.
- Playback speed does not shorten the three-second threshold.
- Looping cannot submit a second View in the same page session.
- Refreshes and repeat playback are deduplicated by the backend for the same anonymous visitor, film, and UTC day.
- Failed View submissions retry idempotently up to three times and never pause or block the film.
- If local storage is unavailable, a memory-only anonymous UUID is used for the current page lifetime.

## Reuse for a future AMR Original

Add an allowlisted backend ID and an `engagement_totals` seed row, then add the standard markup to the AMR-hosted film page:

```html
<meta name="amr-engagement-api" content="https://amr-exclusive-engagement.belizean328.workers.dev">
<video id="film-player" controls playsinline>...</video>
<div class="amr-engagement" data-amr-engagement data-video-id="new-film" data-player-id="film-player">
  <button type="button" data-amr-like disabled aria-pressed="false">♡ Like</button>
  <span data-amr-likes aria-live="polite">Likes unavailable</span>
  <span data-amr-views aria-live="polite">Views unavailable</span>
  <span data-amr-status role="status"></span>
</div>
```

Never add this component to Facebook Reels, YouTube embeds, or outbound cards.
