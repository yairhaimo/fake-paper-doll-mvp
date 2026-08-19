export interface LabElements {
  canvasMount: HTMLElement;
  identityButtons: HTMLButtonElement[];
  outfitButtons: HTMLButtonElement[];
  weaponButton: HTMLButtonElement;
  galleryButton: HTMLButtonElement;
  layerDebugButton: HTMLButtonElement;
  anchorDebugButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  previousFrameButton: HTMLButtonElement;
  nextFrameButton: HTMLButtonElement;
  animationButtons: HTMLButtonElement[];
  statusAnimation: HTMLElement;
  statusFrame: HTMLElement;
  statusProgress: HTMLElement;
  statusPosition: HTMLElement;
  statusVelocity: HTMLElement;
  timelineProgress: HTMLElement;
  stepFrame: HTMLElement;
  layerList: HTMLElement;
  combinationCount: HTMLElement;
  debugReadout: HTMLElement;
  touchLeft: HTMLButtonElement;
  touchRight: HTMLButtonElement;
  touchJump: HTMLButtonElement;
  touchAttack: HTMLButtonElement;
  toast: HTMLElement;
}

const icon = (name: "spark" | "grid" | "layers" | "anchor" | "pause") => {
  const paths = {
    spark:
      '<path d="M12 2.8c.7 4 2.1 5.4 6.2 6.2-4 .7-5.4 2.1-6.2 6.2-.7-4-2.1-5.4-6.2-6.2 4-.7 5.4-2.1 6.2-6.2Z"/><path d="M19 15.3c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z"/>',
    grid:
      '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    layers:
      '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
    anchor:
      '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 12h14M5 12c0 5 2.5 8 7 9M19 12c0 5-2.5 8-7 9"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
  } as const;

  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
};

function segmentButton(
  group: string,
  value: string,
  label: string,
  swatch: string,
  active = false,
): string {
  return `<button class="segment-button${active ? " is-active" : ""}" data-group="${group}" data-value="${value}" type="button" aria-pressed="${active}">
    <span class="segment-swatch" style="--swatch:${swatch}"></span>
    <span>${label}</span>
  </button>`;
}

