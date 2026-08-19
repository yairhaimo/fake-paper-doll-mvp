import { Application, Container } from "pixi.js";
import { AnimationPlayer, type AnimationPlayerSnapshot } from "../character/animationPlayer";
import { AppearanceStore, type AppearancePatch } from "../character/appearanceStore";
import { AUTHORED_PRESENTATION_PIECES } from "../character/authoredPoseBundles";
import { CANONICAL_BODY, getAnimation } from "../character/canonicalBody";
import { CompositionResolver } from "../character/compositionResolver";
import { DEFAULT_CHARACTER_CATALOG } from "../character/registries";
import {
  createSimulationState,
  deriveLocomotionAnimation,
  stepSimulation,
  type SimulationConfig,
  type SimulationState,
} from "../character/simulation";
import {
  ANIMATION_IDS,
  type AnimationId,
  type AppearanceSelection,
  type CompositionResult,
  type Facing,
} from "../character/types";
import { InputController } from "../input/InputController";
import { CombinationGallery } from "../render/CombinationGallery";
import {
  VectorCharacterView,
  type CharacterRenderDiagnostics,
} from "../render/VectorCharacterView";
import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH, WorldBackdrop } from "../render/WorldBackdrop";
import { FrameMetrics, type FrameMetricSnapshot } from "../testing/FrameMetrics";
import { setPressed, type LabElements } from "../ui/layout";

const TICK_MS = 1_000 / CANONICAL_BODY.tickRate;
const MAX_ACCUMULATED_MS = TICK_MS * 5;

const SIMULATION_CONFIG: SimulationConfig = Object.freeze({
  groundY: GROUND_Y,
  horizontalSpeed: 3.6,
  horizontalAcceleration: 0.72,
  jumpImpulse: -10.5,
  gravity: 0.62,
  maxFallSpeed: 11.5,
});

const IDENTITY_IDS = ["moss", "bramble"] as const;
const OUTFIT_IDS = ["trail", "hoodie"] as const;
const VALID_ANIMATIONS = new Set<string>(ANIMATION_IDS);

interface PreservationSnapshot {
  readonly simulation: SimulationState;
  readonly animation: AnimationPlayerSnapshot;
}

export interface GameLabSnapshot {
  readonly ready: boolean;
  readonly simulation: SimulationState;
  readonly animation: AnimationPlayerSnapshot;
  readonly appearance: AppearanceSelection & { readonly revision: number };
  readonly composition: {
    readonly signature: string;
    readonly frameId: string;
    readonly drawCount: number;
    readonly hiddenLayers: readonly string[];
    readonly replacedLayers: readonly string[];
  };
  readonly debug: {
    readonly paused: boolean;
    readonly gallery: boolean;
    readonly layers: boolean;
    readonly anchors: boolean;
  };
}

export interface SwapInvariantResult {
  readonly preserved: boolean;
  readonly before: PreservationSnapshot;
  readonly after: PreservationSnapshot;
  readonly appearance: AppearanceSelection & { readonly revision: number };
}

export interface PaperDollHarness {
  readonly ready: boolean;
  getSnapshot(): GameLabSnapshot;
  getMetrics(): FrameMetricSnapshot;
  resetMetrics(): void;
  stepTicks(count: number): GameLabSnapshot;
  setPaused(paused: boolean): GameLabSnapshot;
  setAnimation(animationId: AnimationId, tick?: number): GameLabSnapshot;
  setFacing(facing: Facing): GameLabSnapshot;
  setGallery(visible: boolean): GameLabSnapshot;
  setLayerDebug(visible: boolean): GameLabSnapshot;
  setAnchorDebug(visible: boolean): GameLabSnapshot;
  setAppearance(patch: AppearancePatch): SwapInvariantResult;
  runSwapInvariant(kind: "identity" | "outfit" | "weapon"): SwapInvariantResult;
}

declare global {
  interface Window {
    __PAPER_DOLL__?: PaperDollHarness;
  }
}

function immutableSimulationWithBounds(state: SimulationState): SimulationState {
  const x = Math.max(162, Math.min(WORLD_WIDTH - 138, state.position.x));
  if (x === state.position.x) return state;
  return Object.freeze({
    ...state,
    position: Object.freeze({ x, y: state.position.y }),
    velocity: Object.freeze({ x: 0, y: state.velocity.y }),
  });
}

