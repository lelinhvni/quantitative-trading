#!/usr/bin/env bash
# ============================================================
# Release: test, bump the cache version if needed, commit, publish
# to main, and confirm the LIVE site serves exactly what was built.
#
#   scripts/release.sh -m "Commit message"      full release
#   scripts/release.sh --dry-run                tests + say what would happen
#   scripts/release.sh -m "..." --no-wait       publish, skip the live check
#
# It exists because two mistakes reached the live site by hand:
#   1. scripts changed but the ?v= cache version did not, so returning
#      visitors kept the old files;
#   2. a build "succeeded" without anyone checking what was being served.
#
# Publishing is a fast-forward of main to this branch. If main has moved
# on, it stops rather than merging or force-pushing.
# ============================================================
set -euo pipefail

SITE="${SITE_URL:-https://www.bpsquant.com}"
MSG=""; DRY=0; WAIT=1
while [ $# -gt 0 ]; do
  case "$1" in
    -m) MSG="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --no-wait) WAIT=0; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mSTOP: %s\033[0m\n' "$*" >&2; exit 1; }

BRANCH="$(git branch --show-current)"
[ -n "$BRANCH" ] || die "detached HEAD"
[ "$BRANCH" != "main" ] || die "run this from a working branch, not main"
[ "$DRY" = 1 ] || [ -n "$MSG" ] || die "need -m \"message\" (or --dry-run)"

# ---------- 1. tests ----------
say "1/5 tests"
node --test tests/*.test.js 2>&1 | grep -E '^# (tests|pass|fail)' || true
node --test tests/*.test.js >/dev/null 2>&1 || { node --test tests/*.test.js 2>&1 | grep -E '^not ok' ; die "tests failed — nothing was changed"; }
echo "all passing"

# ---------- 2. cache version ----------
say "2/5 cache version"
CUR="$(grep -ohE 'v=[0-9]{8}[a-z]+' index.html | head -1 | cut -d= -f2)"
[ -n "$CUR" ] || die "cannot read the current ?v= from index.html"

# What changed since the commit that introduced the current version?
INTRO="$(git log -S"v=$CUR" --format=%H -- index.html | tail -1)"
if [ -n "$INTRO" ]; then
  CHANGED="$( { git diff --name-only "$INTRO" -- scripts styles assets; git diff --name-only -- scripts styles assets; git ls-files --others --exclude-standard -- scripts styles assets; } | sort -u | grep -vE '\.(md|sh)$|/brand/' || true)"
else
  CHANGED="(could not find where $CUR was introduced — assuming changed)"
fi

NEW="$CUR"
if [ -n "$CHANGED" ]; then
  TODAY="$(date -u +%Y%m%d)"
  if [ "${CUR:0:8}" = "$TODAY" ]; then
    LETTER="${CUR:8}"; NEXT="$(printf "\\x$(printf %x $(( $(printf '%d' "'$LETTER") + 1 )))")"
    [ "$NEXT" \> "z" ] && die "ran out of letters for $TODAY"
    NEW="$TODAY$NEXT"
  else
    NEW="${TODAY}a"
  fi
  echo "changed since $CUR:"; echo "$CHANGED" | sed 's/^/  /'
  echo "bumping $CUR -> $NEW"
else
  echo "no script or style changes since $CUR — version stays"
fi

if [ "$DRY" = 1 ]; then
  say "dry run — stopping here"
  echo "would publish branch '$BRANCH' to main as version $NEW"
  exit 0
fi

if [ "$NEW" != "$CUR" ]; then
  grep -lE "v=$CUR" ./*.html | xargs sed -i "s/v=$CUR/v=$NEW/g"
  node --test tests/*.test.js >/dev/null 2>&1 || die "tests fail after the version bump"
fi

# ---------- 3. commit ----------
say "3/5 commit"
git add -A
if git diff --cached --quiet; then
  echo "nothing to commit"
else
  git commit -q -m "$MSG"
  git log --oneline -1
fi

# ---------- 4. publish ----------
say "4/5 publish"
git push -u origin "$BRANCH" 2>&1 | tail -1
git fetch -q origin main
git merge-base --is-ancestor origin/main HEAD \
  || die "main has commits this branch does not. Merge or rebase first — not forcing."
git push origin HEAD:main 2>&1 | tail -1

# ---------- 5. verify live ----------
[ "$WAIT" = 1 ] || { say "published (live check skipped)"; exit 0; }
say "5/5 confirming the live site serves this build"
if ! curl -sS -o /dev/null --max-time 15 "$SITE/index.html"; then
  echo "cannot reach $SITE from here — published, but NOT verified live"; exit 0
fi

# Bounded wait: GitHub Pages usually takes under a minute. No endless polling.
ok=0
for delay in 15 20 25 30 40 50 60 60; do
  sleep "$delay"
  LIVE="$(curl -sS --max-time 20 "$SITE/index.html" | grep -oE 'v=[0-9]{8}[a-z]+' | head -1 | cut -d= -f2 || true)"
  echo "  live version: ${LIVE:-unreachable} (want $NEW)"
  [ "$LIVE" = "$NEW" ] && { ok=1; break; }
done
[ "$ok" = 1 ] || die "live site never reached $NEW within ~5 minutes. Check the Pages build in the Actions tab."

# The version string only proves the HTML updated. Compare the actual files.
bad=0
for f in scripts/*.js styles/*.css; do
  [ -f "$f" ] || continue
  grep -qE "$(basename "$f")" ./*.html || continue          # only files a page loads
  want="$(sha256sum "$f" | cut -d' ' -f1)"
  got="$(curl -sS --max-time 20 "$SITE/$f?v=$NEW" | sha256sum | cut -d' ' -f1)"
  if [ "$want" = "$got" ]; then printf '  identical  %s\n' "$f"
  else printf '  \033[31mDIFFERENT\033[0m  %s\n' "$f"; bad=$((bad+1)); fi
done
[ "$bad" = 0 ] || die "$bad file(s) on the live site differ from this build (CDN lag? re-run the check in a minute)"
say "live and verified: $SITE is serving version $NEW, every file identical"
