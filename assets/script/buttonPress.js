/**
 * Button "press action with keyboard" emulation for Firefox.
 */

const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

export const initButtonPress = () => {
  if (!isFirefox) {
    return;
  }

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
};
