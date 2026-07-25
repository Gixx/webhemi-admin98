/**
 * Desktop shell entry: place items, wire drag/resize, and route UI events.
 */

import '../style/chrome.scss';
import '../style/product.scss';

import {
  dashboard,
  state,
  DRAG_THRESHOLD_PX,
  dashboardRect,
  setPosition,
  readPosition,
  elementId,
  loadPositions,
  savePositions,
  clamp,
  centerWindow,
  toPxNumber,
  applyWindowSize,
} from './desktop.js';
import {
  shellWindows,
  closestShellWindow,
  isWindowVisible,
  syncTitleBarInactive,
  syncMaximizeButton,
  bringWindowToFront,
  clearWindowActive,
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  canToggleMaximize,
  openWindowById,
  mountResizeHandles,
  startResize,
  moveResize,
  endResize,
} from './windowHandler.js';
import { clampToIconGrid, nearestFreePosition, initIconHandler } from './iconHandler.js';
import {
  syncTaskButtons,
  initTaskbarHandler,
  handleTaskbarClick,
} from './taskbarHandler.js';
import { initButtonPress } from './buttonPress.js';

if (!dashboard) {
  throw new Error('Desktop shell requires a .dashboard root.');
}

initButtonPress();
initIconHandler();

const { menuButton, startMenu, closeStartMenu, toggleStartMenu } = initTaskbarHandler();

const placeAbsolute = () => {
  const origin = dashboardRect();
  const saved = loadPositions();
  const items = [...dashboard.querySelectorAll('[draggable="true"]')].map((el) => {
    const r = el.getBoundingClientRect();

    return {
      el,
      left: r.left - origin.left,
      top: r.top - origin.top,
    };
  });

  let activeWindow = null;

  items.forEach(({ el, left, top }, index) => {
    const id = elementId(el);
    const savedPos = id ? saved[id] : null;
    let nextLeft = left;
    let nextTop = top;

    if (el.classList.contains('icon')) {
      if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
        const restored = clampToIconGrid(el, savedPos.left, savedPos.top);
        nextLeft = restored.left;
        nextTop = restored.top;
      } else {
        const snapped = nearestFreePosition(el, left, top);
        nextLeft = snapped.left;
        nextTop = snapped.top;
      }
    } else if (el.classList.contains('window')) {
      el.style.position = 'absolute';
      el.style.margin = '0';

      // Closed entries have no geometry; open windows without a save are centered.
      if (
        !savedPos?.closed &&
        savedPos &&
        Number.isFinite(savedPos.left) &&
        Number.isFinite(savedPos.top)
      ) {
        const restored = clamp(el, savedPos.left, savedPos.top);
        nextLeft = restored.left;
        nextTop = restored.top;
        setPosition(el, nextLeft, nextTop);
      } else {
        const centered = centerWindow(el);
        nextLeft = centered.left;
        nextTop = centered.top;
      }
    }

    if (!el.classList.contains('window')) {
      el.style.position = 'absolute';
      setPosition(el, nextLeft, nextTop);
      el.style.margin = '0';
    }

    if (el.classList.contains('window')) {
      const zIndex = Number.parseInt(savedPos?.zIndex, 10);
      if (Number.isFinite(zIndex) && zIndex > 0 && !savedPos?.closed) {
        el.style.zIndex = String(zIndex);
        state.zCounter = Math.max(state.zCounter, zIndex);
      } else {
        el.style.zIndex = String(index + 1);
        state.zCounter = Math.max(state.zCounter, index + 1);
      }

      if (el.classList.contains('resizable')) {
        mountResizeHandles(el);

        if (
          savedPos &&
          !savedPos.closed &&
          Number.isFinite(savedPos.width) &&
          Number.isFinite(savedPos.height) &&
          !savedPos.maximized
        ) {
          applyWindowSize(el, savedPos.width, savedPos.height);
          const sized = clamp(el, nextLeft, nextTop);
          nextLeft = sized.left;
          nextTop = sized.top;
          setPosition(el, nextLeft, nextTop);
        }
      }

      if (savedPos?.closed) {
        el.classList.add('is-closed');
      }

      if (savedPos?.minimized && !savedPos?.closed) {
        el.classList.add('is-minimized');
      }

      if (savedPos?.maximized && !savedPos?.closed && el.classList.contains('resizable')) {
        el.dataset.restoreLeft = String(
          Number.isFinite(savedPos.left) ? savedPos.left : toPxNumber(nextLeft),
        );
        el.dataset.restoreTop = String(
          Number.isFinite(savedPos.top) ? savedPos.top : toPxNumber(nextTop),
        );
        el.dataset.restoreWidth = Number.isFinite(savedPos.width) ? String(savedPos.width) : '';
        el.dataset.restoreHeight = Number.isFinite(savedPos.height)
          ? String(savedPos.height)
          : '';
        setPosition(el, 0, 0);
        applyWindowSize(el, dashboard.clientWidth, dashboard.clientHeight);
        el.classList.add('is-maximized');
      }

      syncMaximizeButton(el);

      if (
        savedPos &&
        !savedPos.closed &&
        Object.prototype.hasOwnProperty.call(savedPos, 'active') &&
        isWindowVisible(el)
      ) {
        el.classList.toggle('active', Boolean(savedPos.active));
        if (savedPos.active) {
          activeWindow = el;
        }
      } else if (el.classList.contains('active') && isWindowVisible(el)) {
        activeWindow = el;
      } else {
        el.classList.remove('active');
      }
    }
  });

  if (activeWindow) {
    state.zCounter = Math.max(
      state.zCounter,
      Number.parseInt(activeWindow.style.zIndex, 10) || state.zCounter,
    );
    syncTitleBarInactive();
  } else {
    const fallbackActive = shellWindows().find(
      (el) => el.classList.contains('active') && isWindowVisible(el),
    );
    if (fallbackActive) {
      bringWindowToFront(fallbackActive);
    } else {
      syncTitleBarInactive();
    }
  }

  syncTaskButtons();
};