function preservationSnapshot(
  simulation: SimulationState,
  animation: AnimationPlayer,
): PreservationSnapshot {
  return Object.freeze({ simulation, animation: animation.snapshot() });
}

function preservationKey(snapshot: PreservationSnapshot): string {
  return JSON.stringify(snapshot);
}

function humanAnimation(value: AnimationId): string {
  return value === "attack" ? "attack" : value;
}

export class GameLab {
  private readonly app = new Application();
  private readonly viewport = new Container();
  private readonly backdrop = new WorldBackdrop();
  private readonly playerView = new VectorCharacterView();
  private readonly gallery = new CombinationGallery();
  private readonly animation = new AnimationPlayer("idle");
  private readonly appearance = new AppearanceStore(undefined, DEFAULT_CHARACTER_CATALOG);
  private readonly resolver = new CompositionResolver(DEFAULT_CHARACTER_CATALOG);
  private readonly input = new InputController();
  private readonly metrics = new FrameMetrics(90);
  private readonly disposers: Array<() => void> = [];

  private simulation = createSimulationState({ position: { x: 470, y: GROUND_Y } });
  private composition: CompositionResult = this.resolver.resolvePlayer(
    this.appearance.selection,
    this.animation.snapshot(),
  );
  private accumulatorMs = 0;
  private attackLocked = false;
  private landingLocked = false;
  private manualPreview = false;
  private paused = false;
  private galleryVisible = false;
  private layerDebug = false;
  private anchorDebug = false;
  private lastUiKey = "";
  private lastCompositionKey = "";
  private lastBackdropTick = -1;
  private lastTelemetryTick = -1;
  private lastDiagnosticKey = "";
  private toastTimer: number | undefined;

  private constructor(private readonly ui: LabElements) {}

  static async create(ui: LabElements): Promise<GameLab> {
    const lab = new GameLab(ui);
    await lab.initialize();
    return lab;
  }

  private async initialize(): Promise<void> {
    await this.app.init({
      resizeTo: this.ui.canvasMount,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      powerPreference: "high-performance",
    });
    await this.playerView.preload([
      ...DEFAULT_CHARACTER_CATALOG.assets.values(),
      ...AUTHORED_PRESENTATION_PIECES,
    ]);
    this.app.canvas.setAttribute("aria-label", "Playable fuzzy monster paper-doll demo");
    this.app.canvas.setAttribute("role", "img");
    this.ui.canvasMount.appendChild(this.app.canvas);
    this.ui.canvasMount.querySelector(".canvas-loading")?.remove();

    this.viewport.addChild(this.backdrop.container, this.playerView.container, this.gallery.container);
    this.app.stage.addChild(this.viewport);
    this.resizeViewport();
    const onResize = () => this.resizeViewport();
    window.addEventListener("resize", onResize);
    this.disposers.push(() => window.removeEventListener("resize", onResize));

    this.bindControls();
    this.applyQueryState();
    this.render();

    this.app.ticker.maxFPS = 60;
    this.app.ticker.add((ticker) => this.loop(ticker.deltaMS));
    this.installHarness();
  }

  private resizeViewport(): void {
    const width = this.app.renderer.width / this.app.renderer.resolution;
    const height = this.app.renderer.height / this.app.renderer.resolution;
    const scale = height / WORLD_HEIGHT;
    this.viewport.scale.set(scale);
    this.viewport.position.set((width - WORLD_WIDTH * scale) / 2, 0);
  }

