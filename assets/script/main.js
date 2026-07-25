/** Button "press action with keyboard" emulation for Firefox */
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

if (isFirefox) {
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'BUTTON' && !activeElement.disabled) {
        activeElement.classList.add('is-pressed');
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'BUTTON') {
        activeElement.classList.remove('is-pressed');
      }
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target && e.target.tagName === 'BUTTON') {
      e.target.classList.remove('is-pressed');
    }
  });
}

/** Free drag for [draggable="true"] items inside .dashboard */
(() => {
  const dashboard = document.querySelector('.dashboard');
  if (!dashboard) {
    return;
  }

  /** Top-level shell windows only (ignore nested 98.css tabpanel .window and #toolbar). */
  const isShellWindow = (el) =>
    el instanceof HTMLElement &&
    el.classList.contains('window') &&
    el.id !== 'toolbar';

  const shellWindows = () => [...dashboard.children].filter(isShellWindow);

  const closestShellWindow = (start) => {
    let node = start;
    while (node && node !== dashboard) {
      if (isShellWindow(node) && node.parentElement === dashboard) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  /** Icons snap to a grid: origin 20px, step 90px (icon size). */
  const ICON_GRID_ORIGIN_PX = 20;
  const ICON_GRID_STEP_PX = 90;
  const POSITIONS_STORAGE_KEY = 'webhemi.demo.desktop.positions.px';

  let zCounter = 10;
  let dragState = null;
  let resizeState = null;
  let didDrag = false;

  /** No top-edge resize: header drag must stay uncontested. */
  const RESIZE_EDGES = ['e', 'w', 's', 'se', 'sw'];

  const toPx = (value) => `${Number(value.toFixed(2))}px`;

  const toPxNumber = (value) => Number(value.toFixed(2));

  const dashboardRect = () => dashboard.getBoundingClientRect();

  const setPosition = (el, left, top) => {
    el.style.left = toPx(left);
    el.style.top = toPx(top);
  };

  const readPosition = (el) => {
    const origin = dashboardRect();
    const rect = el.getBoundingClientRect();

    return {
      left: rect.left - origin.left,
      top: rect.top - origin.top,
    };
  };

  const elementId = (el) => el.id || '';

  const loadPositions = () => {
    try {
      const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};

      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  };

  const savePositions = () => {
    const data = {};

    dashboard.querySelectorAll('[draggable="true"]').forEach((el) => {
      const id = elementId(el);
      if (!id || !el.style.left || !el.style.top) {
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
        data[id].closed = el.classList.contains('is-closed');
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

  const clamp = (el, left, top) => {
    const maxLeft = Math.max(0, dashboard.clientWidth - el.offsetWidth);
    const maxTop = Math.max(0, dashboard.clientHeight - el.offsetHeight);

    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top: Math.max(0, Math.min(top, maxTop)),
    };
  };

  const parseCssSize = (value) => {
    if (!value || value === 'none' || value === 'auto') {
      return 0;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const windowMinSize = (el) => {
    const style = getComputedStyle(el);

    return {
      minWidth: parseCssSize(style.minWidth),
      minHeight: parseCssSize(style.minHeight),
    };
  };

  const applyWindowSize = (el, width, height) => {
    const { minWidth, minHeight } = windowMinSize(el);
    const nextWidth = Math.max(minWidth, width);
    const nextHeight = Math.max(minHeight, height);

    el.style.width = toPx(nextWidth);
    el.style.height = toPx(nextHeight);
    el.classList.add('is-sized');

    return { width: nextWidth, height: nextHeight };
  };

  const mountResizeHandles = (win) => {
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

  const RESIZE_CURSORS = {
    e: 'ew-resize',
    w: 'ew-resize',
    s: 'ns-resize',
    se: 'nwse-resize',
    sw: 'nesw-resize',
  };

  const startResize = (win, edge, event) => {
    const rect = win.getBoundingClientRect();
    const origin = dashboardRect();
    const { minWidth, minHeight } = windowMinSize(win);

    resizeState = {
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

  const moveResize = (event) => {
    if (!resizeState) {
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
    } = resizeState;

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
    didDrag = true;
  };

  const endResize = (event) => {
    if (!resizeState) {
      return;
    }

    const { el, pointerId } = resizeState;

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
    resizeState = null;
    savePositions();
  };

  const clampToIconGrid = (el, left, top) => {
    const origin = ICON_GRID_ORIGIN_PX;
    const step = ICON_GRID_STEP_PX;
    const maxLeft = Math.max(origin, dashboard.clientWidth - el.offsetWidth);
    const maxTop = Math.max(origin, dashboard.clientHeight - el.offsetHeight);
    const maxCol = Math.max(0, Math.floor((maxLeft - origin) / step));
    const maxRow = Math.max(0, Math.floor((maxTop - origin) / step));
    const col = Math.min(maxCol, Math.max(0, Math.round((left - origin) / step)));
    const row = Math.min(maxRow, Math.max(0, Math.round((top - origin) / step)));

    return {
      left: origin + col * step,
      top: origin + row * step,
    };
  };

  const overlaps = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

  const iconBoxes = (exclude) => {
    const origin = dashboardRect();

    return [...dashboard.querySelectorAll('.icon[draggable="true"]')]
      .filter((el) => el !== exclude)
      .map((el) => {
        const r = el.getBoundingClientRect();

        return {
          left: r.left - origin.left,
          top: r.top - origin.top,
          right: r.right - origin.left,
          bottom: r.bottom - origin.top,
        };
      });
  };

  const isFree = (el, left, top, others) => {
    const box = {
      left,
      top,
      right: left + el.offsetWidth,
      bottom: top + el.offsetHeight,
    };

    return !others.some((other) => overlaps(box, other));
  };

  const nearestFreePosition = (el, left, top) => {
    const others = iconBoxes(el);
    const preferred = clampToIconGrid(el, left, top);

    if (isFree(el, preferred.left, preferred.top, others)) {
      return preferred;
    }

    const origin = ICON_GRID_ORIGIN_PX;
    const step = ICON_GRID_STEP_PX;
    const maxLeft = Math.max(origin, dashboard.clientWidth - el.offsetWidth);
    const maxTop = Math.max(origin, dashboard.clientHeight - el.offsetHeight);
    const maxCol = Math.max(0, Math.floor((maxLeft - origin) / step));
    const maxRow = Math.max(0, Math.floor((maxTop - origin) / step));
    const startCol = Math.round((preferred.left - origin) / step);
    const startRow = Math.round((preferred.top - origin) / step);
    const maxRadius = Math.max(maxCol, maxRow) + 1;
    let best = null;
    let bestDist = Infinity;

    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dCol = -radius; dCol <= radius; dCol += 1) {
        for (let dRow = -radius; dRow <= radius; dRow += 1) {
          if (Math.max(Math.abs(dCol), Math.abs(dRow)) !== radius) {
            continue;
          }

          const col = startCol + dCol;
          const row = startRow + dRow;

          if (col < 0 || row < 0 || col > maxCol || row > maxRow) {
            continue;
          }

          const next = {
            left: origin + col * step,
            top: origin + row * step,
          };

          if (!isFree(el, next.left, next.top, others)) {
            continue;
          }

          const dist =
            (next.left - preferred.left) ** 2 + (next.top - preferred.top) ** 2;

          if (dist < bestDist) {
            bestDist = dist;
            best = next;
          }
        }
      }

      if (best) {
        return best;
      }
    }

    return preferred;
  };

  /** 98.css uses .title-bar.inactive; shell keeps .window.active (inverted). */
  const syncTitleBarInactive = () => {
    shellWindows().forEach((win) => {
      const titleBar = win.querySelector(':scope > .title-bar');
      if (!titleBar) {
        return;
      }

      titleBar.classList.toggle('inactive', !win.classList.contains('active'));
    });
  };

  const syncMaximizeButton = (win) => {
    const button = win.querySelector(
      ':scope > .title-bar .title-bar-controls button[aria-label="Maximize"], :scope > .title-bar .title-bar-controls button[aria-label="Restore"]',
    );
    if (!button || button.disabled) {
      return;
    }

    button.setAttribute('aria-label', win.classList.contains('is-maximized') ? 'Restore' : 'Maximize');
  };

  const isWindowVisible = (win) =>
    !win.classList.contains('is-closed') && !win.classList.contains('is-minimized');

  /** Fixed taskbar buttons: visibility + pressed state track shell windows. */
  const syncTaskButtons = () => {
    document.querySelectorAll('#toolbar .task-buttons > .task[data-window]').forEach((btn) => {
      const win = document.getElementById(btn.getAttribute('data-window'));
      if (!win || !isShellWindow(win)) {
        btn.hidden = true;
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        return;
      }

      btn.hidden = win.classList.contains('is-closed');
      const pressed = win.classList.contains('active') && isWindowVisible(win);
      btn.classList.toggle('active', pressed);
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  };

  const bringWindowToFront = (win) => {
    if (!isWindowVisible(win)) {
      return;
    }

    shellWindows().forEach((el) => {
      el.classList.remove('active');
    });
    win.classList.add('active');
    syncTitleBarInactive();
    syncTaskButtons();
    zCounter += 1;
    win.style.zIndex = String(zCounter);
    savePositions();
  };

  const clearWindowActive = () => {
    shellWindows().forEach((el) => {
      el.classList.remove('active');
    });
    syncTitleBarInactive();
    syncTaskButtons();
    savePositions();
  };

  const activateTopVisibleWindow = () => {
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

  const showWindow = (win) => {
    win.classList.remove('is-closed', 'is-minimized');
    bringWindowToFront(win);
  };

  const closeWindow = (win) => {
    win.classList.add('is-closed');
    win.classList.remove('is-minimized', 'active');
    syncTitleBarInactive();
    syncTaskButtons();
    activateTopVisibleWindow();
    savePositions();
  };

  const minimizeWindow = (win) => {
    win.classList.add('is-minimized');
    win.classList.remove('active');
    syncTitleBarInactive();
    syncTaskButtons();
    activateTopVisibleWindow();
    savePositions();
  };

  const maximizeWindow = (win) => {
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

  const restoreWindow = (win) => {
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

  const toggleMaximizeWindow = (win) => {
    if (win.classList.contains('is-maximized')) {
      restoreWindow(win);
    } else {
      maximizeWindow(win);
    }
  };

  const openWindowById = (id) => {
    const win = document.getElementById(id);
    if (!win || !isShellWindow(win) || !dashboard.contains(win)) {
      return;
    }

    showWindow(win);
  };

  const placeAbsolute = () => {
    const origin = dashboardRect();
    const saved = loadPositions();
    const cascadeStep = 30;
    let windowCascade = 0;
    const items = [...dashboard.querySelectorAll('[draggable="true"]')].map((el) => {
      const r = el.getBoundingClientRect();

      return {
        el,
        left: r.left - origin.left,
        top: r.top - origin.top,
      };
    });

    // Cascade windows from the first window's natural top-left.
    const firstWindow = items.find(({ el }) => el.classList.contains('window'));
    const cascadeOrigin = firstWindow
      ? { left: firstWindow.left, top: firstWindow.top }
      : { left: 20, top: 20 };

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
        if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
          const restored = clamp(el, savedPos.left, savedPos.top);
          nextLeft = restored.left;
          nextTop = restored.top;
        } else {
          nextLeft = cascadeOrigin.left + cascadeStep * windowCascade;
          nextTop = cascadeOrigin.top + cascadeStep * windowCascade;
          windowCascade += 1;
        }
      }

      el.style.position = 'absolute';
      setPosition(el, nextLeft, nextTop);
      el.style.margin = '0';

      if (el.classList.contains('window')) {
        const zIndex = Number.parseInt(savedPos?.zIndex, 10);
        if (Number.isFinite(zIndex) && zIndex > 0) {
          el.style.zIndex = String(zIndex);
          zCounter = Math.max(zCounter, zIndex);
        } else {
          el.style.zIndex = String(index + 1);
          zCounter = Math.max(zCounter, index + 1);
        }

        if (el.classList.contains('resizable')) {
          mountResizeHandles(el);

          if (
            savedPos &&
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

        if (savedPos?.minimized) {
          el.classList.add('is-minimized');
        }

        if (savedPos?.maximized && el.classList.contains('resizable')) {
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
      zCounter = Math.max(
        zCounter,
        Number.parseInt(activeWindow.style.zIndex, 10) || zCounter,
      );
      syncTitleBarInactive();
    } else {
      const fallbackActive = shellWindows().find((el) => el.classList.contains('active') && isWindowVisible(el));
      if (fallbackActive) {
        bringWindowToFront(fallbackActive);
      } else {
        syncTitleBarInactive();
      }
    }

    syncTaskButtons();
  };

  const DRAG_THRESHOLD_PX = 4;

  const startDrag = (el, event) => {
    const rect = el.getBoundingClientRect();
    const isIcon = el.classList.contains('icon');

    dragState = {
      el,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      isIcon,
      pointerId: event.pointerId,
      active: !isIcon,
    };
    didDrag = false;

    if (dragState.active) {
      el.classList.add('is-dragging');
      event.preventDefault();

      if (typeof el.setPointerCapture === 'function') {
        el.setPointerCapture(event.pointerId);
      }
    }
  };

  const activateDrag = (event) => {
    if (!dragState || dragState.active) {
      return;
    }

    dragState.active = true;
    dragState.el.classList.add('is-dragging');

    if (typeof dragState.el.setPointerCapture === 'function') {
      dragState.el.setPointerCapture(dragState.pointerId);
    }

    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!dragState) {
      return;
    }

    if (!dragState.active) {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;

      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        return;
      }

      activateDrag(event);
    }

    const origin = dashboardRect();
    const next = clamp(
      dragState.el,
      event.clientX - origin.left - dragState.offsetX,
      event.clientY - origin.top - dragState.offsetY,
    );

    setPosition(dragState.el, next.left, next.top);
    didDrag = true;
  };

  const endDrag = (event) => {
    if (!dragState) {
      return;
    }

    const { el, isIcon, pointerId, active } = dragState;

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
    dragState = null;

    if (active) {
      savePositions();
    }
  };

  const onPointerMove = (event) => {
    if (resizeState) {
      moveResize(event);
      return;
    }

    moveDrag(event);
  };

  const onPointerUp = (event) => {
    if (resizeState) {
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
      if (!didDrag) {
        return;
      }

      const iconLink = event.target.closest('.icon[draggable="true"] a');
      if (iconLink) {
        event.preventDefault();
        event.stopPropagation();
      }

      didDrag = false;
    },
    true,
  );

  dashboard.addEventListener('click', (event) => {
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

      return;
    }

    const taskButton = event.target.closest('#toolbar .task-buttons > .task[data-window]');
    if (taskButton && !taskButton.hidden) {
      const win = document.getElementById(taskButton.getAttribute('data-window'));
      if (!win || !isShellWindow(win) || win.classList.contains('is-closed')) {
        return;
      }

      event.preventDefault();

      // Classic taskbar: active button toggles minimize; otherwise restore/activate.
      if (win.classList.contains('active') && isWindowVisible(win)) {
        minimizeWindow(win);
      } else {
        showWindow(win);
      }
    }
  });

  dashboard.addEventListener('dblclick', (event) => {
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
})();

/** Info panel + statusbar updates for icons inside .panel.icon-list */
(() => {
  const backgroundImageUrl = (el) => {
    const background = getComputedStyle(el).backgroundImage;
    const match = background.match(/url\((['"]?)(.*?)\1\)/);

    return match ? match[2] : '';
  };

  const selectIcon = (link) => {
    const layout = link.closest('.icon-panel-layout');
    const win = link.closest('.window');
    const icon = link.closest('.icon');

    if (!layout || !win || !icon || !link.closest('.panel.icon-list')) {
      return;
    }

    const title = link.querySelector('span')?.textContent?.trim() ?? '';
    const description = link.getAttribute('data-description') ?? '';
    const imageUrl = backgroundImageUrl(icon);

    const info = layout.querySelector(':scope > .panel.info, :scope > .scrollable-viewport > .panel.info');
    if (info) {
      const infoIcon = info.querySelector('img.info-icon');
      const infoTitle = info.querySelector('h1.info-title');
      const infoDescription = info.querySelector('p.info-description');

      if (infoIcon && imageUrl) {
        infoIcon.src = imageUrl;
        infoIcon.alt = title;
      }

      if (infoTitle) {
        infoTitle.textContent = title;
      }

      if (infoDescription) {
        infoDescription.textContent = description;
      }

      info.classList.remove('unselected');
    }

    const statusDescription = win.querySelector(':scope > .status-bar .status-bar-field.description');
    if (statusDescription) {
      statusDescription.textContent = description;
    }
  };

  const unselectIcons = (win) => {
    if (!win) {
      return;
    }

    win.querySelectorAll('.panel.icon-list .icon a:focus').forEach((link) => {
      link.blur();
    });

    win.querySelectorAll('.icon-panel-layout .panel.info').forEach((info) => {
      info.classList.add('unselected');
    });

    win.querySelectorAll(':scope > .status-bar .status-bar-field.description').forEach((description) => {
      description.textContent = '';
    });
  };

  const unselectAllIcons = (exceptWindow = null) => {
    document.querySelectorAll('.dashboard > .window').forEach((win) => {
      if (exceptWindow && win === exceptWindow) {
        return;
      }

      if (win.querySelector('.panel.icon-list')) {
        unselectIcons(win);
      }
    });
  };

  const selectBoxIconLink = (link) => {
    unselectAllIcons(link.closest('.dashboard > .window') || link.closest('.window'));
    selectIcon(link);
  };

  document.addEventListener('focusin', (event) => {
    const boxLink = event.target.closest?.('.panel.icon-list .icon a');
    if (boxLink) {
      selectBoxIconLink(boxLink);
      return;
    }

    // Desktop icon selection clears in-window info panel selection.
    if (event.target.closest?.('.dashboard > .icon-list .icon a')) {
      unselectAllIcons();
    }
  });

  document.addEventListener('click', (event) => {
    const boxLink = event.target.closest?.('.panel.icon-list .icon a');
    if (boxLink) {
      event.preventDefault();
      boxLink.focus();
      selectBoxIconLink(boxLink);
      return;
    }

    if (event.target.closest?.('.dashboard > .icon-list .icon a')) {
      unselectAllIcons();
    }
  });
})();

/** Taskbar clock (24-hour HH:MM). */
(() => {
  const clock = document.querySelector('#toolbar .clock');
  if (!clock) {
    return;
  }

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const tick = () => {
    clock.textContent = formatTime(new Date());
  };

  tick();
  window.setInterval(tick, 1000);
})();
