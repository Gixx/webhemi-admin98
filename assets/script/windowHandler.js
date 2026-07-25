/**
 * Shell window lifecycle: focus, open/close, minimize/maximize, resize.
 */

import {
  dashboard,
  state,
  RESIZE_EDGES,
  RESIZE_CURSORS,
  toPxNumber,
  dashboardRect,
  setPosition,
  readPosition,
  savePositions,
  clamp,
  centerWindow,
  windowMinSize,
  applyWindowSize,
} from './desktop.js';

/** Listeners notified when active/closed/minimized chrome should refresh (e.g. task buttons). */
const chromeListeners = [];

export const onWindowChromeChange = (listener) => {
  chromeListeners.push(listener);
};

const notifyWindowChromeChange = () => {
  chromeListeners.forEach((listener) => listener());
};

/** Top-level shell windows only (ignore nested 98.css tabpanel .window and #toolbar). */
export const isShellWindow = (el) =>
  el instanceof HTMLElement &&
  el.classList.contains('window') &&
  el.id !== 'toolbar';

export const shellWindows = () => [...dashboard.children].filter(isShellWindow);

export const closestShellWindow = (start) => {
  let node = start;
  while (node && node !== dashboard) {
    if (isShellWindow(node) && node.parentElement === dashboard) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

export const isWindowVisible = (win) =>
  !win.classList.contains('is-closed') && !win.classList.contains('is-minimized');

/** 98.css uses .title-bar.inactive; shell keeps .window.active (inverted). */
export const syncTitleBarInactive = () => {
  shellWindows().forEach((win) => {
    const titleBar = win.querySelector(':scope > .title-bar');
    if (!titleBar) {
      return;
    }

    titleBar.classList.toggle('inactive', !win.classList.contains('active'));
  });
};

export const syncMaximizeButton = (win) => {
  const button = win.querySelector(
    ':scope > .title-bar .title-bar-controls button[aria-label="Maximize"], :scope > .title-bar .title-bar-controls button[aria-label="Restore"]',
  );
  if (!button || button.disabled) {
    return;
  }

  button.setAttribute('aria-label', win.classList.contains('is-maximized') ? 'Restore' : 'Maximize');
};

export const bringWindowToFront = (win) => {
  if (!isWindowVisible(win)) {
    return;
  }

  shellWindows().forEach((el) => {
    el.classList.remove('active');
  });
  win.classList.add('active');
  syncTitleBarInactive();
  notifyWindowChromeChange();
  state.zCounter += 1;
  win.style.zIndex = String(state.zCounter);
  savePositions();
};

export const clearWindowActive = () => {
  shellWindows().forEach((el) => {
    el.classList.remove('active');
  });
  syncTitleBarInactive();
  notifyWindowChromeChange();
  savePositions();
};

export const activateTopVisibleWindow = () => {
  const visible = shellWindows().filter(isWindowVisible);
  if (!visible.length) {
    clearWindowActive();
    return;
  }

  visible.sort(
    (a, b) =>
      (Number.parseInt(b.style.zIndex, 10) || 0) - (Number.parseInt(a.style.zIndex, 10) || 0),
  );
  bringWindowToFront(visible[0]);
};

export const showWindow = (win) => {
  const wasClosed = win.classList.contains('is-closed');
  win.classList.remove('is-closed', 'is-minimized');

  if (wasClosed) {
    win.classList.remove('is-maximized', 'is-sized');
    win.style.width = '';
    win.style.height = '';
    delete win.dataset.restoreLeft;
    delete win.dataset.restoreTop;
    delete win.dataset.restoreWidth;
    delete win.dataset.restoreHeight;
    syncMaximizeButton(win);
    // Center now (CSS size fallbacks) and again after layout settles.
    centerWindow(win);
    requestAnimationFrame(() => {
      centerWindow(win);
      savePositions();
    });
  }

  bringWindowToFront(win);
};

export const closeWindow = (win) => {
  win.classList.add('is-closed');
  win.classList.remove('is-minimized', 'active', 'is-maximized', 'is-sized');
  win.style.width = '';
  win.style.height = '';
  delete win.dataset.restoreLeft;
  delete win.dataset.restoreTop;
  delete win.dataset.restoreWidth;
  delete win.dataset.restoreHeight;
  syncMaximizeButton(win);
  syncTitleBarInactive();
  notifyWindowChromeChange();
  activateTopVisibleWindow();
  savePositions();
};

export const minimizeWindow = (win) => {
  win.classList.add('is-minimized');
  win.classList.remove('active');
  syncTitleBarInactive();
  notifyWindowChromeChange();
  activateTopVisibleWindow();
  savePositions();
};

export const maximizeWindow = (win) => {
  if (!win.classList.contains('resizable') || win.classList.contains('is-maximized')) {
    return;
  }

  const pos = readPosition(win);
  win.dataset.restoreLeft = String(toPxNumber(pos.left));
  win.dataset.restoreTop = String(toPxNumber(pos.top));
  win.dataset.restoreWidth = win.style.width ? String(toPxNumber(win.offsetWidth)) : '';
  win.dataset.restoreHeight = win.style.height ? String(toPxNumber(win.offsetHeight)) : '';

  setPosition(win, 0, 0);
  applyWindowSize(win, dashboard.clientWidth, dashboard.clientHeight);
  win.classList.add('is-maximized');
  syncMaximizeButton(win);
  bringWindowToFront(win);
};

export const restoreWindow = (win) => {
  if (!win.classList.contains('is-maximized')) {
    return;
  }

  const left = Number.parseFloat(win.dataset.restoreLeft);
  const top = Number.parseFloat(win.dataset.restoreTop);
  const width = Number.parseFloat(win.dataset.restoreWidth);
  const height = Number.parseFloat(win.dataset.restoreHeight);

  win.classList.remove('is-maximized');

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    applyWindowSize(win, width, height);
  } else {
    win.style.width = '';
    win.style.height = '';
    win.classList.remove('is-sized');
  }

  const next = clamp(
    win,
    Number.isFinite(left) ? left : 0,
    Number.isFinite(top) ? top : 0,
  );
  setPosition(win, next.left, next.top);
  syncMaximizeButton(win);
  bringWindowToFront(win);
};

export const toggleMaximizeWindow = (win) => {
  if (win.classList.contains('is-maximized')) {
    restoreWindow(win);
  } else {
    maximizeWindow(win);
  }
};

/** True when the title-bar Maximize/Restore control exists and is enabled. */
export const canToggleMaximize = (win) => {
  if (!win.classList.contains('resizable')) {
    return false;
  }

  const button = win.querySelector(
    ':scope > .title-bar .title-bar-controls button[aria-label="Maximize"], :scope > .title-bar .title-bar-controls button[aria-label="Restore"]',
  );
  return Boolean(button && !button.disabled);
};

export const openWindowById = (id) => {
  const win = document.getElementById(id);
  if (!win || !isShellWindow(win) || !dashboard.contains(win)) {
    return;
  }

  showWindow(win);
};

export const mountResizeHandles = (win) => {
  if (!win.classList.contains('resizable') || win.querySelector('.window-resize-handle')) {
    return;
  }

  RESIZE_EDGES.forEach((edge) => {
    const handle = document.createElement('div');
    handle.className = 'window-resize-handle';
    handle.dataset.edge = edge;
    handle.setAttribute('aria-hidden', 'true');
    win.appendChild(handle);
  });
};

export const startResize = (win, edge, event) => {
  const rect = win.getBoundingClientRect();
  const origin = dashboardRect();
  const { minWidth, minHeight } = windowMinSize(win);

  state.resizeState = {
    el: win,
    edge,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: rect.left - origin.left,
    startTop: rect.top - origin.top,
    startWidth: rect.width,
    startHeight: rect.height,
    minWidth,
    minHeight,
  };

  win.classList.add('is-resizing');
  document.documentElement.classList.add('is-window-resizing');
  document.documentElement.style.setProperty(
    'cursor',
    RESIZE_CURSORS[edge] || 'default',
    'important',
  );
  event.preventDefault();
  event.stopPropagation();

  if (typeof win.setPointerCapture === 'function') {
    win.setPointerCapture(event.pointerId);
  }
};

export const moveResize = (event) => {
  if (!state.resizeState) {
    return;
  }

  const {
    el,
    edge,
    startX,
    startY,
    startLeft,
    startTop,
    startWidth,
    startHeight,
    minWidth,
    minHeight,
  } = state.resizeState;

  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  let nextLeft = startLeft;
  let nextTop = startTop;
  let nextWidth = startWidth;
  let nextHeight = startHeight;

  if (edge.includes('e')) {
    nextWidth = startWidth + dx;
  }

  if (edge.includes('w')) {
    nextWidth = startWidth - dx;
    nextLeft = startLeft + dx;
  }

  if (edge.includes('s')) {
    nextHeight = startHeight + dy;
  }

  if (nextWidth < minWidth) {
    if (edge.includes('w')) {
      nextLeft = startLeft + (startWidth - minWidth);
    }
    nextWidth = minWidth;
  }

  if (nextHeight < minHeight) {
    nextHeight = minHeight;
  }

  const maxWidth = Math.max(minWidth, dashboard.clientWidth - nextLeft);
  const maxHeight = Math.max(minHeight, dashboard.clientHeight - nextTop);
  nextWidth = Math.min(nextWidth, maxWidth);
  nextHeight = Math.min(nextHeight, maxHeight);

  if (edge.includes('w')) {
    const maxLeft = startLeft + startWidth - minWidth;
    nextLeft = Math.max(0, Math.min(nextLeft, maxLeft));
    nextWidth = startLeft + startWidth - nextLeft;
    nextWidth = Math.min(nextWidth, dashboard.clientWidth - nextLeft);
  }

  applyWindowSize(el, nextWidth, nextHeight);
  setPosition(el, nextLeft, nextTop);
  state.didDrag = true;
};

export const endResize = (event) => {
  if (!state.resizeState) {
    return;
  }

  const { el, pointerId } = state.resizeState;

  if (
    event &&
    typeof el.releasePointerCapture === 'function' &&
    el.hasPointerCapture?.(pointerId)
  ) {
    el.releasePointerCapture(pointerId);
  }

  el.classList.remove('is-resizing');
  document.documentElement.classList.remove('is-window-resizing');
  document.documentElement.style.removeProperty('cursor');
  state.resizeState = null;
  savePositions();
};