const startDrag = (el, event) => {
  const rect = el.getBoundingClientRect();
  const isIcon = el.classList.contains('icon');

  state.dragState = {
    el,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    startX: event.clientX,
    startY: event.clientY,
    isIcon,
    pointerId: event.pointerId,
    // Defer capture/preventDefault until movement past threshold so
    // title-bar dblclick (maximize) is not suppressed by the browser.
    active: false,
  };
  state.didDrag = false;
};

const activateDrag = (event) => {
  if (!state.dragState || state.dragState.active) {
    return;
  }

  state.dragState.active = true;
  state.dragState.el.classList.add('is-dragging');

  if (typeof state.dragState.el.setPointerCapture === 'function') {
    state.dragState.el.setPointerCapture(state.dragState.pointerId);
  }

  event.preventDefault();
};

const moveDrag = (event) => {
  if (!state.dragState) {
    return;
  }

  if (!state.dragState.active) {
    const dx = event.clientX - state.dragState.startX;
    const dy = event.clientY - state.dragState.startY;

    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      return;
    }

    activateDrag(event);
  }

  const origin = dashboardRect();
  const next = clamp(
    state.dragState.el,
    event.clientX - origin.left - state.dragState.offsetX,
    event.clientY - origin.top - state.dragState.offsetY,
  );

  setPosition(state.dragState.el, next.left, next.top);
  state.didDrag = true;
};

const endDrag = (event) => {
  if (!state.dragState) {
    return;
  }

  const { el, isIcon, pointerId, active } = state.dragState;

  if (
    event &&
    typeof el.releasePointerCapture === 'function' &&
    el.hasPointerCapture?.(pointerId)
  ) {
    el.releasePointerCapture(pointerId);
  }

  if (active && isIcon) {
    const { left, top } = readPosition(el);
    const snapped = nearestFreePosition(el, left, top);
    setPosition(el, snapped.left, snapped.top);
  }

  el.classList.remove('is-dragging');
  state.dragState = null;

  if (active) {
    savePositions();
  }
};

const onPointerMove = (event) => {
  if (state.resizeState) {
    moveResize(event);
    return;
  }

  moveDrag(event);
};

