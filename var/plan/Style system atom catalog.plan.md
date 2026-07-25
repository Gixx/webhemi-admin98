# Style system — atom catalog & Storybook map

Canonical companion to [Sass Tailwind style system.plan.md](./Sass%20Tailwind%20style%20system.plan.md).  
**Storybook is not implemented yet**; this document is the inventory for when it lands.

## Layers

| Layer | Role | Entry |
|-------|------|--------|
| Tokens | `:root` + Tailwind `@theme` | [`assets/style/abstract/tokens.css`](../../assets/style/abstract/tokens.css), [`assets/style/main.css`](../../assets/style/main.css) |
| Abstract | Bevel mixins | [`assets/style/abstract/_bevel.scss`](../../assets/style/abstract/_bevel.scss) |
| Chrome | Win98 control look + markup contract | [`assets/style/chrome.scss`](../../assets/style/chrome.scss) → `chrome/*` |
| Product | Desktop shell, layouts, custom scrollbar | [`assets/style/product.scss`](../../assets/style/product.scss) → `product/*` |
| Demo | Composition | [`index.html`](../../index.html) |

Load order (runtime): `main.css` (Tailwind + tokens) → `chrome.scss` → `product.scss` (both SCSS files imported from [`assets/script/main.js`](../../assets/script/main.js)).

Visual regression for chrome: [`98.css.html`](../../98.css.html) with `npm run dev` → http://127.0.0.1:8765/98.css.html

