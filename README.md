# webhemi-admin98

Windows 98–style admin desktop UI experiment for [WebHemi](https://github.com/Gixx/WebHemi).

A teal desktop shell with draggable icons/windows, built on [98.css](https://github.com/jdan/98.css) for window chrome and controls. Custom code covers the desktop, icons, drag/resize/localStorage, Control Panel feature panel, and wizard layout. Vanilla HTML, CSS, and JS — no build step required.

## Run locally

```bash
# any static server, e.g.:
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

Or open `index.html` directly in a browser (some features prefer http://).

## Status

Early concept. Window chrome and controls use vendored **98.css 0.1.21** (`assets/vendor/`, Pixelated MS Sans Serif). Product-specific shell pieces remain custom (desktop, icons, feature panel, wizard layout, resize handles).

## License

[MIT](LICENSE)
