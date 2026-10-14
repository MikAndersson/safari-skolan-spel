/** Anropar `onResize` direkt och sedan när fönstret ändrar storlek eller vrids. */
export function watchViewport(onResize: (width: number, height: number) => void): void {
  const fire = (): void => onResize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', fire);
  screen.orientation?.addEventListener('change', fire);
  fire();
}
