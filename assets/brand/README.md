# BPSQuant brand assets

BasicPointQuant LLC · brand name **BPSQuant**

The mark is the hexagon already used on the website and favicon, rebuilt so it also
survives white paper, greyscale and a 16 px favicon. The dot at the top of the rising
line is the **basis point** — the smallest increment, and the thing the company is
named after. It is also what keeps the mark readable when it is tiny.

## Files

| File | Use |
|---|---|
| `logo-horizontal-dark.svg` | Website, app, dark decks |
| `logo-horizontal-light.svg` | White backgrounds, print, email signature |
| `logo-legalname-light.svg` | **Contracts, letterhead, anything an investor signs** |
| `logo-stacked-light.svg` | Narrow spaces, stamps, business card |
| `mark.svg` | Mark alone, screen gradient |
| `mark-ink.svg` | Mark alone, two-colour for paper |
| `mark-mono.svg` | Single ink — fax, photocopy, bank forms, rubber stamp. Honours CSS `color`. |
| `favicon.svg` | 32 px favicon, dark tile, screen gradient |
| `favicon-ink.svg` | 32 px favicon, solid navy tile (no gradient) |
| `letterhead.html` | A4 letterhead — page 1 full, page 2 continuation sheet |
| `avatar-*.svg` | Square avatar sources (navy, gradient, white, transparent) |
| `avatars/` | **Profile pictures as PNG**, 1024–180 px, plus which file goes on which account — see `avatars/README.md` |
| `bpsquant-logo-files.zip` | Everything above in one download, for handing to a printer or a designer |

## Colour

Two palettes, one mark. The screen gradient prints muddy, and `#5EEAD4` on white
is almost invisible — so paper gets its own solid pair.

| Role | Hex | Where |
|---|---|---|
| Ink navy | `#0B2239` | Wordmark and hexagon on white; body text in printed documents |
| Teal (print) | `#0D9488` | Chart line, basis-point dot, rules, headings on paper |
| Teal (screen) | `#5EEAD4` | Website only — never on white |
| Indigo | `#6366F1` | End of the screen gradient |
| Night | `#070A14` | Website background |
| Muted | `#64748B` | Secondary text, footers, legal fine print |

Screen gradient: `linear-gradient(120deg, #5EEAD4 0%, #6366F1 100%)`

## Rules

- Clear space on all sides: at least the height of the hexagon.
- Minimum sizes — mark alone **16 px**; horizontal lockup **120 px** wide;
  legal-name lockup **170 px** wide.
- Do not restretch, recolour, outline, shadow or rotate the mark.
- Never put the gradient version on a white background.
- **BasicPointQuant LLC** on anything legal; **BPSQuant** for the product and the site.

## Putting the letterhead on a document

`letterhead.html` is a working A4 template. To brand an existing HTML document,
copy the header block and this CSS:

```css
.lh { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
.lh__brand { display:flex; align-items:center; gap:13px; }
.lh__mark { width:46px; height:46px; flex:none; }
.lh__name { font-size:20pt; font-weight:800; letter-spacing:-0.6px; color:#0B2239; line-height:1.05; }
.lh__name .q   { font-weight:400; color:#334155; }
.lh__name .llc { font-weight:400; font-size:11pt; color:#64748B; letter-spacing:0; }
.lh__tag  { font-size:7.4pt; font-weight:600; letter-spacing:2.2px; color:#0D9488; margin-top:3px; }
.lh__meta { text-align:right; font-size:7.6pt; line-height:1.6; color:#475569; padding-top:3px; }
.rule { height:2.5px; margin:11px 0 0;
        background:linear-gradient(90deg,#0D9488 0%,#0B2239 55%,rgba(11,34,57,0.12) 100%); }
```

Inline the mark as SVG rather than linking it — a linked file will not render when
the document is converted to PDF or opened from another folder.

## Typography

Website and logo: **Inter** (800 for `BPS` / `BasicPoint`, 400 for `Quant`).
Printed documents fall back to DejaVu Sans, which covers Vietnamese diacritics —
that matters, because the investor documents are bilingual.

The SVG lockups use live text, not outlines. If a printer or a partner renders them
without Inter installed, the fallback is Helvetica/Arial and the spacing shifts
slightly. For anything going to a commercial printer, outline the text first.
