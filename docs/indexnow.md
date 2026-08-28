# IndexNow Deployment Submissions

Ancient Mysteries Rediscovered uses IndexNow as a deployment/update notification, not as visitor-side JavaScript.

## Key File

The IndexNow key is stored in `indexnow.txt` at the site root.

Production location:

`https://ancientmysteriesrediscovered.com/indexnow.txt`

The file contains:

`918bd71a546848245cb934eb48e27db6`

The workflow uses the same key and sends `keyLocation` as:

`https://ancientmysteriesrediscovered.com/indexnow.txt`

## How Submission Works

The workflow at `.github/workflows/indexnow.yml` runs after a successful `github-pages` deployment on `main` in the production repository. It can also be run manually from GitHub Actions for one-off URL submissions.

After the production deployment event, it runs:

`node scripts/submit-indexnow.mjs`

The script submits to the official IndexNow endpoint:

`https://api.indexnow.org/indexnow`

It only accepts production URLs under:

`https://ancientmysteriesrediscovered.com/`

It ignores localhost, preview, branch, and non-site URLs.

## Future Pages

For most future investigation pages, no manual action is needed. If a changed file is inside a folder that contains an `index.html`, the script submits that folder URL.

Example:

Changing `mysteries/new-investigation/index.html` submits:

`https://ancientmysteriesrediscovered.com/mysteries/new-investigation/`

If a future change cannot be detected automatically, add one production URL per line to `indexnow-urls.txt`, or run the workflow manually and paste URLs into the `urls` input.

## Visitor Traffic

No IndexNow calls are made from normal page loads. There is no browser-side IndexNow script.
