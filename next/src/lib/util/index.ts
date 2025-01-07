export function platform(min: number, value: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

const buttonNames = ['lefft', 'right', 'middle', 'back', 'forward'] as const;
type ButtonName = (typeof buttonNames)[number];

/**
 * Check if a mouse button is pressed.
 *
 * Based on https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons.
 */
export function mouseButtonPressed(event: MouseEvent, buttonName: ButtonName) {
  return Boolean(event.buttons & (1 << buttonNames.indexOf(buttonName)));
}
