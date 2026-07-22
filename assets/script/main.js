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

  /** Icons snap to a grid: origin 2rem, step 9rem (icon size). */
  const ICON_GRID_ORIGIN_REM = 2;
  const ICON_GRID_STEP_REM = 9;
  const POSITIONS_STORAGE_KEY = 'webhemi.demo.desktop.positions';

  let zCounter = 10;
  let dragState = null;
  let resizeState = null;
  let didDrag = false;

  /** No top-edge resize: header drag must stay uncontested. */
  const RESIZE_EDGES = ['e', 'w', 's', 'se', 'sw'];

  const remToPx = (value) =>
    value * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

  const pxToRem = (value) =>
    `${Number((value / Number.parseFloat(getComputedStyle(document.documentElement).fontSize)).toFixed(4))}rem`;

  const pxToRemNumber = (value) =>
    Number((value / Number.parseFloat(getComputedStyle(document.documentElement).fontSize)).toFixed(4));

  const dashboardRect = () => dashboard.getBoundingClientRect();

  const setPosition = (el, left, top) => {
    el.style.left = pxToRem(left);
    el.style.top = pxToRem(top);
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
        left: pxToRemNumber(pos.left),
        top: pxToRemNumber(pos.top),
      };

      if (el.classList.contains('window')) {
        data[id].zIndex = Number.parseInt(el.style.zIndex, 10) || 1;
        data[id].active = el.classList.contains('active');

        if (el.style.width) {
          data[id].width = pxToRemNumber(el.offsetWidth);
        }

        if (el.style.height) {
          data[id].height = pxToRemNumber(el.offsetHeight);
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

    el.style.width = pxToRem(nextWidth);
    el.style.height = pxToRem(nextHeight);
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
    const origin = remToPx(ICON_GRID_ORIGIN_REM);
    const step = remToPx(ICON_GRID_STEP_REM);
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

    const origin = remToPx(ICON_GRID_ORIGIN_REM);
    const step = remToPx(ICON_GRID_STEP_REM);
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
    dashboard.querySelectorAll('.window').forEach((win) => {
      const titleBar = win.querySelector(':scope > .title-bar');
      if (!titleBar) {
        return;
      }

      titleBar.classList.toggle('inactive', !win.classList.contains('active'));
    });
  };

  const bringWindowToFront = (win) => {
    dashboard.querySelectorAll('.window.active').forEach((el) => {
      el.classList.remove('active');
    });
    win.classList.add('active');
    syncTitleBarInactive();
    zCounter += 1;
    win.style.zIndex = String(zCounter);
    savePositions();
  };

  const clearWindowActive = () => {
    dashboard.querySelectorAll('.window.active').forEach((el) => {
      el.classList.remove('active');
    });
    syncTitleBarInactive();
    savePositions();
  };

  const placeAbsolute = () => {
    const origin = dashboardRect();
    const saved = loadPositions();
    const cascadeStep = remToPx(3);
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
      : { left: remToPx(2), top: remToPx(2) };

    let activeWindow = null;

    items.forEach(({ el, left, top }, index) => {
      const id = elementId(el);
      const savedPos = id ? saved[id] : null;
      let nextLeft = left;
      let nextTop = top;

      if (el.classList.contains('icon')) {
        if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
          const restored = clampToIconGrid(el, remToPx(savedPos.left), remToPx(savedPos.top));
          nextLeft = restored.left;
          nextTop = restored.top;
        } else {
          const snapped = nearestFreePosition(el, left, top);
          nextLeft = snapped.left;
          nextTop = snapped.top;
        }
      } else if (el.classList.contains('window')) {
        if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
          const restored = clamp(el, remToPx(savedPos.left), remToPx(savedPos.top));
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
            Number.isFinite(savedPos.height)
          ) {
            applyWindowSize(el, remToPx(savedPos.width), remToPx(savedPos.height));
            const sized = clamp(el, nextLeft, nextTop);
            nextLeft = sized.left;
            nextTop = sized.top;
            setPosition(el, nextLeft, nextTop);
          }
        }

        if (savedPos && Object.prototype.hasOwnProperty.call(savedPos, 'active')) {
          el.classList.toggle('active', Boolean(savedPos.active));
          if (savedPos.active) {
            activeWindow = el;
          }
        } else if (el.classList.contains('active')) {
          activeWindow = el;
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
      const fallbackActive = dashboard.querySelector('.window.active');
      if (fallbackActive) {
        bringWindowToFront(fallbackActive);
      } else {
        syncTitleBarInactive();
      }
    }
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
      const win = resizeHandle.closest('.window.resizable');
      if (win && dashboard.contains(win)) {
        bringWindowToFront(win);
        startResize(win, resizeHandle.dataset.edge, event);
      }
      return;
    }

    const win = event.target.closest('.window');
    if (win && dashboard.contains(win)) {
      bringWindowToFront(win);

      if (!win.matches('[draggable="true"]')) {
        return;
      }

      const header = event.target.closest('.title-bar');
      const interactive = event.target.closest('button, a, input, select, textarea, label');

      if (!header || !win.contains(header) || interactive) {
        return;
      }

      startDrag(win, event);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', placeAbsolute);
  } else {
    placeAbsolute();
  }
})();