const onPointerUp = (event) => {
  if (state.resizeState) {
    endResize(event);
    return;
  }

  endDrag(event);
};

dashboard.addEventListener('dragstart', (event) => {
  if (event.target.closest('[draggable="true"]')) {
    event.preventDefault();
  }
});

dashboard.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) {
    return;
  }

  // Close Start menu unless the press is on the menu itself or its toggle.
  if (startMenu && !startMenu.hidden) {
    const inStartMenu = event.target.closest('#toolbar .start-menu');
    const onMenuButton = event.target.closest('#toolbar > .window-body > button.menu');
    if (!inStartMenu && !onMenuButton) {
      closeStartMenu();
    }
  }

  const resizeHandle = event.target.closest('.window-resize-handle');
  if (resizeHandle) {
    const win = closestShellWindow(resizeHandle);
    if (win && win.classList.contains('resizable')) {
      bringWindowToFront(win);
      startResize(win, resizeHandle.dataset.edge, event);
    }
    return;
  }

  const win = closestShellWindow(event.target);
  if (win) {
    if (isWindowVisible(win)) {
      bringWindowToFront(win);
    }

    if (!win.matches('[draggable="true"]') || !isWindowVisible(win)) {
      return;
    }

    const header = event.target.closest('.title-bar');
    const interactive = event.target.closest(
      'button, a, input, select, textarea, label, .sb, .sb-thumb, .sb-track',
    );

    if (!header || !win.contains(header) || interactive || win.classList.contains('is-maximized')) {
      return;
    }

    startDrag(win, event);
    return;
  }

  // Taskbar is not a shell window; keep window focus when using it.
  if (event.target.closest('#toolbar')) {
    return;
  }

  clearWindowActive();

  const icon = event.target.closest('.icon[draggable="true"]');
  if (icon && dashboard.contains(icon)) {
    startDrag(icon, event);
  }
});

dashboard.addEventListener('pointermove', onPointerMove);
dashboard.addEventListener('pointerup', onPointerUp);
dashboard.addEventListener('pointercancel', onPointerUp);

dashboard.addEventListener(
  'click',
  (event) => {
    if (!state.didDrag) {
      return;
    }

    const iconLink = event.target.closest('.icon[draggable="true"] a');
    if (iconLink) {
      event.preventDefault();
      event.stopPropagation();
    }

    state.didDrag = false;
  },
  true,
);

dashboard.addEventListener('click', (event) => {
  if (handleTaskbarClick(event, { closeStartMenu, toggleStartMenu })) {
    return;
  }

  const control = event.target.closest('.title-bar-controls button');
  if (control && dashboard.contains(control) && !control.disabled) {
    const win = closestShellWindow(control);
    if (!win) {
      return;
    }

    const action = control.getAttribute('aria-label');
    event.preventDefault();

    if (action === 'Close') {
      closeWindow(win);
    } else if (action === 'Minimize') {
      minimizeWindow(win);
    } else if (action === 'Maximize' || action === 'Restore') {
      toggleMaximizeWindow(win);
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && startMenu && !startMenu.hidden) {
    closeStartMenu();
    menuButton?.focus();
  }
});

dashboard.addEventListener('dblclick', (event) => {
  // Start menu opens on single click; ignore its dblclick open.
  if (event.target.closest('#toolbar .start-menu')) {
    return;
  }

  const titleBar = event.target.closest('.window > .title-bar');
  if (titleBar && !event.target.closest('.title-bar-controls')) {
    const win = closestShellWindow(titleBar);
    if (win && win.contains(titleBar) && canToggleMaximize(win)) {
      event.preventDefault();
      toggleMaximizeWindow(win);
      return;
    }
  }

  const openFrom = event.target.closest('[data-open-window]');
  if (!openFrom || !dashboard.contains(openFrom)) {
    return;
  }

  const windowId = openFrom.getAttribute('data-open-window');
  if (!windowId) {
    return;
  }

  event.preventDefault();
  openWindowById(windowId);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', placeAbsolute);
} else {
  placeAbsolute();
}
