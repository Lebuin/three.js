export function typedEntries<T extends object>(obj: T) {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

const buttonNames = ['left', 'right', 'middle', 'back', 'forward'] as const;
type ButtonName = (typeof buttonNames)[number];

/**
 * Check if a mouse button is pressed.
 *
 * Based on https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons.
 */
export function mouseButtonPressed(event: MouseEvent, buttonName: ButtonName) {
  return Boolean(event.buttons & (1 << buttonNames.indexOf(buttonName)));
}

export function popFromSet<T>(set: Set<T>): T {
  const value = set.values().next().value;
  if (value == null) {
    throw new Error('Set is empty');
  }
  set.delete(value);
  return value;
}

export function setElemStyle(
  elem: HTMLElement,
  style: Partial<CSSStyleDeclaration>,
) {
  Object.assign(elem.style, style);
}
