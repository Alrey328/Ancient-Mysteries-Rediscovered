# Dual Premiere Content Management

The homepage premiere stage and `/youtube/` library read from one source:

`data/site-content.json`

No homepage or YouTube-library HTML needs to be edited for a normal release.

## Feature a new Facebook Reel

Update the `featuredReel` object:

- `title` and `description` control the homepage copy.
- `poster` is the repository-relative path to the approved AMR poster.
- `videoUrl` is the public Facebook Reel link.

Keep the poster file in the repository and preserve its path in the JSON.

## Add and feature a YouTube film

1. Add one object to `youtubeFilms`. Give it a unique `id`, `title`, `description`, `format`, approved `poster` path, and public `videoUrl`.
2. Set `featuredYoutubeId` to that same `id`.

The film selected by `featuredYoutubeId` appears in the large homepage card and the library's Featured Premiere. Every other object remains in Previous Productions, so changing the featured selection never deletes the outgoing film.

## Release checklist

1. Confirm every poster path opens locally.
2. Confirm the Facebook and YouTube URLs are public and point to the intended production.
3. Preview the homepage at `/#premieres` on desktop and mobile.
4. Preview `/youtube/` and confirm the former featured film appears in Previous Productions.
5. Commit the JSON and any new poster files together.

Keep JSON syntax valid: entries are comma-separated, keys and text values use double quotes, and the last entry in an array has no trailing comma.
