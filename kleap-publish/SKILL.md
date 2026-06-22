---
version: 0.1.0
name: kleap-publish
description: >-
  Publish a Kleap site to its live URL and confirm it is actually serving (the
  verified-live guarantee), then connect a custom domain the user owns. Use when
  the user wants to "publish", "put it live", "deploy", "go live", or "connect my
  domain" for a site made on Kleap. Requires the Kleap MCP server connected.
---

# Publish a Kleap site (verified-live) and connect a domain

## Publish

1. `publish_app({ app_id })` → starts a deploy, returns quickly.
2. `get_publish_status({ app_id })` → poll until `status: "published"` with a
   `production_url`. Only then tell the user it's live, and give that URL.

**The golden rule:** a deploy being *started* is NOT *live*. If status is not
`published`, say so plainly and, on an error, surface the real message — never
invent a working URL. If it failed, fix the cause (see **kleap-edit**) and
publish again.

## Connect a custom domain

The site must be live first.

1. The user must own the domain and point it at Kleap (Kleap returns the exact
   DNS target). For an apex/root domain this is an A record — root domains can't
   use CNAME, that's by design.
2. `connect_domain({ app_id, domain })` — attaches the domain.
3. `check_domain({ app_id, domain })` — poll the connection / DNS / SSL status.
   SSL is issued automatically on the first visit; allow for DNS propagation.

Need a domain? `search_domains({ query })` finds available ones; the actual
purchase stays user-confirmed.

## Notes

- Publishing uses no Kleap credits.
- Publication can also happen automatically after a build, but always confirm
  with `get_publish_status` before reporting a live URL.
