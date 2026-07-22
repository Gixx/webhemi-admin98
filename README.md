# webhemi-admin98

Windows 98–style admin desktop UI experiment for [WebHemi](https://github.com/Gixx/WebHemi).

A teal desktop shell with draggable icons/windows, built on [98.css](https://github.com/jdan/98.css) for window chrome and controls. Custom code covers the desktop, icons, drag/resize/localStorage, Control Panel feature panel, and wizard layout. Vanilla HTML, CSS, and JS — no build step required.

## Run locally

```bash
npm install
npm run dev
```

This serves the project on http://127.0.0.1:8765/ and opens it in your browser. Styles load from `node_modules/98.css/dist/`.

## Status

Early concept. Window chrome and controls use **98.css 0.1.21** via npm. Shell UX: title-bar Close/Minimize/Maximize, double-click desktop/Control Panel icons to open windows (`data-open-window`), positions persisted in localStorage. Custom pieces: desktop, icons, feature panel, wizard layout, resize handles.

Win98-styled scrollbars are emulated in JavaScript for `.scrollable` hosts (`assets/script/scrollbar.js`): content is moved into a `.scrollable-viewport`, the native bar is hidden, and custom rails appear only for axes that actually overflow.

## License

[MIT](LICENSE)
