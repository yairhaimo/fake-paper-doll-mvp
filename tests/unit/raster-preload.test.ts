import { Assets } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CompositionResolver,
  type RasterPieceDescriptor,
} from "../../src/character";
import {
  VectorCharacterView,
  clearCharacterPieceCaches,
  preloadRasterAssets,
} from "../../src/render/VectorCharacterView";

const missingPresentation: RasterPieceDescriptor = Object.freeze({
  id: "test:missing-presentation",
  kind: "raster",
  shapeKey: "test:missing-presentation",
  layer: "accessoryFront",
  attachmentAnchor: "root",
  bounds: Object.freeze({ x: -128, y: -256, width: 256, height: 256 }),
  source: "/assets/test/does-not-exist.png",
  sourceRect: Object.freeze({ x: 0, y: 0, width: 512, height: 512 }),
  primitives: Object.freeze([]),
});

afterEach(() => {
  vi.restoreAllMocks();
  clearCharacterPieceCaches();
});

describe("raster preload degradation", () => {
  it("reports a failed preload without rejecting", async () => {
    vi.spyOn(Assets, "load").mockRejectedValueOnce(new Error("missing texture"));

    await expect(preloadRasterAssets([missingPresentation])).resolves.toEqual({
      loadedAssetIds: [],
      failedAssetIds: [missingPresentation.id],
    });
  });

  it("renders the complete semantic stack after presentation preload failure", async () => {
    vi.spyOn(Assets, "load").mockRejectedValueOnce(new Error("missing texture"));
    const view = new VectorCharacterView();
    const semantic = new CompositionResolver().resolve({
      appearance: {
        identityId: "moss",
        outfitId: "trail",
        weaponId: "wooden-sword",
      },
      animationId: "idle",
      frameIndex: 0,
    });

    await expect(view.preload([missingPresentation])).resolves.toBeUndefined();
    const diagnostics = view.render(
      Object.freeze({ ...semantic, presentationPiece: missingPresentation }),
    );

    expect(diagnostics.failedRasterAssets).toEqual([missingPresentation.id]);
    expect(
      view.pieceContainer.children.filter(({ visible }) => visible),
    ).toHaveLength(semantic.drawCommands.length);
    expect(semantic.drawCommands.length).toBeGreaterThan(1);
    view.destroy();
  });

  it("publishes lazy-load state changes for gallery invalidation", async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    const loading = new Promise<never>((_resolve, reject) => {
      rejectLoad = reject;
    });
    vi.spyOn(Assets, "load").mockReturnValueOnce(loading);
    const view = new VectorCharacterView();
    const semantic = new CompositionResolver().resolve({
      appearance: {
        identityId: "moss",
        outfitId: "trail",
        weaponId: "wooden-sword",
      },
      animationId: "idle",
      frameIndex: 0,
    });
    const composition = Object.freeze({
      ...semantic,
      presentationPiece: missingPresentation,
    });
    const initialRevision = view.rasterStateRevision;

    const pending = view.render(composition);
    expect(pending.pendingRasterAssets).toEqual([missingPresentation.id]);
    expect(view.rasterStateRevision).toBe(initialRevision + 1);
    expect(
      view.pieceContainer.children.filter(({ visible }) => visible),
    ).toHaveLength(semantic.drawCommands.length);

    rejectLoad?.(new Error("missing texture"));
    await vi.waitFor(() => {
      expect(view.rasterStateRevision).toBe(initialRevision + 2);
    });
    const failed = view.render(composition);
    expect(failed.pendingRasterAssets).toEqual([]);
    expect(failed.failedRasterAssets).toEqual([missingPresentation.id]);
    view.destroy();
  });
});