Upstream reference (not a dependency): [98.css](https://github.com/jdan/98.css) / [docs](https://jdan.github.io/98.css/). Icons/attribution: [`assets/style/chrome/README.md`](../../assets/style/chrome/README.md).

---

## Chrome atoms

Keep **compatible class/markup names** with classic 98.css so demos and future stories stay portable. Optional `wh-` prefix is a later Storybook decision.

| Story / atom | SCSS | Markup / selectors (essentials) |
|--------------|------|----------------------------------|
| Typography | `_typography.scss` | `body` chrome font via `--font-chrome`; `h1`–`h4`; `u` |
| Button | `_button.scss` | `button`, `input[type=submit\|reset]`, `.default`, `:active` / `:disabled` / `:focus`, `.vertical-bar` |
| Window | `_window.scss` | `.window`, `.title-bar` (+ `.inactive`), `.title-bar-text`, `.title-bar-controls` + `aria-label` Minimize/Maximize/Restore/Help/Close, `.window-body`, `.status-bar`, `.status-bar-field` |
| Grouping | `_grouping.scss` | `fieldset` / `legend`, `.field-row`, `.field-row-stacked`, `label` |
| Forms — text | `_forms.scss` | `input[type=text\|password\|email\|…]`, `textarea`, `select` (+ `:open` / `::picker` when supported) |
| Forms — check / radio | `_forms.scss` | `input[type=checkbox\|radio]` + adjacent `label` |
| Slider | `_slider.scss` | `input[type=range]`, `.has-box-indicator`, `.is-vertical` |
| Tabs | `_tabs.scss` | `menu[role=tablist]`, `li[role=tab]` / `aria-selected`, `.window[role=tabpanel]`, `.multirows` |
| TreeView | `_tree-view.scss` | `ul.tree-view` (+ nested `ul`, `details`/`summary`) |
| Surfaces | `_surfaces.scss` | `.sunken-panel`, `table` (+ `.interactive`, `.highlighted`), `.field-border`, `.field-border-disabled`, `.status-field-border` |
| Progress | `_progress.scss` | `.progress-indicator`, `.segmented` > `.progress-indicator-bar` |
| Code | `_code.scss` | `pre`, `code`, `summary:focus` |
| Native scrollbar skin | `_scrollbar.scss` | `::-webkit-scrollbar*` (catalog / non-product; demo uses custom scrollbar brick) |

Bevel language (shared): `@use` mixins from `abstract/_bevel.scss` (`bevel-raised`, `bevel-sunken`, `bevel-window`, `bevel-field`, …).

---

## Product bricks

Not chrome atoms — WebHemi shell / admin UX. Stories later can compose chrome atoms + these.

| Brick / pattern | SCSS | Notes |
|-----------------|------|--------|
| Document shell | `product/_base.scss` | `body.dashboard`, WebHemi `@font-face`, global focus reset |
| DesktopIcon | `product/_desktop.scss` | `.icon`, `.icon-list`, type modifiers (`.settings`, …) |
| Taskbar / StartMenu | `product/_toolbar.scss` | `#toolbar`, `.start-menu`, `.task`, `.clock` |
| Window shell behavior | `product/_window.scss` | `.resizable`, `.bounded`, resize handles, closed/minimized/maximized |
| IconPanelWindow layout | `product/_layouts.scss` | `.icon-panel-layout` |
| WizardWindow layout | `product/_layouts.scss` | `.wizard-panel-layout` |
| HeadingPanel layout | `product/_layouts.scss` | `.heading-panel-layout` |
| DialogWindow layout | `product/_layouts.scss` | `.dialog-panel-layout` |
| Columns / Stack / FieldColumn | `product/_primitives.scss` | `.columns`, `.stack`, `.field-column` |
| Sunken default (override) | `product/_primitives.scss` | `.sunken-panel` → silver (chrome default is white); `.bg-white` opt-out |
| ScrollableRegion | `product/_scrollbar.scss` + [`scrollbar.js`](../../assets/script/scrollbar.js) | `.scrollable`, `.scrollable-viewport`, `.sb-*` |

### Theme utilities (Tailwind)

Defined in `main.css` `@theme` (mirrored in `tokens.css` where useful):

| Utility | Token |
|---------|--------|
| `w-window-2xs` … `w-window-xl` | 175 … 1024px |
| `max-h-window-sm` / `md` / `lg` | 240 / 250 / 500px |
| `min-h-window-md` | 500px |
| `justify-start` / `end` / `center` | built-in Tailwind |
| `bg-desktop`, `font-webhemi`, … | colors / font |

---

## Suggested Storybook hierarchy

When Storybook is added, prefer **one story file per atom/brick**, importing the matching SCSS partial (or a generated CSS chunk). Do not mount the full product desktop unless testing a Component story.

```
Stories/
  Atoms/
    Button
    TextBox
    Checkbox
    Radio
    Select
    Slider
    Window          (static chrome; no drag JS required)
    TitleBar
    TitleBarControls
    StatusBar
    Tab / TabList
    TreeView
    SunkenPanel
    FieldBorder
    Progress
    GroupBox (fieldset)
    FieldRow
  Bricks/
    FieldColumn
    Columns
    Stack
    ScrollableRegion   (needs scrollbar.js or story decorator)
    TitleBarControls+WindowBody
  Components/
    DialogWindow       (dialog-panel-layout)
    IconPanelWindow
    WizardWindow
    HeadingPanelWindow
    Taskbar
    StartMenu
    DesktopIcon
  Foundations/
    Tokens (color / bevel swatches)
    Typography
```

### Story markup tips

- Prefer semantic HTML from the 98.css docs / [`98.css.html`](../../98.css.html) examples.
- Window title-bar buttons need `aria-label="Minimize|Maximize|Restore|Help|Close"` (or `.minimize` etc. class aliases).
- Checkbox/radio: `input` immediately followed by `label[for]`.
- Tabs: `menu[role=tablist]` > `li` > `a`, plus `.window[role=tabpanel]`.
- Product layouts expect `.window-pane` as direct child of `.window-body`, then `.panel` children.

---

## Product overrides to remember

Documented next to the rule in SCSS; called out here for Storybook authors:

- `.sunken-panel` background is **silver** in product (chrome ships white).
- Chrome control font size is **12px** WebHemi (product reinforces antialiasing).
- Custom scrollbar replaces reliance on chrome `_scrollbar.scss` inside `.scrollable` hosts.

---

## Out of scope (still)

- Storybook package / CI
- Symfony / Next packaging
- Renaming JS-coupled classes (`.scrollable-viewport`, `.sb-*`) for a `wh-` prefix
