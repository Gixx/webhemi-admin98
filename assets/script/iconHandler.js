/**
 * Desktop icon grid placement and in-window icon-list / info panel selection.
 */

import {
  dashboard,
  ICON_GRID_ORIGIN_PX,
  ICON_GRID_STEP_PX,
  dashboardRect,
} from './desktop.js';

export const clampToIconGrid = (el, left, top) => {
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

export const nearestFreePosition = (el, left, top) => {
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

/** Info panel + statusbar updates for icons inside .panel.icon-list */
export const initIconHandler = () => {
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
};
