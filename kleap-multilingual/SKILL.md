---
version: 0.2.0
name: kleap-multilingual
description: >-
  Make a Kleap (Astro) site multilingual / bilingual — the same site in two or
  more languages with a language switcher and correct per-language <html lang>,
  hreflang and SEO. Use when the user wants a site "in French and English", "in
  two / multiple languages", "bilingual", "translated", "with /en/ and /fr/",
  "i18n", or "a language switcher". Requires the Kleap MCP server connected.
---

# Make a Kleap site multilingual

Kleap sites are Astro. There is exactly ONE way to do i18n that works on the
platform — follow it precisely. You write the files with `write_files` (see the
**kleap-edit** skill), or pass these requirements inside a `create_app` prompt.

## The hard rule — what is IMPOSSIBLE (and silently ignored)

`astro.config.mjs` and `package.json` are platform-owned scaffold: any version
you push is **discarded**. Therefore:

- ❌ Astro native i18n (the `i18n:{}` config block, `Astro.currentLocale`) — needs
  astro.config → does nothing.
- ❌ Every i18n npm library (`astro-i18next`, `paraglide`, `i18next`, …) — needs a
  package.json dependency → does nothing.

If you try these, the build ignores them and you get one language. The ONLY
approach that works is the zero-dependency dictionary below.

## The recipe (zero dependencies, zero config)

### 1. Routing — default locale at the root, each extra locale in its own folder

Every locale needs its OWN `index.astro`. Mirror the page tree:

```
src/pages/index.astro      ->  /          (default locale, e.g. fr)
src/pages/about.astro      ->  /about
src/pages/en/index.astro   ->  /en/
src/pages/en/about.astro   ->  /en/about
```

### 2. Dictionary — `src/i18n/ui.ts` + `src/i18n/utils.ts`

```ts
// src/i18n/ui.ts
export const languages = { fr: "Français", en: "English" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "fr";
export const ui = {
  fr: { "nav.home": "Accueil", "nav.about": "À propos" },
  en: { "nav.home": "Home", "nav.about": "About" },
} as const;
```

```ts
// src/i18n/utils.ts
import { ui, defaultLang, type Lang } from "./ui";
export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split("/")[1];
  return (seg in ui ? seg : defaultLang) as Lang;
}
export function useTranslations(lang: Lang) {
  return (key: keyof (typeof ui)[typeof defaultLang]) =>
    (ui[lang] as Record<string, string>)[key] ??
    (ui[defaultLang] as Record<string, string>)[key];
}
export function localizePath(path: string, lang: Lang): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === defaultLang ? clean : `/${lang}${clean === "/" ? "/" : clean}`;
}
```

### 3. Shared Header/Footer — derive the locale from the path

ONE component serves every locale (don't duplicate per language). Include a
language switcher that links to the SAME page in the other locale:

```astro
---
import { getLangFromUrl, useTranslations, localizePath } from "../i18n/utils";
const lang = getLangFromUrl(Astro.url);
const t = useTranslations(lang);
const other = lang === "fr" ? "en" : "fr";
const bare = Astro.url.pathname.replace(new RegExp(`^/${lang}`), "") || "/";
const switchHref = localizePath(bare, other);
---
<a href={localizePath("/", lang)}>{t("nav.home")}</a>
<a href={switchHref} class="lang-switch">{other.toUpperCase()}</a>
```

### 4. Every page passes its locale to `<Base>`

This gives the correct per-page `<html lang>` / `<dir>` + hreflang. The
default-locale page can pass `lang` too. Build the `alternates` array = the SAME
page in EVERY locale + one `x-default` (the default locale), ABSOLUTE URLs:

```astro
---
import Base from "../../layouts/Base.astro"; // note: /en/ pages are one dir deeper -> ../../
const alternates = [
  { hreflang: "fr", href: new URL("/", Astro.site).href },
  { hreflang: "en", href: new URL("/en/", Astro.site).href },
  { hreflang: "x-default", href: new URL("/", Astro.site).href },
];
---
<Base title="…" description="…" lang="en" dir="ltr" alternates={alternates}>
  …page content, all text via t("…")…
</Base>
```

Use `dir="rtl"` for Arabic / Hebrew / Persian locales.

## Rules

- Real human translation per locale — never leave a page half-translated, never
  machine-mangle.
- The default locale has NO prefix; only EXTRA locales get a `/<code>/` folder.
- All visible text comes from the dictionary via `t("…")` keys, so one page
  template renders every language.
- Relative import depth: pages under `/<locale>/` are one directory deeper —
  use `../../layouts/Base.astro`, `../../i18n/utils`, etc.
- Never push `astro.config.mjs` or `package.json` (scaffold — discarded).

## Publish

Multilingual changes go live like any edit: `publish_app`, then confirm with
`get_publish_status` (see the **kleap-publish** skill). Only claim a language is
live once the deploy is confirmed and `/<locale>/` actually serves
`<html lang="…">`.