/** Feature panel + statusbar updates for icons inside .box-icon-list */
(() => {
  const backgroundImageUrl = (el) => {
    const background = getComputedStyle(el).backgroundImage;
    const match = background.match(/url\((['"]?)(.*?)\1\)/);

    return match ? match[2] : '';
  };

  const selectIcon = (link) => {
    const win = link.closest('.window');
    const icon = link.closest('.icon');

    if (!win || !icon || !link.closest('.box-icon-list')) {
      return;
    }

    const title = link.querySelector('span')?.textContent?.trim() ?? '';
    const description = link.getAttribute('data-description') ?? '';
    const imageUrl = backgroundImageUrl(icon);

    const feature = win.querySelector('.feature');
    if (feature) {
      const featureIcon = feature.querySelector('img.feature-icon');
      const featureTitle = feature.querySelector('h1.feature-title');
      const featureDescription = feature.querySelector('p.feature-description');

      if (featureIcon && imageUrl) {
        featureIcon.src = imageUrl;
        featureIcon.alt = title;
      }

      if (featureTitle) {
        featureTitle.textContent = title;
      }

      if (featureDescription) {
        featureDescription.textContent = description;
      }

      feature.classList.remove('unselected');
    }

    const statusDescription = win.querySelector('.status-bar .status-bar-field.description');
    if (statusDescription) {
      statusDescription.textContent = description;
    }
  };

  const unselectIcons = (win) => {
    if (!win) {
      return;
    }

    win.querySelectorAll('.box-icon-list .icon a:focus').forEach((link) => {
      link.blur();
    });

    win.querySelectorAll('.feature').forEach((feature) => {
      feature.classList.add('unselected');
    });

    win.querySelectorAll('.status-bar .status-bar-field.description').forEach((description) => {
      description.textContent = '';
    });
  };

  const unselectAllIcons = (exceptWindow = null) => {
    document.querySelectorAll('.window').forEach((win) => {
      if (exceptWindow && win === exceptWindow) {
        return;
      }

      if (win.querySelector('.box-icon-list')) {
        unselectIcons(win);
      }
    });
  };

  const isBoxIconLink = (target) =>
    Boolean(target?.closest?.('.box-icon-list .icon a'));

  document.addEventListener('focusin', (event) => {
    const link = event.target.closest?.('.box-icon-list .icon a');
    if (link) {
      unselectAllIcons(link.closest('.window'));
      selectIcon(link);
      return;
    }

    unselectAllIcons();
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || isBoxIconLink(event.target)) {
      return;
    }

    unselectAllIcons();
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.box-icon-list .icon a');
    if (link) {
      event.preventDefault();
      link.focus();
      unselectAllIcons(link.closest('.window'));
      selectIcon(link);
    }
  });
})();
