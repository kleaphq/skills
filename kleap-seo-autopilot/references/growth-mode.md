# Level 2: growth proposals (one a week, only with the owner's yes)

When the checklist passes, the daily fixes run dry: most Kleap sites are small and `Base.astro` already emits the title, description,
canonical, Open Graph and JSON-LD. What still moves rankings is more of the right content. The audit prints `GROWTH IDEAS`; pick ONE.
You propose, the owner approves, then you build. Facts only: every sentence must already be on the site or confirmed by the owner in this chat.
Never invent prices, addresses, phone numbers, ratings, opening hours, credentials, years or reviews.

| Idea (audit `type`) | Why | What you propose |
|---|---|---|
| `single_page_site` | One page competes for one keyword set. A page per service, room or product can rank for many long-tail searches. | Pick the section the site already describes best. Propose slug, `<title>` (30-60), description (70-160), one `<h1>`, 2-4 sections built from the sentences already on the homepage, one link from the nav/homepage, a schema node (`Service`, `Product`, `HotelRoom`...). |
| `query_without_page` | Google shows the site for a query that no page uses. | Name the query, the page that ranks, the section to add or the new page, and the heading that answers it in the query's own words. No keyword stuffing. |
| `no_faq` | Real questions earn rich results and answer buyers. | Ask the owner for 3-6 real questions and answers (or take them from the site's own text). Build a `<section>` with `<details>/<summary>` and a `FAQPage` node in the page's `schema` prop. |
| `no_llms_txt` | AI search tools read a short plain-text summary. | `public/llms.txt`: business name, one paragraph, the key pages with full URLs, contact details only if the site shows them. |

## How to build an approved proposal
1. `seo-backup.mjs backup` every existing file you will touch (a new file has nothing to back up).
2. New page: `$K files write $SITE src/pages/<slug>.astro --file <local>`. Copy the structure of the homepage (the same `<Base title description schema>` wrapper, header and footer) so design and SEO stay consistent. Add ONE contextual link to it from the homepage or nav with descriptive anchor text (never "click here"), using `files edit`.
3. `$K publish $SITE`, then `seo-audit.mjs $SITE --live`: the new page must show up with its own title, description, one `<h1>`, and must not be an orphan. The publish report must show no new `broken_links` / `dead_nav_links`.
4. Undo if it fails: restore the edited files from the backup and remove ONLY the file you created in this run (the one place where removing a file is allowed). Publish again. Log `"reverted": true`.
5. Log the fix as `{"page":"/new-page","type":"growth_new_page", ...}` so `measure` can look at that page's Google numbers later.

Limits: one proposal per week per site, never applied without a yes, never replaces or deletes existing content, never touches the protected files.
