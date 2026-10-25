# Tutorial de instalação (vídeo e GIF)

Gera `tutorial/instalar-ios.{mp4,gif}` e `tutorial/instalar-android.{mp4,gif}`, publicados em
`https://pedro-herve.github.io/petit-a-petit/tutorial/`.

- `ios/*.png`: telas reais do Safari no iOS 27 (simulador, em português).
- `frames.html`: desenha cada quadro (legenda, celular, marcação de toque). Abra com `?f=ios-3-b` para ver um quadro.
- `render.mjs`: captura os quadros com o Chrome em modo headless (precisa do servidor local: `npm run serve`).
- `make-media.swift`: monta o MP4 (720×1280) e o GIF (540×960).

```bash
npm run serve &
node tools/tutorial/render.mjs
swift tools/tutorial/make-media.swift tools/tutorial/out ios tutorial 9
swift tools/tutorial/make-media.swift tools/tutorial/out android tutorial 8
```
