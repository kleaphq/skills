---
version: 0.2.0
name: kleap-publish
description: >-
  Publish a Kleap site to its live URL and confirm it is actually serving (the
  verified-live guarantee), then give it a custom domain: buy a new one (a
  checkout link the USER pays) or connect one the user already owns. Use when
  the user wants to "publish", "put it live", "deploy", "go live", "buy a
  domain" or "connect my domain" for a site made on Kleap. Requires the Kleap
  MCP server connected.
---

# Publish a Kleap site (verified-live) and give it a domain

## Publish

1. `publish_app({ app_id })` → starts a deploy, returns a `deploy_key` quickly.
   If a deploy is already running you get it back (`already_running`) — don't
   call `publish_app` again.
2. `get_publish_status({ app_id, deploy_key, wait: 45 })` → repeat until
   `status: "published"` with a `production_url`. Only then tell the user it's
   live, and give that URL. The response's `report` lists broken internal links
   and SEO coverage — read it instead of re-auditing the site.

**The golden rule:** a deploy being *started* is NOT *live*. If status is not
`published`, say so plainly and, on an error, surface the real message — never
invent a working URL. If it failed, fix the cause (see **kleap-edit**) and
publish again.

## Buy a new domain (the user pays)

1. `search_domains({ query })` — ONE word, no spaces, no TLD (`"cafelumiere"`,
   not "Café Lumière"). Optional `tlds: [".com", ".fr"]`. Offer the names with
   `status: "free"` and their price.
2. `buy_domain({ domain, years?, app_id? })` → `{ checkout_url, price,
   currency, expires_at }`. **This does not buy anything.** Give the user the
   `checkout_url` and say they need to open it and pay. With `app_id`, the
   domain is connected to that site automatically once paid.
3. After the user says they paid: `check_domain({ domain })`. Only when it
   answers (`active`, or `pending_dns` while DNS/TLS settle) is the domain
   theirs. Never say "bought", "registered" or "live" before that.

A `403 INSUFFICIENT_SCOPE` means the connection predates checkout: API key →
create a new key with the **Full** preset; OAuth connector → reconnect Kleap.

## Connect a domain the user already owns

The site must be live first (a completed build counts). Paid plan required
(`403 PLAN_REQUIRED` otherwise).

1. `connect_domain({ app_id, domain })` — returns `dns_config` with the exact A
   records. Relay them: for an apex/root domain it is an A record — root
   domains can't use CNAME, that's by design.
2. `check_domain({ domain })` — `pending_dns` (relay the message; propagation
   5-60 min, sometimes hours), `aaaa_conflict` (the user must delete the AAAA
   record), `active` (serving; TLS issues automatically on the first visit).

## Notes

- Publishing uses no Kleap credits.
- Publication can also happen automatically after a build, but always confirm
  with `get_publish_status` before reporting a live URL.
