#!/usr/bin/env bash
# Deja el APK, las capturas y los registros en la rama `apk` (un solo commit
# que se reemplaza cada vez). Lo usa .github/workflows/android.yml.
set -u
estado="${1:-compilado}"
raiz="$(git rev-parse --show-toplevel)"
salida="$(mktemp -d)"
apk="$(ls "$raiz"/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)"
if [ -n "$apk" ]; then
  cp "$apk" "$salida/DinoRefugio.apk"
  basename "$apk" > "$salida/nombre.txt"
fi
cp "$raiz"/*.log "$salida"/ 2>/dev/null || true
cp "$raiz"/pantalla-*.png "$salida"/ 2>/dev/null || true
{
  echo "estado: $estado"
  echo "apk: $([ -n "$apk" ] && echo si || echo no)"
  echo "commit: ${GITHUB_SHA:-local}"
  echo "rama: ${GITHUB_REF_NAME:-local}"
  echo "fecha: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  [ -n "$apk" ] && echo "tamano: $(stat -c %s "$apk") bytes" && echo "sha256: $(sha256sum "$apk" | cut -d' ' -f1)"
} > "$salida/estado.txt"
cat > "$salida/README.md" <<EOF
# Dino Refugio para Android

Descarga **DinoRefugio.apk** en tu teléfono y ábrelo para instalarlo
(Android pedirá permiso para instalar apps de fuera de la tienda).

Esta rama la genera sola la compilación automática; no la edites a mano.

\`\`\`
$(cat "$salida/estado.txt")
\`\`\`
EOF
cd "$salida" || exit 1
git init -q -b apk
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "APK de ${GITHUB_SHA:-local} ($estado)"
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" apk
else
  echo "Sin GITHUB_TOKEN: resultado en $salida"
fi
