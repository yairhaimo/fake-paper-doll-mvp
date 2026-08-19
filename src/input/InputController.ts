export type Action = "left" | "right" | "jump" | "attack";

const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  KeyJ: "attack",
  KeyK: "attack",
};

export class InputController {
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private readonly released = new Set<Action>();
  private readonly disposers: Array<() => void> = [];

  constructor(target: Window = window) {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault();
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault();
      this.held.delete(action);
      this.released.add(action);
    };
    const onBlur = () => this.reset();

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onBlur);
    this.disposers.push(
      () => target.removeEventListener("keydown", onKeyDown),
      () => target.removeEventListener("keyup", onKeyUp),
      () => target.removeEventListener("blur", onBlur),
    );
  }

  bindHold(button: HTMLElement, action: Action): void {
    const press = (event: Event) => {
      event.preventDefault();
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
      button.classList.add("is-pressed");
    };
    const release = (event: Event) => {
      event.preventDefault();
      if (this.held.delete(action)) this.released.add(action);
      button.classList.remove("is-pressed");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    this.disposers.push(
      () => button.removeEventListener("pointerdown", press),
      () => button.removeEventListener("pointerup", release),
      () => button.removeEventListener("pointercancel", release),
      () => button.removeEventListener("pointerleave", release),
    );
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  consumeFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
  }

  destroy(): void {
    this.reset();
    this.disposers.forEach((dispose) => dispose());
    this.disposers.length = 0;
  }
}
