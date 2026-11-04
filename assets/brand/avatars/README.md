# BPSQuant profile pictures

Square avatars for BPSQuant accounts. Generated from the SVG sources in the
folder above (`avatar-*.svg`) — regenerate rather than editing the PNGs.

Most platforms crop an avatar to a circle. The mark is sized to sit well inside
that circle, so nothing is clipped at any crop.

## Which one

| Version | Use |
|---|---|
| **navy** | **The default.** Highest contrast, reads at every size, works on light and dark pages. |
| gradient | Matches the website exactly. Softer at small sizes. |
| white | Directories and documents that want a light logo. |
| mark-transparent | Slides, letters, print. **Not** a profile picture — see below. |
| navy-circle / white-circle | Already cut to a circle, transparent corners. For email signatures and anywhere the image is shown uncropped. |

Each comes at 1024, 512, 400, 300 and 180 px.

## Where each one goes

| Account | Wants | Upload |
|---|---|---|
| Google Business Profile | 720 × 720 | `bpsquant-avatar-navy-1024.png` |
| Google Workspace / Gmail | 250 × 250 min | `bpsquant-avatar-navy-512.png` |
| LinkedIn company page | 300 × 300 | `bpsquant-avatar-navy-400.png` |
| Facebook / Instagram | 170 × 170 shown | `bpsquant-avatar-navy-512.png` |
| X / Twitter | 400 × 400 | `bpsquant-avatar-navy-400.png` |
| WhatsApp Business / Zalo | any square | `bpsquant-avatar-navy-512.png` |
| Email signature | small, usually on white | `bpsquant-avatar-navy-circle-512.png` |
| Slides, letters, print | no background | `bpsquant-mark-transparent-1024.png` |

## Two things to watch

**Upload the biggest file.** Every platform downsizes well and upsizes badly.
When in doubt send the 1024.

**Never use the transparent PNG as a profile picture.** Its corners go black on
dark themes and white on light ones, so the avatar changes shape depending on
where it is seen. Use navy.

## Regenerating

The PNGs are rendered from the SVGs with headless Chromium at each exact size,
so they are crisp at every size rather than resampled from one master. The
circle versions are cut from the 1024 with an 8× supersampled mask.
