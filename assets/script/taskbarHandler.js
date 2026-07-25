/**
 * Taskbar: task buttons, Start menu, and tray clock.
 */

import {
  isShellWindow,
  isWindowVisible,
  openWindowById,
  showWindow,
  minimizeWindow,
  onWindowChromeChange,
} from './windowHandler.js';

/** Fixed taskbar buttons: visibility + pressed state track shell windows. */
export const syncTaskButtons = () => {
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

onWindowChromeChange(syncTaskButtons);

export const initTaskbarHandler = () => {
  const menuButton = document.querySelector('#toolbar > .window-body > button.menu');
  const startMenu = document.querySelector('#toolbar > .start-menu');

  const setStartMenuOpen = (open) => {
    if (!startMenu || !menuButton) {
      return;
    }

    startMenu.hidden = !open;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const closeStartMenu = () => setStartMenuOpen(false);

  const toggleStartMenu = () => {
    if (!startMenu) {
      return;
    }

    setStartMenuOpen(startMenu.hidden);
  };

  const clock = document.querySelector('#toolbar .clock');
  if (clock) {
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
  }

  return {
    menuButton,
    startMenu,
    closeStartMenu,
    toggleStartMenu,
  };
};

export const handleTaskbarClick = (event, { closeStartMenu, toggleStartMenu }) => {
  const menuToggle = event.target.closest('#toolbar > .window-body > button.menu');
  if (menuToggle) {
    event.preventDefault();
    toggleStartMenu();
    return true;
  }

  const startItem = event.target.closest('#toolbar .start-menu .start-item');
  if (startItem) {
    event.preventDefault();
    const windowId = startItem.getAttribute('data-open-window');
    closeStartMenu();
    if (windowId) {
      openWindowById(windowId);
    }
    return true;
  }

  const taskButton = event.target.closest('#toolbar .task-buttons > .task[data-window]');
  if (taskButton && !taskButton.hidden) {
    const win = document.getElementById(taskButton.getAttribute('data-window'));
    if (!win || !isShellWindow(win) || win.classList.contains('is-closed')) {
      return true;
    }

    event.preventDefault();

    // Classic taskbar: active button toggles minimize; otherwise restore/activate.
    if (win.classList.contains('active') && isWindowVisible(win)) {
      minimizeWindow(win);
    } else {
      showWindow(win);
    }
    return true;
  }

  return false;
};