  private bindControls(): void {
    this.input.bindHold(this.ui.touchLeft, "left");
    this.input.bindHold(this.ui.touchRight, "right");
    this.input.bindHold(this.ui.touchJump, "jump");
    this.input.bindHold(this.ui.touchAttack, "attack");

    this.ui.identityButtons.forEach((button) => {
      const handler = () => {
        const identityId = button.dataset.value;
        if (identityId) this.swapAppearance({ identityId });
      };
      button.addEventListener("click", handler);
      this.disposers.push(() => button.removeEventListener("click", handler));
    });
    this.ui.outfitButtons.forEach((button) => {
      const handler = () => {
        const outfitId = button.dataset.value;
        if (outfitId) this.swapAppearance({ outfitId });
      };
      button.addEventListener("click", handler);
      this.disposers.push(() => button.removeEventListener("click", handler));
    });

    const weaponHandler = () =>
      this.swapAppearance({
        weaponId: this.appearance.snapshot.weaponId === null ? "wooden-sword" : null,
      });
    this.ui.weaponButton.addEventListener("click", weaponHandler);
    this.disposers.push(() => this.ui.weaponButton.removeEventListener("click", weaponHandler));

    const galleryHandler = () => this.setGallery(!this.galleryVisible);
    this.ui.galleryButton.addEventListener("click", galleryHandler);
    this.disposers.push(() => this.ui.galleryButton.removeEventListener("click", galleryHandler));

    const layerHandler = () => this.setLayerDebug(!this.layerDebug);
    this.ui.layerDebugButton.addEventListener("click", layerHandler);
    this.disposers.push(() => this.ui.layerDebugButton.removeEventListener("click", layerHandler));

    const anchorHandler = () => this.setAnchorDebug(!this.anchorDebug);
    this.ui.anchorDebugButton.addEventListener("click", anchorHandler);
    this.disposers.push(() => this.ui.anchorDebugButton.removeEventListener("click", anchorHandler));

    const pauseHandler = () => this.setPaused(!this.paused);
    this.ui.pauseButton.addEventListener("click", pauseHandler);
    this.disposers.push(() => this.ui.pauseButton.removeEventListener("click", pauseHandler));

    const previousHandler = () => {
      this.paused = true;
      this.manualPreview = true;
      this.animation.stepFrame(-1);
      this.updateToggleUi();
      this.render();
    };
    const nextHandler = () => {
      this.paused = true;
      this.manualPreview = true;
      this.animation.stepFrame(1);
      this.updateToggleUi();
      this.render();
    };
    this.ui.previousFrameButton.addEventListener("click", previousHandler);
    this.ui.nextFrameButton.addEventListener("click", nextHandler);
    this.disposers.push(
      () => this.ui.previousFrameButton.removeEventListener("click", previousHandler),
      () => this.ui.nextFrameButton.removeEventListener("click", nextHandler),
    );

    this.ui.animationButtons.forEach((button) => {
      const handler = () => {
        const animationId = button.dataset.animation;
        if (!animationId || !VALID_ANIMATIONS.has(animationId)) return;
        this.manualPreview = true;
        this.attackLocked = false;
        this.landingLocked = false;
        this.animation.setAnimation(animationId as AnimationId, { restart: true });
        this.render();
      };
      button.addEventListener("click", handler);
      this.disposers.push(() => button.removeEventListener("click", handler));
    });

    const keyHandler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "KeyQ") this.cycleIdentity();
      if (event.code === "KeyE") this.cycleOutfit();
      if (event.code === "KeyR") weaponHandler();
      if (event.code === "KeyG") galleryHandler();
      if (["KeyQ", "KeyE", "KeyR", "KeyG"].includes(event.code)) event.preventDefault();
    };
    window.addEventListener("keydown", keyHandler);
    this.disposers.push(() => window.removeEventListener("keydown", keyHandler));
  }

  private applyQueryState(): void {
    const params = new URLSearchParams(window.location.search);
    const requestedAnimation = params.get("animation");
    if (requestedAnimation && VALID_ANIMATIONS.has(requestedAnimation)) {
      this.animation.setAnimation(requestedAnimation as AnimationId, { restart: true });
      this.manualPreview = true;
    }
    const requestedTick = Number.parseInt(params.get("tick") ?? "0", 10);
    if (Number.isFinite(requestedTick) && requestedTick > 0) {
      this.animation.tick(requestedTick);
    }
    if (params.get("gallery") === "1") this.setGallery(true);
    if (params.get("paused") === "1" || params.get("testMode") === "1") this.setPaused(true);
    const debug = params.get("debug")?.split(",") ?? [];
    if (debug.includes("layers")) this.setLayerDebug(true);
    if (debug.includes("anchors")) this.setAnchorDebug(true);
  }

  private loop(deltaMs: number): void {
    this.metrics.add(deltaMs);
    if (!this.paused && !this.galleryVisible) {
      this.accumulatorMs = Math.min(MAX_ACCUMULATED_MS, this.accumulatorMs + deltaMs);
      while (this.accumulatorMs >= TICK_MS) {
        this.fixedStep();
        this.accumulatorMs -= TICK_MS;
      }
    }
    this.render();
  }

  private fixedStep(): void {
    const horizontal = this.input.isHeld("left")
      ? this.input.isHeld("right")
        ? 0
        : -1
      : this.input.isHeld("right")
        ? 1
        : 0;
    const hasActiveInput =
      horizontal !== 0 ||
      this.input.wasPressed("jump") ||
      this.input.wasPressed("attack");
    if (hasActiveInput) this.manualPreview = false;

    const previous = this.simulation;
    this.simulation = immutableSimulationWithBounds(
      stepSimulation(
        previous,
        {
          horizontal,
          jumpPressed: this.input.wasPressed("jump") && !this.attackLocked,
        },
        SIMULATION_CONFIG,
      ),
    );

    if (this.input.wasPressed("attack") && this.simulation.grounded && !this.attackLocked) {
      this.attackLocked = true;
      this.landingLocked = false;
      this.animation.setAnimation("attack", { restart: true });
    }

    if (this.manualPreview) {
      this.animation.tick();
    } else if (this.attackLocked) {
      const snapshot = this.animation.tick();
      if (snapshot.completed) {
        this.attackLocked = false;
        const next = deriveLocomotionAnimation(previous, this.simulation);
        this.animation.setAnimation(next, { restart: true });
      }
    } else if (this.landingLocked) {
      const snapshot = this.animation.tick();
      if (snapshot.completed) {
        this.landingLocked = false;
        const next: AnimationId = Math.abs(this.simulation.velocity.x) > 0.05 ? "run" : "idle";
        this.animation.setAnimation(next, { restart: true });
      }
    } else {
      const next = deriveLocomotionAnimation(previous, this.simulation);
      if (next === "land") {
        this.landingLocked = true;
        this.animation.setAnimation("land", { restart: true });
      } else if (next !== this.animation.animationId) {
        this.animation.setAnimation(next, { restart: true });
      }
      this.animation.tick();
    }

    this.input.consumeFrame();
  }

  private render(): void {
    const animation = this.animation.snapshot();
    const compositionKey = `${this.appearance.snapshot.revision}:${animation.animationId}:${animation.frameIndex}:${this.simulation.facing}`;
    const compositionChanged = compositionKey !== this.lastCompositionKey;
    if (compositionChanged) {
      this.composition = this.resolver.resolvePlayer(
        this.appearance.selection,
        animation,
        this.simulation.facing,
      );
      this.lastCompositionKey = compositionKey;
    }
    if (this.simulation.tick !== this.lastBackdropTick) {
      this.backdrop.update(this.simulation.tick);
      this.lastBackdropTick = this.simulation.tick;
    }
    this.playerView.setWorldPosition(this.simulation.position.x, this.simulation.position.y);
    this.playerView.setDebug({ layers: this.layerDebug, anchors: this.anchorDebug });
    const diagnostics = this.playerView.render(this.composition);
    const diagnosticKey = [
      diagnostics.missingPaletteTokens.join(","),
      diagnostics.pendingRasterAssets.join(","),
      diagnostics.failedRasterAssets.join(","),
    ].join("|");
    this.playerView.container.visible = !this.galleryVisible;

    this.gallery.setVisible(this.galleryVisible);
    if (this.galleryVisible) {
      this.gallery.render(
        (appearance, animationId, frameIndex) =>
          this.resolver.resolve({ appearance, animationId, frameIndex, facing: 1 }),
        animation.animationId,
        animation.frameIndex,
      );
    }

    if (
      compositionChanged ||
      this.lastUiKey === "" ||
      diagnosticKey !== this.lastDiagnosticKey ||
      this.simulation.tick - this.lastTelemetryTick >= 3
    ) {
      this.updateUi(diagnostics);
      this.lastDiagnosticKey = diagnosticKey;
      this.lastTelemetryTick = this.simulation.tick;
    }
  }

  private updateUi(diagnostics: CharacterRenderDiagnostics): void {
    const animation = this.animation.snapshot();
    const frameCount = getAnimation(animation.animationId).frames.length;
    this.ui.statusAnimation.textContent = humanAnimation(animation.animationId);
    this.ui.statusFrame.textContent = `${animation.frameIndex + 1} / ${frameCount}`;
    this.ui.statusProgress.textContent = animation.normalizedAnimationProgress.toFixed(2);
    this.ui.timelineProgress.style.width = `${animation.normalizedAnimationProgress * 100}%`;
    this.ui.stepFrame.textContent = String(animation.frameIndex + 1).padStart(2, "0");
    this.ui.statusPosition.textContent = `${this.simulation.position.x.toFixed(1)}, ${this.simulation.position.y.toFixed(1)}`;
    this.ui.statusVelocity.textContent = `${this.simulation.velocity.x.toFixed(1)}, ${this.simulation.velocity.y.toFixed(1)}`;
    this.ui.combinationCount.textContent = String(this.combinationIndex());
    this.ui.debugReadout.textContent = [
      `${diagnostics.missingPaletteTokens.length} missing palette tokens`,
      `${diagnostics.pendingRasterAssets.length} raster assets loading`,
      `${diagnostics.failedRasterAssets.length} raster asset failures`,
    ].join(" · ");

    const uiKey = [
      this.appearance.snapshot.revision,
      this.composition.signature,
      this.layerDebug,
      this.anchorDebug,
      this.paused,
      this.galleryVisible,
    ].join(":");
    if (uiKey !== this.lastUiKey) {
      this.updateToggleUi();
      this.updateLayerList();
      this.lastUiKey = uiKey;
    }
  }

  private updateToggleUi(): void {
    const current = this.appearance.snapshot;
    this.ui.identityButtons.forEach((button) =>
      setPressed(button, button.dataset.value === current.identityId),
    );
    this.ui.outfitButtons.forEach((button) =>
      setPressed(button, button.dataset.value === current.outfitId),
    );
    setPressed(this.ui.weaponButton, current.weaponId !== null);
    setPressed(this.ui.galleryButton, this.galleryVisible);
    setPressed(this.ui.layerDebugButton, this.layerDebug);
    setPressed(this.ui.anchorDebugButton, this.anchorDebug);
    setPressed(this.ui.pauseButton, this.paused);
    this.ui.animationButtons.forEach((button) =>
      button.classList.toggle("is-active", button.dataset.animation === this.animation.animationId),
    );
  }

  private updateLayerList(): void {
    this.ui.layerList.classList.toggle("is-visible", this.layerDebug);
    this.ui.layerList.innerHTML = this.composition.drawCommands
      .map(
        (command) =>
          `<li><span>${String(command.ordinal).padStart(2, "0")} · ${command.layer}</span><i style="--dot:#${(0x73d5bb + command.ordinal * 14561)
            .toString(16)
            .slice(-6)
            .padStart(6, "0")}"></i></li>`,
      )
      .join("");
  }

  private combinationIndex(): number {
    return (
      (this.appearance.snapshot.identityId === "bramble" ? 4 : 0) +
      (this.appearance.snapshot.outfitId === "hoodie" ? 2 : 0) +
      (this.appearance.snapshot.weaponId === null ? 0 : 1) +
      1
    );
  }

  private cycleIdentity(): SwapInvariantResult {
    const next =
      IDENTITY_IDS[(IDENTITY_IDS.indexOf(this.appearance.snapshot.identityId as (typeof IDENTITY_IDS)[number]) + 1) %
        IDENTITY_IDS.length]!;
    return this.swapAppearance({ identityId: next });
  }

  private cycleOutfit(): SwapInvariantResult {
    const next =
      OUTFIT_IDS[(OUTFIT_IDS.indexOf(this.appearance.snapshot.outfitId as (typeof OUTFIT_IDS)[number]) + 1) %
        OUTFIT_IDS.length]!;
    return this.swapAppearance({ outfitId: next });
  }

  private swapAppearance(patch: AppearancePatch): SwapInvariantResult {
    const before = preservationSnapshot(this.simulation, this.animation);
    this.appearance.swap(patch);
    const after = preservationSnapshot(this.simulation, this.animation);
    const preserved = preservationKey(before) === preservationKey(after);
    if (!preserved) throw new Error("Appearance transaction mutated simulation or animation state");
    this.lastUiKey = "";
    this.render();
    this.showToast(
      `${this.animation.animationId} · frame ${this.animation.frameIndex + 1} · motion state preserved`,
    );
    return Object.freeze({ preserved, before, after, appearance: this.appearance.snapshot });
  }

  private showToast(message: string): void {
    window.clearTimeout(this.toastTimer);
    this.ui.toast.textContent = message;
    this.ui.toast.classList.add("is-visible");
    this.toastTimer = window.setTimeout(() => this.ui.toast.classList.remove("is-visible"), 1_650);
  }

  private setPaused(paused: boolean): GameLabSnapshot {
    this.paused = paused;
    this.accumulatorMs = 0;
    this.lastUiKey = "";
    this.render();
    return this.snapshot();
  }

  private setGallery(visible: boolean): GameLabSnapshot {
    this.galleryVisible = visible;
    this.lastUiKey = "";
    this.render();
    return this.snapshot();
  }

  private setLayerDebug(visible: boolean): GameLabSnapshot {
    this.layerDebug = visible;
    this.lastUiKey = "";
    this.render();
    return this.snapshot();
  }

  private setAnchorDebug(visible: boolean): GameLabSnapshot {
    this.anchorDebug = visible;
    this.lastUiKey = "";
    this.render();
    return this.snapshot();
  }

  private snapshot(): GameLabSnapshot {
    return Object.freeze({
      ready: true,
      simulation: this.simulation,
      animation: this.animation.snapshot(),
      appearance: this.appearance.snapshot,
      composition: Object.freeze({
        signature: this.composition.signature,
        frameId: this.composition.frameId,
        drawCount: this.composition.drawCommands.length,
        hiddenLayers: this.composition.hiddenLayers,
        replacedLayers: this.composition.replacedLayers,
      }),
      debug: Object.freeze({
        paused: this.paused,
        gallery: this.galleryVisible,
        layers: this.layerDebug,
        anchors: this.anchorDebug,
      }),
    });
  }

  private installHarness(): void {
    window.__PAPER_DOLL__ = {
      ready: true,
      getSnapshot: () => this.snapshot(),
      getMetrics: () => this.metrics.snapshot(),
      resetMetrics: () => this.metrics.reset(),
      stepTicks: (count) => {
        if (!Number.isInteger(count) || count < 0 || count > 10_000) {
          throw new RangeError("stepTicks count must be an integer between 0 and 10000");
        }
        for (let index = 0; index < count; index += 1) this.fixedStep();
        this.render();
        return this.snapshot();
      },
      setPaused: (paused) => this.setPaused(paused),
      setAnimation: (animationId, tick = 0) => {
        this.manualPreview = true;
        this.attackLocked = false;
        this.landingLocked = false;
        this.animation.setAnimation(animationId, { restart: true });
        if (tick > 0) this.animation.tick(tick);
        this.render();
        return this.snapshot();
      },
      setFacing: (facing) => {
        if (facing !== -1 && facing !== 1) {
          throw new RangeError("facing must be -1 or 1");
        }
        this.simulation = Object.freeze({ ...this.simulation, facing });
        this.render();
        return this.snapshot();
      },
      setGallery: (visible) => this.setGallery(visible),
      setLayerDebug: (visible) => this.setLayerDebug(visible),
      setAnchorDebug: (visible) => this.setAnchorDebug(visible),
      setAppearance: (patch) => this.swapAppearance(patch),
      runSwapInvariant: (kind) => {
        if (kind === "identity") return this.cycleIdentity();
        if (kind === "outfit") return this.cycleOutfit();
        return this.swapAppearance({
          weaponId: this.appearance.snapshot.weaponId === null ? "wooden-sword" : null,
        });
      },
    };
  }

  destroy(): void {
    window.clearTimeout(this.toastTimer);
    delete window.__PAPER_DOLL__;
    this.disposers.forEach((dispose) => dispose());
    this.input.destroy();
    this.gallery.destroy();
    this.playerView.destroy();
    this.app.destroy(true, { children: true, context: false });
  }
}
