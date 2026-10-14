/** Enkel FPS-mätare: räknar bildrutor och skriver ut medelvärdet två gånger i sekunden. */
export class FpsMeter {
  private readonly el: HTMLElement;
  private frames = 0;
  private since = performance.now();

  constructor(el: HTMLElement) {
    this.el = el;
    el.hidden = false;
  }

  frame(now: number): void {
    this.frames++;
    const elapsed = now - this.since;
    if (elapsed < 500) return;
    this.el.textContent = `${Math.round((this.frames * 1000) / elapsed)} fps`;
    this.frames = 0;
    this.since = now;
  }
}
