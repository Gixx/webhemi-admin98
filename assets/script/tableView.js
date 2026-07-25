/**
 * Interactive table row selection (98.css docs behavior — CSS-only library
 * ships `.interactive` + `.highlighted`; click toggling is application JS).
 */
export function bindInteractiveTables(root = document) {
  root.querySelectorAll('table.interactive').forEach((table) => {
    if (table.dataset.interactiveBound === 'true') {
      return;
    }
    table.dataset.interactiveBound = 'true';

    table.addEventListener('click', (event) => {
      const highlightedClass = 'highlighted';
      const isRow = (element) =>
        element instanceof HTMLTableRowElement &&
        element.parentElement?.tagName === 'TBODY';

      const newlySelectedRow = event.composedPath().find(isRow);
      if (!newlySelectedRow) {
        return;
      }

      const previouslySelectedRow = Array.from(newlySelectedRow.parentElement.children)
        .filter(isRow)
        .find((element) => element.classList.contains(highlightedClass));

      if (previouslySelectedRow && previouslySelectedRow !== newlySelectedRow) {
        previouslySelectedRow.classList.remove(highlightedClass);
      }

      newlySelectedRow.classList.toggle(highlightedClass);
    });
  });
}

bindInteractiveTables();
