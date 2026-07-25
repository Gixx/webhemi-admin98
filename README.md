# webhemi-admin98

Windows 98–style admin desktop UI experiment for [WebHemi](https://github.com/Gixx/WebHemi).

A teal desktop shell with draggable icons/windows. Window chrome is an owned SCSS port of the [98.css](https://github.com/jdan/98.css) surface (`assets/style/chrome/`). Custom code covers the desktop, icons, drag/resize/localStorage, Control Panel feature panel, taskbar, and wizard layout.

Styles are built with **Vite**, **Sass**, and **Tailwind CSS v4**.

## Run locally

```bash
npm install
npm run dev
```

This starts Vite on http://127.0.0.1:8765/ and opens it in your browser.

```bash
npm run build    # production bundle into dist/
npm run preview  # serve the production build
```

### Chrome catalog page

With the dev server running, open http://127.0.0.1:8765/98.css.html — a saved [98.css docs](https://jdan.github.io/98.css/) page wired to **our** chrome (not the npm package), useful for checking every control.

## Style system

| Path | Role |
|------|------|
| `assets/style/main.css` | Tailwind `@theme` + design tokens |
| `assets/style/chrome/` | Win98 chrome atoms (buttons, window, forms, …) |
| `assets/style/product/` | Desktop shell, toolbar, pane layouts, custom scrollbar |
| `assets/style/abstract/` | Shared tokens + bevel mixins |

Plans (English):

- [Sass + Tailwind style system](var/plan/Sass%20Tailwind%20style%20system.plan.md) — architecture & implementation steps (complete through documentation)
- [Style system atom catalog](var/plan/Style%20system%20atom%20catalog.plan.md) — atom/brick inventory and suggested Storybook hierarchy

## Status

Early concept. Shell UX: title-bar Close/Minimize/Maximize, double-click icons to open windows (`data-open-window`), positions persisted in localStorage, taskbar with Start menu and clock. Custom scrollbars for `.scrollable` hosts (`assets/script/scrollbar.js`). Win98 chrome is owned SCSS (no npm `98.css` dependency).

## License

[MIT](LICENSE)
