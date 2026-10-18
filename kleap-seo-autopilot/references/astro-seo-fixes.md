# Fix recipes for Kleap (Astro) sites

Every Kleap site is an Astro project: pages in `src/pages/*.astro`, shared pieces in `src/components/`,
the layout in `src/layouts/Base.astro`. Each page wraps its content in `<Base ...>`; **Base already emits**
the `<title>`, meta description, canonical, `robots`, Open Graph and a JSON-LD graph (`WebSite` + `WebPage`).
You change SEO by changing the props a page passes to `<Base>` and the content inside it.
Do not edit `Base.astro`, `astro.config.mjs`, `package.json`, `public/robots.txt` (Kleap owns them).

How to edit (deterministic file edits, no Kleap AI involved): `kleap files cat <site> <path>` first, copy the exact old text,
then `kleap files edit <site> <path> --find "<old>" --replace "<new>"` (`--find` must match once; add surrounding
text to make it unique, or `--all` when you really mean every occurrence). `kleap publish <site>` makes it live.
MCP equivalent: `read_files` -> `edit_files` (several edits in one validated call) -> `publish_app`.

## title_short / title_long / missing_title
Props on the `<Base ...>` tag: `title="..."`. Target 30-60 chars, main keyword first, brand last
(`Emergency Plumber in Lyon | Rivera Plumbing`). Unique per page. Keep the site's language.
```
--find 'title="Hotel"' --replace 'title="Hotel Kleap Prod Check — Rooms & Rooftop Retreat"'
```
(tested live: the new title is in the served `<title>` after publish)

## description_short / description_long / missing_description
`description="..."` on `<Base>`. 70-160 chars: what the page offers + a reason to click + a call to action.
Do not copy the title. Do not promise what the site does not offer.

## duplicate_title / duplicate_description
The finding lists every route sharing the text: rewrite all but one so each describes its own page.

## missing_alt
Add `alt="..."` to each `<img>` / `<Image>` the finding reports (read the page, look at the file name and the
surrounding heading to describe what the image shows). Purely decorative images get `alt=""`.
```
--find '<img src="/uploads/rooftop-pool-1.jpg" fetchpriority="high"/>' --replace '<img src="/uploads/rooftop-pool-1.jpg" alt="Rooftop pool at Hotel Kleap Prod Check" fetchpriority="high"/>'
```
(tested live)

## dead_internal_link
The link points to a route that has no page. In this order: (1) repoint it to the page that really covers the
topic (or an on-page anchor like `#contact`), (2) remove only the `<a>`, keeping the visible text, (3) if the
site clearly needs that page (a "Contact" link with no contact page), create it with `kleap files write <site>
src/pages/<name>.astro --file <local>` using the same `<Base title description>` structure as the homepage.
Never delete a page to "fix" a link. (tested: removing the `<a href="/rooms">` link made the finding disappear)

## orphan_page
Add one contextual link to it from the homepage or a closely related page, with descriptive anchor text
(`<a href="/services/boiler-repair">boiler repair in Lyon</a>`, never "click here"). Do not add it to the footer
of a page that already has 40 links.

## no_h1 / multiple_h1
One `<h1>` per page, containing the page's main topic. Demote extras to `<h2>`.

## thin_page
Under ~120 words of visible text. Add useful content that is already true for the business: services detail,
process, FAQs, service area, proof the owner has shown elsewhere on the site. Never pad, never invent facts.

## no_page_schema (JSON-LD)
Base merges anything you pass in the `schema` prop into the page's `@graph`. Add the node that matches the page.
Use only facts already visible on the page; leave out `telephone`, `address`, `aggregateRating`, prices when the
site does not show them.
```
--find 'for your next stay.">' --replace 'for your next stay." schema={[{ "@type": "Hotel", name: "Hotel Kleap Prod Check", url: "https://hotel-kleap-prod-check.kleap.io/" }]}>'
```
(tested live: the served JSON-LD `@graph` contains `WebSite`, `WebPage`, `Hotel`)
Types by page: homepage of a local business -> `LocalBusiness` (or a subtype: `Plumber`, `Restaurant`, `Hotel`,
`Dentist`...); FAQ section already on the page -> `FAQPage` with `mainEntity` Questions copied from the page;
service page -> `Service`; blog post -> `Article` plus `ogType="article"` on `<Base>`.

## gsc_low_ctr (Search Console: many impressions, few clicks)
The data says a query is shown (impressions) but not clicked (CTR). `get_search_console` returns **separate**
lists of top queries and top pages (10 each): it does not say which page ranks for which query. So: read the
top page with the most impressions, check that its content really answers the query, then rewrite its title and
description around the query's wording and intent (put the query's key words first, add a concrete benefit).
Do not change the URL. Judge the effect after 2-4 weeks, not the next day (Google data lags 2-3 days).
If the site has fewer than 100 clicks in 28 days, say so: it is too little data to conclude anything.
**Verification is different for this type:** the `gsc_low_ctr` finding comes from Google's data, so it stays in the audit until Google re-crawls
(weeks). Do NOT undo the fix because the finding is still there. Verify instead that the served `<title>` and meta description equal what you wrote
(`seo-audit.mjs <site> --live` shows them; the audit marks the pair as WAITING for 28 days). Record `gsc_before` (the page's row in `gsc.top_pages`) in the log.

## live_title_differs / live_not_200
`live_title_differs` right after your own edit means you have not published yet (or the deploy is still going):
publish, wait ~30 s, run the audit with `--live` again. If you did NOT edit that page and the live page differs from the source, the owner has
unpublished edits: do not publish, tell the owner (see `seo-log.mjs drift`). `live_not_200` on a page: publish again, then
`kleap status <site>`; if it persists, revert your last change and report it.

## Manual audit (agents without a shell: ChatGPT, Claude.ai, Grok API)
No script available? Do the same checks by hand with the MCP tools: `list_app_files` -> `read_files` on every
`src/pages/*.astro` (and `src/components/Header.astro` / `Footer.astro` for the nav links) -> for each page check:
title 30-60 chars and unique, description 70-160 chars and unique, exactly one `<h1>`, every `<img>` has `alt`,
every internal `href="/..."` points to a page that exists, the homepage passes a `schema` prop, the page has
about 120+ words. Then `get_search_console` for low-CTR queries. Rank findings: broken things first (missing
title/description, dead links), then low-CTR rewrites, duplicates, alt, schema, thin pages.
