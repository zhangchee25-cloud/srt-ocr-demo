# SRT OCR Studio

A public browser-based OCR demo backed by the GLM-OCR Checkpoint 3500 model.

- Upload JPG, PNG, or WebP images up to 10 MB.
- Compare the source image and recognized text side by side.
- Try the bundled Dunhuang layout visualization when the live model is offline.
- Copy results or download them as UTF-8 text.

The frontend is deployed with GitHub Pages. GPU inference runs on a separate, temporary HTTPS endpoint and may be offline outside the demo window. Uploaded images and recognition results are processed in memory and are not retained.

## Frontend development

```bash
cd site
npm ci
npm run dev
```

Build the GitHub Pages export with:

```bash
NEXT_PUBLIC_BASE_PATH=/srt-ocr-demo npm run build
```

The browser reads `site/public/runtime-config.json` at startup to discover the current inference endpoint.
