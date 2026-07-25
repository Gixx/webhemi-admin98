/**
 * Shared desktop shell state and geometry helpers.
 */

export const dashboard = document.querySelector('.dashboard');

export const ICON_GRID_ORIGIN_PX = 20;
export const ICON_GRID_STEP_PX = 90;
export const POSITIONS_STORAGE_KEY = 'webhemi.demo.desktop.positions.px';
export const DRAG_THRESHOLD_PX = 4;

/** No top-edge resize: header drag must stay uncontested. */
export const RESIZE_EDGES = ['e', 'w', 's', 'se', 'sw'];

export const RESIZE_CURSORS = {
  e: 'ew-resize',
  w: 'ew-resize',
  s: 'ns-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

export const state = {
  zCounter: 10,
  dragState: null,
  resizeState: null,
  didDrag: false,
};

export const toPx = (value) => `${Number(value.toFixed(2))}px`;

export const toPxNumber = (value) => Number(value.toFixed(2));

export const dashboardRect = () => dashboard.getBoundingClientRect();

export const setPosition = (el, left, top) => {
  el.style.left = toPx(left);
  el.style.top = toPx(top);
};

export const readPosition = (el) => {
  const origin = dashboardRect();
  const rect = el.getBoundingClientRect();

  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
  };
};

export const elementId = (el) => el.id || '';

export const loadPositions = () => {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};

    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
};

export const savePositions = () => {
  const data = {};

  dashboard.querySelectorAll('[draggable="true"]').forEach((el) => {
    const id = elementId(el);
    if (!id) {
      return;
    }

    // Closed windows keep only the closed flag — drop size/position.
    if (el.classList.contains('window') && el.classList.contains('is-closed')) {
      data[id] = { closed: true };
      return;
    }

    if (!el.style.left || !el.style.top) {
      return;
    }

    const pos = readPosition(el);
    data[id] = {
      left: toPxNumber(pos.left),
      top: toPxNumber(pos.top),
    };

    if (el.classList.contains('window')) {
      data[id].zIndex = Number.parseInt(el.style.zIndex, 10) || 1;
      data[id].active = el.classList.contains('active');
      data[id].closed = false;
      data[id].minimized = el.classList.contains('is-minimized');
      data[id].maximized = el.classList.contains('is-maximized');

      if (el.classList.contains('is-maximized')) {
        const restoreLeft = Number.parseFloat(el.dataset.restoreLeft);
        const restoreTop = Number.parseFloat(el.dataset.restoreTop);
        const restoreWidth = Number.parseFloat(el.dataset.restoreWidth);
        const restoreHeight = Number.parseFloat(el.dataset.restoreHeight);

        if (Number.isFinite(restoreLeft)) {
          data[id].left = restoreLeft;
        }

        if (Number.isFinite(restoreTop)) {
          data[id].top = restoreTop;
        }

        if (Number.isFinite(restoreWidth) && restoreWidth > 0) {
          data[id].width = restoreWidth;
        }

        if (Number.isFinite(restoreHeight) && restoreHeight > 0) {
          data[id].height = restoreHeight;
        }
      } else {
        if (el.style.width) {
          data[id].width = toPxNumber(el.offsetWidth);
        }

        if (el.style.height) {
          data[id].height = toPxNumber(el.offsetHeight);
        }
      }
    }
  });

  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(data));
};

export const clamp = (el, left, top) => {
  const maxLeft = Math.max(0, dashboard.clientWidth - el.offsetWidth);
  const maxTop = Math.max(0, dashboard.clientHeight - el.offsetHeight);

  return {
    left: Math.max(0, Math.min(left, maxLeft)),
    top: Math.max(0, Math.min(top, maxTop)),
  };
};

/** Prefer rendered size; fall back to CSS width / max-height when not laid out yet. */
export const measureWindowSize = (el) => {
  void el.offsetWidth;

  const style = getComputedStyle(el);
  let width = el.offsetWidth;
  let height = el.offsetHeight;

  if (width < 1) {
    width = parseCssSize(style.width) || parseCssSize(style.minWidth) || 0;
  }

  if (height < 1) {
    height =
      parseCssSize(style.height) ||
      parseCssSize(style.maxHeight) ||
      parseCssSize(style.minHeight) ||
      0;
  }

  const maxWidth = parseCssSize(style.maxWidth);
  if (maxWidth > 0 && width > 0) {
    width = Math.min(width, maxWidth);
  }

  const maxHeight = parseCssSize(style.maxHeight);
  if (maxHeight > 0) {
    height = height > 0 ? Math.min(height, maxHeight) : maxHeight;
  }

  return { width, height };
};

export const centerWindow = (el) => {
  const { width, height } = measureWindowSize(el);
  const maxLeft = Math.max(0, dashboard.clientWidth - width);
  const maxTop = Math.max(0, dashboard.clientHeight - height);
  const next = {
    left: Math.max(0, Math.min((dashboard.clientWidth - width) / 2, maxLeft)),
    top: Math.max(0, Math.min((dashboard.clientHeight - height) / 2, maxTop)),
  };
  setPosition(el, next.left, next.top);
  return next;
};

export const parseCssSize = (value) => {
  if (!value || value === 'none' || value === 'auto') {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const windowMinSize = (el) => {
  const style = getComputedStyle(el);

  return {
    minWidth: parseCssSize(style.minWidth),
    minHeight: parseCssSize(style.minHeight),
  };
};

export const applyWindowSize = (el, width, height) => {
  const { minWidth, minHeight } = windowMinSize(el);
  const nextWidth = Math.max(minWidth, width);
  const nextHeight = Math.max(minHeight, height);

  el.style.width = toPx(nextWidth);
  el.style.height = toPx(nextHeight);
  el.classList.add('is-sized');

  return { width: nextWidth, height: nextHeight };
};
