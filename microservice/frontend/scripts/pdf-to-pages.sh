#!/usr/bin/env bash
# PDF -> satu WebP per halaman + manifest.json, siap diupload ke bucket privat
# 'ebooks/<slug>/pages/'. Reader neutrack menampilkan gambar ini (bukan render
# PDF), jadi konversi dilakukan sekali di sini, offline.
#
# Butuh: pdftoppm (poppler-utils) + cwebp (webp).
#   Ubuntu: sudo apt install poppler-utils webp
#
# Pakai:
#   scripts/pdf-to-pages.sh buku.pdf <slug>
#   -> out/<slug>/pages/page-0001.webp ... + manifest.json
# Lalu upload isi out/<slug>/pages/ ke Storage: ebooks/<slug>/pages/
# dan set products.pages_path='<slug>/pages', products.page_count=<jumlah>.
set -euo pipefail

PDF="${1:?Usage: pdf-to-pages.sh <file.pdf> <slug>}"
SLUG="${2:?Usage: pdf-to-pages.sh <file.pdf> <slug>}"
WIDTH="${WIDTH:-1600}"      # lebar target px
QUALITY="${QUALITY:-75}"    # kualitas cwebp
OUT="out/${SLUG}/pages"

command -v pdftoppm >/dev/null || { echo "pdftoppm tidak ada (apt install poppler-utils)"; exit 1; }
command -v cwebp   >/dev/null || { echo "cwebp tidak ada (apt install webp)"; exit 1; }

rm -rf "$OUT"; mkdir -p "$OUT"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# 1. PDF -> PNG per halaman pada lebar tetap (rasio dijaga).
pdftoppm -png -scale-to-x "$WIDTH" -scale-to-y -1 "$PDF" "$tmp/page"

# 2. PNG -> WebP; target <250KB/halaman (turunkan QUALITY kalau kelebihan).
i=0
for png in "$tmp"/page-*.png; do
  i=$((i+1))
  n=$(printf "%04d" "$i")
  cwebp -quiet -q "$QUALITY" -resize "$WIDTH" 0 "$png" -o "$OUT/page-$n.webp"
  kb=$(( $(stat -c%s "$OUT/page-$n.webp") / 1024 ))
  [ "$kb" -gt 250 ] && echo "  ! page-$n.webp ${kb}KB (>250KB) — turunkan QUALITY"
done

# 3. Rasio halaman pertama untuk layout reader.
read -r W H < <(identify -format "%w %h" "$OUT/page-0001.webp" 2>/dev/null || echo "$WIDTH 0")
printf '{"pages":%d,"width":%d,"height":%d}\n' "$i" "$W" "$H" > "$OUT/manifest.json"

echo "OK: $i halaman -> $OUT (page_count=$i)"
