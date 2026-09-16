# SRT OCR Studio frontend

Static Next.js export for GitHub Pages. The production site is built with the
`/srt-ocr-demo` base path and reads `public/runtime-config.json` at startup to
discover the temporary GPU inference endpoint.

```bash
npm ci
npm run dev
NEXT_PUBLIC_BASE_PATH=/srt-ocr-demo npm run build
```

The build output is written to `out/`. When the public GPU job restarts, update
`public/runtime-config.json` and push `main`; the Pages workflow republishes the
site automatically.