export function createLabLayout(root: HTMLElement): LabElements {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="Softwood Paper Doll Lab home">
          <span class="brand-mark">${icon("spark")}</span>
          <span>
            <strong>Softwood</strong>
            <small>Paper-doll lab</small>
          </span>
        </a>
        <div class="topbar-meta">
          <span class="status-pill"><i></i> deterministic build</span>
          <a href="https://github.com/yairhaimo/fake-paper-doll-mvp" target="_blank" rel="noreferrer">Source</a>
        </div>
      </header>

      <main class="workspace">
        <section class="stage-card" aria-label="Playable character demo">
          <div class="stage-toolbar">
            <div>
              <span class="eyebrow">Forest test room · 01</span>
              <strong>Movement sandbox</strong>
            </div>
            <div class="stage-state">
              <span data-status-animation>idle</span>
              <span>frame <b data-status-frame>1 / 4</b></span>
            </div>
          </div>
          <div class="canvas-wrap" data-canvas-mount>
            <div class="canvas-loading">
              <span class="loading-orbit"></span>
              Preparing authored poses…
            </div>
            <div class="stage-toast" data-toast role="status"></div>
          </div>
          <div class="stage-help">
            <div class="keyboard-help" aria-label="Keyboard controls">
              <span><kbd>A</kbd><kbd>D</kbd> move</span>
              <span><kbd>W</kbd> jump</span>
              <span><kbd>J</kbd> attack</span>
              <span><kbd>Q</kbd> identity</span>
              <span><kbd>E</kbd> outfit</span>
            </div>
            <span class="stage-note">Try swapping while running or attacking</span>
          </div>
          <div class="touch-controls" aria-label="Touch controls">
            <div>
              <button type="button" data-touch-left aria-label="Move left">←</button>
              <button type="button" data-touch-right aria-label="Move right">→</button>
            </div>
            <div>
              <button type="button" data-touch-jump>Jump</button>
              <button class="attack" type="button" data-touch-attack>Attack</button>
            </div>
          </div>
        </section>

        <aside class="inspector" aria-label="Character inspector">
          <section class="panel appearance-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Live loadout</span>
                <h1>Character assembly</h1>
              </div>
              <span class="combination-chip"><b data-combination-count>1</b> / 8</span>
            </div>

            <label class="control-label">Identity <span>Q</span></label>
            <div class="segmented two-up">
              ${segmentButton("identity", "moss", "Moss", "#68c8b2", true)}
              ${segmentButton("identity", "bramble", "Bramble", "#8d6098")}
            </div>

            <label class="control-label">Outfit <span>E</span></label>
            <div class="segmented two-up">
              ${segmentButton("outfit", "trail", "Trail set", "#efc36b", true)}
              ${segmentButton("outfit", "hoodie", "Scout hoodie", "#334e76")}
            </div>

            <label class="control-label">Held item <span>R</span></label>
            <button class="wide-toggle is-active" data-weapon-button type="button" aria-pressed="true">
              <span class="item-icon">⚔</span>
              <span><strong>Practice sword</strong><small>front/back pose tracks</small></span>
              <i></i>
            </button>

            <button class="primary-action" data-gallery-button type="button" aria-pressed="false">
              ${icon("grid")}
              Preview all combinations
            </button>
          </section>

          <section class="panel diagnostics-panel">
            <div class="panel-heading compact">
              <div>
                <span class="eyebrow">Frame contract</span>
                <h2>Animation inspector</h2>
              </div>
              <button class="icon-button" data-pause-button type="button" aria-label="Pause animation" aria-pressed="false">${icon("pause")}</button>
            </div>

            <div class="animation-tabs" aria-label="Force animation">
              ${["idle", "run", "jump", "fall", "land", "attack"]
                .map(
                  (animation, index) =>
                    `<button type="button" data-animation="${animation}" class="${index === 0 ? "is-active" : ""}">${animation}</button>`,
                )
                .join("")}
            </div>

            <div class="timeline">
              <div class="timeline-labels">
                <span>normalized progress</span>
                <b data-status-progress>0.00</b>
              </div>
              <div class="timeline-track"><i data-timeline-progress></i></div>
              <div class="frame-stepper">
                <button type="button" data-previous-frame aria-label="Previous frame">−</button>
                <span>authored frame <b data-step-frame>01</b></span>
                <button type="button" data-next-frame aria-label="Next frame">＋</button>
              </div>
            </div>

            <div class="telemetry-grid">
              <div><span>position</span><b data-status-position>0, 0</b></div>
              <div><span>velocity</span><b data-status-velocity>0, 0</b></div>
            </div>
          </section>

          <section class="panel debug-panel">
            <div class="panel-heading compact">
              <div>
                <span class="eyebrow">Visual diagnostics</span>
                <h2>Debug overlays</h2>
              </div>
            </div>
            <div class="debug-toggles">
              <button type="button" data-layer-debug aria-pressed="false">${icon("layers")}<span><strong>Layer stack</strong><small>tint semantic pieces</small></span><i></i></button>
              <button type="button" data-anchor-debug aria-pressed="false">${icon("anchor")}<span><strong>Anchors</strong><small>sockets + ground root</small></span><i></i></button>
            </div>
            <ol class="layer-list" data-layer-list aria-label="Resolved layer stack"></ol>
            <p class="debug-readout" data-debug-readout>0 missing assets · 0 unresolved anchors</p>
          </section>
        </aside>
      </main>

      <footer class="footer-note">
        <span>One body contract. Authored silhouettes. Atomic appearance swaps.</span>
        <span>PixiJS · TypeScript · fixed 60 Hz</span>
      </footer>
    </div>`;

  const required = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing required UI element: ${selector}`);
    return element;
  };

  return {
    canvasMount: required("[data-canvas-mount]"),
    identityButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-group="identity"]')],
    outfitButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-group="outfit"]')],
    weaponButton: required("[data-weapon-button]"),
    galleryButton: required("[data-gallery-button]"),
    layerDebugButton: required("[data-layer-debug]"),
    anchorDebugButton: required("[data-anchor-debug]"),
    pauseButton: required("[data-pause-button]"),
    previousFrameButton: required("[data-previous-frame]"),
    nextFrameButton: required("[data-next-frame]"),
    animationButtons: [...root.querySelectorAll<HTMLButtonElement>("[data-animation]")],
    statusAnimation: required("[data-status-animation]"),
    statusFrame: required("[data-status-frame]"),
    statusProgress: required("[data-status-progress]"),
    statusPosition: required("[data-status-position]"),
    statusVelocity: required("[data-status-velocity]"),
    timelineProgress: required("[data-timeline-progress]"),
    stepFrame: required("[data-step-frame]"),
    layerList: required("[data-layer-list]"),
    combinationCount: required("[data-combination-count]"),
    debugReadout: required("[data-debug-readout]"),
    touchLeft: required("[data-touch-left]"),
    touchRight: required("[data-touch-right]"),
    touchJump: required("[data-touch-jump]"),
    touchAttack: required("[data-touch-attack]"),
    toast: required("[data-toast]"),
  };
}

export function setPressed(button: HTMLButtonElement, pressed: boolean): void {
  button.classList.toggle("is-active", pressed);
  button.setAttribute("aria-pressed", String(pressed));
}
