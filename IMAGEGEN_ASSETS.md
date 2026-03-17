# Vintage Asset Generation (imagegen skill)

The app currently uses CSS/textural placeholders and local assets.
When `OPENAI_API_KEY` is available, generate final cohesive assets with:

```powershell
$env:CODEX_HOME = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { "$HOME/.codex" }
$IMAGE_GEN = "$env:CODEX_HOME/skills/imagegen/scripts/image_gen.py"
```

## Output directory

```powershell
New-Item -ItemType Directory -Force output/imagegen | Out-Null
```

## 1) Notebook paper background

```powershell
python $IMAGE_GEN generate --prompt "Use case: ui-mockup. Asset type: desktop app background texture. Primary request: weathered vintage notebook paper with subtle watercolor sky wash and hand-drawn edge noise. Style/medium: scanned mixed media texture. Composition/framing: seamless tileable texture. Lighting/mood: soft daylight, low contrast. Constraints: no text, no logos, no characters, no watermark." --size 1536x1024 --quality high --out output/imagegen/paper-texture.png
```

## 2) Sidebar icon stamp sheet

```powershell
python $IMAGE_GEN generate --prompt "Use case: ui-mockup. Asset type: icon sheet. Primary request: hand-inked detective UI icons for home, search, result, history, downloads, settings, diagnostics, about. Style/medium: ink stamp line-art with vintage print imperfections. Composition/framing: even grid, transparent-friendly spacing. Constraints: no words, no watermark." --size 1024x1024 --quality high --out output/imagegen/icon-sheet.png
```

## 3) Header badge

```powershell
python $IMAGE_GEN generate --prompt "Use case: illustration-story. Asset type: title badge. Primary request: playful vintage detective sign reading 'Where's Waldo Finder' in clear legible lettering, red and blue ink palette, torn paper label shape. Constraints: keep text exact; no watermark." --size 1536x1024 --quality high --out output/imagegen/header-badge.png
```

## 4) Magnifier prop

```powershell
python $IMAGE_GEN generate --prompt "Use case: stylized-concept. Asset type: UI decorative prop. Primary request: hand-painted vintage magnifying glass with wooden handle, isolated on transparent-like clean background. Constraints: no text, no watermark." --size 1024x1024 --quality high --background transparent --output-format png --out output/imagegen/magnifier.png
```

## 5) Tip badge character

```powershell
python $IMAGE_GEN generate --prompt "Use case: illustration-story. Asset type: helper badge portrait. Primary request: cheerful striped-shirt detective mascot portrait in friendly 2D watercolor ink style for UI tip callouts. Constraints: no text, no watermark." --size 1024x1024 --quality high --out output/imagegen/tip-badge.png
```

## Integration targets

- `public/vintage/paper-texture.png`
- `public/vintage/icon-sheet.png`
- `public/vintage/header-badge.png`
- `public/vintage/magnifier.png`
- `public/vintage/tip-badge.png`

After generation, copy approved files from `output/imagegen/` into `public/vintage/` and wire into CSS/components.
