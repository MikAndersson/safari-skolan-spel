/** Helskärm + liggande läge. Orienteringslåset kräver helskärm på Android. */
export async function enterFullscreenLandscape(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch (err) {
    console.info('Helskärm nekades.', err);
    return;
  }
  try {
    await screen.orientation.lock('landscape');
  } catch {
    // Stöds inte på dator och vissa webbläsare; helskärmen räcker då.
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    screen.orientation.unlock();
  } catch {
    // Ingen låsning att släppa.
  }
  if (document.fullscreenElement) await document.exitFullscreen();
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export function onFullscreenChange(listener: (fullscreen: boolean) => void): void {
  document.addEventListener('fullscreenchange', () => listener(isFullscreen()));
}
