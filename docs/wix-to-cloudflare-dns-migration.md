# Wix DNS to Cloudflare DNS migration inventory and rollback plan

Status: prepared only. No production DNS record or nameserver was changed.

Domain: `ancientmysteriesrediscovered.com`  
Production origin: GitHub Pages  
Inventory re-verified: 2026-11-09 (America/Chicago)

## Current authoritative inventory

The following records were queried from the current Wix authoritative service. TTL values are seconds.

| Owner | Type | Value | TTL | Cloudflare proxy on cutover |
|---|---|---|---:|---|
| `@` | A | `185.199.108.153` | 3600 | DNS only initially |
| `@` | A | `185.199.109.153` | 3600 | DNS only initially |
| `@` | A | `185.199.110.153` | 3600 | DNS only initially |
| `@` | A | `185.199.111.153` | 3600 | DNS only initially |
| `@` | NS | `ns2.wixdns.net` | registrar/delegation | replaced only at approved cutover |
| `@` | NS | `ns3.wixdns.net` | registrar/delegation | replaced only at approved cutover |
| `www` | CNAME | `alrey328.github.io` | 3600 | DNS only initially |

The `www` target resolves to GitHub Pages IPv4 `185.199.108.153`–`185.199.111.153` and IPv6 `2606:50c0:8000::153`–`2606:50c0:8003::153`; these are target resolution results, not additional records to copy for `www`.

No public MX, TXT, CAA, apex AAAA, or records for `_dmarc`, `google._domainkey`, `default._domainkey`, `_github-pages-challenge-Alrey328`, `api`, `mail`, or `email` were returned in the verification queries. NXDOMAIN/no-data results must not be converted into Cloudflare records.

The apex SOA reported `ns2.wixdns.net`, `support.wix.com`, serial `2026072800`, refresh 10800, retry 3600, expire 1209600, minimum 3600. SOA is provider-managed and is not copied.

### Mandatory completeness check before cutover

DNS cannot enumerate a zone reliably, and Wix does not expose all possible labels through public queries. Therefore the owner must export or screenshot the Wix DNS dashboard immediately before cutover. Compare every Wix row with the table above and append any record not publicly discoverable, including verification, mail, SRV, CAA, wildcard, and underscored records. Cutover is blocked until two copies of that export are saved and the Cloudflare draft matches row-for-row.

This requirement is how the migration inventory remains complete even if a private or unexpected label exists. The current public inventory indicates a minimal GitHub Pages-only zone, but it is not safe to infer that public lookups prove the absence of every label.

## Target Cloudflare inventory

Create the zone on Cloudflare Free without changing nameservers. Import or enter exactly:

| Owner | Type | Target/content | TTL | Proxy |
|---|---|---|---|---|
| `@` | A | `185.199.108.153` | Auto | DNS only |
| `@` | A | `185.199.109.153` | Auto | DNS only |
| `@` | A | `185.199.110.153` | Auto | DNS only |
| `@` | A | `185.199.111.153` | Auto | DNS only |
| `www` | CNAME | `alrey328.github.io` | Auto | DNS only |

Also copy every additional record discovered in the Wix dashboard export exactly, with proxy disabled. Do not copy Wix NS or SOA records into the Cloudflare zone.

Keep GitHub Pages records DNS-only for the initial transfer. This makes the nameserver migration a DNS-provider change, not a simultaneous CDN/origin change. Cloudflare proxying, redirects, and security rules can be considered in a separate approved change after the zone has been stable.

The future `api` Worker custom domain and Resend SPF/DKIM/DMARC records are separate Phase D changes. They must not be pre-created unless their generated target values are known and separately approved.

## Pre-cutover validation

1. Confirm Cloudflare account is on Free and billing/paid add-ons are disabled.
2. Save Wix DNS export/screenshots and registrar nameserver screenshots with timestamp.
3. Save a Cloudflare zone export after the draft is entered.
4. Compare record count, owner, type, content, priority, and TTL. CNAME flattening at the apex is not needed here.
5. Query the two assigned Cloudflare nameservers directly for apex A and `www` CNAME before delegation.
6. Confirm GitHub Pages repository still has `CNAME` set to `ancientmysteriesrediscovered.com` and HTTPS enforcement is healthy.
7. Confirm HTTP 200/redirect behavior for apex and `www`, certificate validity, Cinema media, sitemap, robots.txt, IndexNow workflow, and the existing production engagement Worker.
8. Schedule a low-traffic window with the owner available. Do not bundle the D1 migration, Worker deploy, Resend activation, or GitHub merge into the DNS change.

Wix currently advertises a one-hour SOA minimum/record TTL and the parent delegation was observed near one day. Lowering record TTL does not shorten a cached parent NS delegation; plan for mixed resolvers during the full delegation TTL.

## Approved cutover procedure (future only)

1. Freeze DNS edits in Wix and Cloudflare.
2. Run a final authoritative query and diff against the saved inventories.
3. At the registrar, replace only `ns2.wixdns.net` and `ns3.wixdns.net` with the two Cloudflare-assigned nameservers.
4. Do not delete or modify the Wix zone.
5. Every 15 minutes for the first two hours, and hourly through the delegation TTL, query multiple public resolvers for NS, apex A, and `www` CNAME.
6. Verify apex/`www` HTTPS, certificate chain, Cinema playback, static assets, sitemap/robots, and engagement API from mobile and desktop networks.
7. Keep Cloudflare records DNS-only and keep the Wix zone intact for at least seven days.

## Rollback triggers

Rollback immediately if any of these persist for more than five minutes on more than one resolver/network:

- apex or `www` returns NXDOMAIN/SERVFAIL;
- GitHub Pages no longer serves the correct repository or HTTPS fails;
- an existing mail/verification/service record is missing;
- the Cloudflare zone contains an incorrect target;
- a critical Cinema asset or API becomes unreachable because of DNS.

## Rollback procedure

1. At the registrar, restore the exact original nameservers: `ns2.wixdns.net` and `ns3.wixdns.net`.
2. Do not delete the Cloudflare zone and do not alter the preserved Wix zone while caches converge.
3. Query parent/recursive resolvers every 15 minutes and record when Wix answers resume.
4. Verify apex A, `www` CNAME, HTTPS certificate, GitHub Pages content, Cinema playback, sitemap/robots, and existing engagement API.
5. Expect mixed Wix/Cloudflare answers until cached NS records expire; rollback is not instantaneous.
6. Document the failed check, timestamps, resolver answers, and corrective action. Do not retry until a new owner-approved window.

DNS rollback does not alter D1, engagement data, GitHub Discussions, Git history, or Resend. No database rollback is part of this DNS procedure.

## Post-cutover hold points

After 24–48 stable hours, the owner may separately approve:

- adding `api.ancientmysteriesrediscovered.com` as the Worker custom domain;
- adding Resend-generated SPF/DKIM records on a dedicated sending subdomain and a monitoring DMARC policy;
- enabling Turnstile production hostname;
- considering Cloudflare proxying only after GitHub Pages custom-domain behavior is revalidated.

None of these actions is authorized by the DNS migration approval alone.
