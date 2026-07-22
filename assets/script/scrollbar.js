/**
 * Win98-style scrollbar emulation for .scrollable elements.
 *
 * Structure after attach:
 *   .scrollable
 *     .scrollable-viewport  (overflow:auto, native bar hidden)
 *       …original children…
 *     .sb.sb-y / .sb.sb-x / .sb.sb-corner  (outside the scrolling box)
 */
(() => {
  const THUMB_MIN = 17;
  const ARROW_STEP = 24;
  const REPEAT_DELAY_MS = 400;
  const REPEAT_EVERY_MS = 50;

  const instances = new WeakMap();

  const el = (tag, className) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    return node;
  };

  const buildAxis = (axis) => {
    const root = el('div', `sb sb-${axis}`);
    root.setAttribute('aria-hidden', 'true');

    const dec = el('button', 'sb-btn sb-dec');
    dec.type = 'button';
    dec.tabIndex = -1;

    const track = el('div', 'sb-track');
    const thumb = el('div', 'sb-thumb');
    track.appendChild(thumb);

    const inc = el('button', 'sb-btn sb-inc');
    inc.type = 'button';
    inc.tabIndex = -1;

    root.append(dec, track, inc);
    return { root, dec, track, thumb, inc };
  };

  const attach = (host) => {
    if (instances.has(host) || !(host instanceof HTMLElement)) {
      return;
    }

    if (host.classList.contains('has-custom-scrollbar')) {
      return;
    }

    const viewport = el('div', 'scrollable-viewport');

    // Move existing content into the viewport (before any chrome exists).
    while (host.firstChild) {
      viewport.appendChild(host.firstChild);
    }

    host.classList.add('has-custom-scrollbar');
    host.appendChild(viewport);

    const y = buildAxis('y');
    const x = buildAxis('x');
    const corner = el('div', 'sb sb-corner');
    corner.setAttribute('aria-hidden', 'true');
    y.root.hidden = true;
    x.root.hidden = true;
    corner.hidden = true;
    host.append(y.root, x.root, corner);

    const state = {
      host,
      viewport,
      y,
      x,
      corner,
      drag: null,
      repeatTimer: 0,
      repeatDelay: 0,
      raf: 0,
    };

    const needsY = () => viewport.scrollHeight > viewport.clientHeight + 1;
    const needsX = () => viewport.scrollWidth > viewport.clientWidth + 1;

    const update = () => {
      const canScrollY = needsY();
      const canScrollX = needsX();

      // Only paint a rail for axes that actually overflow.
      host.classList.toggle('sb-show-y', canScrollY);
      host.classList.toggle('sb-show-x', canScrollX);

      y.root.hidden = !canScrollY;
      x.root.hidden = !canScrollX;
      corner.hidden = !(canScrollY && canScrollX);

      if (canScrollY) {
        const view = viewport.clientHeight;
        const size = viewport.scrollHeight;
        const trackSize = y.track.clientHeight;
        const thumbSize = Math.max(THUMB_MIN, Math.round((view / Math.max(size, 1)) * trackSize));
        const maxScroll = Math.max(0, size - view);
        const maxThumb = Math.max(0, trackSize - thumbSize);
        const top = maxScroll === 0 ? 0 : (viewport.scrollTop / maxScroll) * maxThumb;

        y.thumb.hidden = false;
        y.thumb.style.height = `${thumbSize}px`;
        y.thumb.style.transform = `translateY(${top}px)`;
        y.dec.disabled = viewport.scrollTop <= 0;
        y.inc.disabled = viewport.scrollTop >= maxScroll - 1;
      }

      if (canScrollX) {
        const view = viewport.clientWidth;
        const size = viewport.scrollWidth;
        const trackSize = x.track.clientWidth;
        const thumbSize = Math.max(THUMB_MIN, Math.round((view / Math.max(size, 1)) * trackSize));
        const maxScroll = Math.max(0, size - view);
        const maxThumb = Math.max(0, trackSize - thumbSize);
        const left = maxScroll === 0 ? 0 : (viewport.scrollLeft / maxScroll) * maxThumb;

        x.thumb.hidden = false;
        x.thumb.style.width = `${thumbSize}px`;
        x.thumb.style.transform = `translateX(${left}px)`;
        x.dec.disabled = viewport.scrollLeft <= 0;
        x.inc.disabled = viewport.scrollLeft >= maxScroll - 1;
      }
    };

    const scheduleUpdate = () => {
      if (state.raf) {
        return;
      }

      state.raf = requestAnimationFrame(() => {
        state.raf = 0;
        update();
      });
    };

    const scrollByAxis = (axis, delta) => {
      if (axis === 'y') {
        viewport.scrollTop += delta;
      } else {
        viewport.scrollLeft += delta;
      }
      update();
    };

    const stopRepeat = () => {
      window.clearTimeout(state.repeatDelay);
      window.clearInterval(state.repeatTimer);
      state.repeatDelay = 0;
      state.repeatTimer = 0;
    };

    const startRepeat = (axis, delta) => {
      stopRepeat();
      scrollByAxis(axis, delta);
      state.repeatDelay = window.setTimeout(() => {
        state.repeatTimer = window.setInterval(() => scrollByAxis(axis, delta), REPEAT_EVERY_MS);
      }, REPEAT_DELAY_MS);
    };

    const onArrowDown = (button, axis, delta, event) => {
      if (event.button !== 0 || button.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startRepeat(axis, delta);
    };

    y.dec.addEventListener('pointerdown', (e) => onArrowDown(y.dec, 'y', -ARROW_STEP, e));
    y.inc.addEventListener('pointerdown', (e) => onArrowDown(y.inc, 'y', ARROW_STEP, e));
    x.dec.addEventListener('pointerdown', (e) => onArrowDown(x.dec, 'x', -ARROW_STEP, e));
    x.inc.addEventListener('pointerdown', (e) => onArrowDown(x.inc, 'x', ARROW_STEP, e));

    const onTrackPointerDown = (axis, thumb, event) => {
      if (event.button !== 0 || event.target === thumb || thumb.hidden) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const thumbRect = thumb.getBoundingClientRect();

      if (axis === 'y') {
        const page = viewport.clientHeight;
        if (event.clientY < thumbRect.top) {
          startRepeat('y', -page);
        } else if (event.clientY > thumbRect.bottom) {
          startRepeat('y', page);
        }
      } else {
        const page = viewport.clientWidth;
        if (event.clientX < thumbRect.left) {
          startRepeat('x', -page);
        } else if (event.clientX > thumbRect.right) {
          startRepeat('x', page);
        }
      }
    };

    y.track.addEventListener('pointerdown', (e) => onTrackPointerDown('y', y.thumb, e));
    x.track.addEventListener('pointerdown', (e) => onTrackPointerDown('x', x.thumb, e));

    const onThumbDown = (axis, event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      stopRepeat();

      state.drag = {
        axis,
        startPos: axis === 'y' ? event.clientY : event.clientX,
        startScroll: axis === 'y' ? viewport.scrollTop : viewport.scrollLeft,
      };

      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    y.thumb.addEventListener('pointerdown', (e) => onThumbDown('y', e));
    x.thumb.addEventListener('pointerdown', (e) => onThumbDown('x', e));

    const onPointerMove = (event) => {
      if (!state.drag) {
        return;
      }

      const { axis, startPos, startScroll } = state.drag;
      if (axis === 'y') {
        const trackSize = y.track.clientHeight;
        const thumbSize = y.thumb.offsetHeight;
        const maxThumb = Math.max(1, trackSize - thumbSize);
        const maxScroll = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
        const delta = event.clientY - startPos;
        viewport.scrollTop = startScroll + (delta / maxThumb) * maxScroll;
      } else {
        const trackSize = x.track.clientWidth;
        const thumbSize = x.thumb.offsetWidth;
        const maxThumb = Math.max(1, trackSize - thumbSize);
        const maxScroll = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
        const delta = event.clientX - startPos;
        viewport.scrollLeft = startScroll + (delta / maxThumb) * maxScroll;
      }
      update();
    };

    const onPointerUp = () => {
      state.drag = null;
      stopRepeat();
    };

    // Stop window-drag / desktop handlers from eating scrollbar gestures.
    const stopDeskBubbling = (event) => {
      event.stopPropagation();
    };
    [y.root, x.root, corner].forEach((node) => {
      node.addEventListener('pointerdown', stopDeskBubbling);
      node.addEventListener('mousedown', stopDeskBubbling);
    });

    viewport.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(host);
    resizeObserver.observe(viewport);

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.type === 'childList' &&
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node.nodeType === 1 &&
              (node.classList?.contains('sb') || node.classList?.contains('scrollable-viewport')),
          )
        ) {
          continue;
        }
        scheduleUpdate();
        break;
      }
    });
    mutationObserver.observe(viewport, { childList: true, subtree: true, characterData: true });

    state.destroy = () => {
      stopRepeat();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);

      while (viewport.firstChild) {
        host.insertBefore(viewport.firstChild, viewport);
      }
      viewport.remove();
      y.root.remove();
      x.root.remove();
      corner.remove();
      host.classList.remove('has-custom-scrollbar', 'sb-show-y', 'sb-show-x');
      instances.delete(host);
    };

    instances.set(host, state);
    // Layout once after chrome is in the DOM.
    requestAnimationFrame(() => {
      update();
      requestAnimationFrame(update);
    });
  };

  const scan = (root = document) => {
    root.querySelectorAll?.('.scrollable').forEach(attach);
    if (root instanceof HTMLElement && root.classList?.contains('scrollable')) {
      attach(root);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan());
  } else {
    scan();
  }

  const docObserver = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && !node.classList?.contains('sb') && !node.classList?.contains('scrollable-viewport')) {
          scan(node);
        }
      });
    }
  });
  docObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
