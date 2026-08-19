import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type {
  AnimationId,
  AppearanceSelection,
  CompositionResult,
} from "../character/types";
import { VectorCharacterView } from "./VectorCharacterView";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./WorldBackdrop";

export const GALLERY_COMBINATIONS = [
  { identityId: "moss", outfitId: "trail", weaponId: "wooden-sword" },
  { identityId: "moss", outfitId: "hoodie", weaponId: "wooden-sword" },
  { identityId: "bramble", outfitId: "trail", weaponId: "wooden-sword" },
  { identityId: "bramble", outfitId: "hoodie", weaponId: "wooden-sword" },
] as const satisfies readonly AppearanceSelection[];

export type GalleryResolver = (
  appearance: AppearanceSelection,
  animationId: AnimationId,
  frameIndex: number,
) => CompositionResult;

const titleStyle = new TextStyle({
  fill: 0x263a3e,
  fontFamily: "system-ui, sans-serif",
  fontSize: 20,
  fontWeight: "800",
  letterSpacing: -0.4,
});

const subtitleStyle = new TextStyle({
  fill: 0x577176,
  fontFamily: "system-ui, sans-serif",
  fontSize: 9,
  fontWeight: "700",
  letterSpacing: 1.2,
});

const cardLabelStyle = new TextStyle({
  fill: 0x344c52,
  fontFamily: "system-ui, sans-serif",
  fontSize: 10,
  fontWeight: "800",
  letterSpacing: 0.5,
});

const cardMetaStyle = new TextStyle({
  fill: 0x789095,
  fontFamily: "ui-monospace, monospace",
  fontSize: 7,
  fontWeight: "700",
});

function displayName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export class CombinationGallery {
  readonly container = new Container();
  private readonly characterViews: VectorCharacterView[] = [];
  private lastKey = "";

  constructor() {
    this.container.visible = false;

    const veil = new Graphics()
      .roundRect(48, 28, WORLD_WIDTH - 96, WORLD_HEIGHT - 56, 27)
      .fill({ color: 0xf4ecd8, alpha: 0.96 })
      .stroke({ color: 0xffffff, width: 2, alpha: 0.38 });
    this.container.addChild(veil);

    const title = new Text({ text: "Compatibility board", style: titleStyle });
    title.position.set(78, 53);
    this.container.addChild(title);

    const subtitle = new Text({
      text: "2 IDENTITIES × 2 OUTFITS · SAME BODY CONTRACT · SWORD EQUIPPED",
      style: subtitleStyle,
    });
    subtitle.position.set(79, 83);
    this.container.addChild(subtitle);

    const cardWidth = 191;
    const cardHeight = 342;
    const startX = 78;
    const gap = 15;
    GALLERY_COMBINATIONS.forEach((appearance, index) => {
      const x = startX + index * (cardWidth + gap);
      const card = new Graphics()
        .roundRect(x, 112, cardWidth, cardHeight, 18)
        .fill(index % 2 === 0 ? 0xe6e1c9 : 0xd9e5d8)
        .stroke({ color: 0x9bb2a7, width: 1, alpha: 0.35 });
      card
        .ellipse(x + cardWidth / 2, 377, 57, 9)
        .fill({ color: 0x45635f, alpha: 0.16 });
      this.container.addChild(card);

      const identity = new Text({
        text: displayName(appearance.identityId),
        style: cardLabelStyle,
      });
      identity.position.set(x + 16, 130);
      this.container.addChild(identity);

      const outfit = new Text({
        text: appearance.outfitId === "trail" ? "TRAIL SET" : "SCOUT HOODIE",
        style: cardMetaStyle,
      });
      outfit.position.set(x + 16, 148);
      this.container.addChild(outfit);

      const badge = new Graphics()
        .roundRect(x + cardWidth - 43, 128, 28, 17, 8)
        .fill(index < 2 ? 0x64bea9 : 0x886493);
      this.container.addChild(badge);
      const badgeText = new Text({
        text: index < 2 ? "A" : "B",
        style: new TextStyle({
          fill: 0xffffff,
          fontFamily: "ui-monospace, monospace",
          fontSize: 8,
          fontWeight: "800",
        }),
      });
      badgeText.anchor.set(0.5);
      badgeText.position.set(x + cardWidth - 29, 136.5);
      this.container.addChild(badgeText);

      const view = new VectorCharacterView();
      view.container.scale.set(0.8);
      view.setWorldPosition(x + cardWidth / 2, 386);
      this.characterViews.push(view);
      this.container.addChild(view.container);

      const layers = new Text({
        text: "23 semantic layer slots\n0 implicit fallbacks",
        style: cardMetaStyle,
      });
      layers.position.set(x + 16, 414);
      this.container.addChild(layers);
    });

    const footer = new Text({
      text: "Every card resolves through the same deterministic compositor. Identity and clothing never own animation time.",
      style: new TextStyle({
        fill: 0x60777a,
        fontFamily: "system-ui, sans-serif",
        fontSize: 9,
        fontWeight: "600",
      }),
    });
    footer.position.set(79, 478);
    this.container.addChild(footer);
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  render(resolver: GalleryResolver, animationId: AnimationId, frameIndex: number): void {
    const key = `${animationId}:${frameIndex}`;
    if (key === this.lastKey) return;
    GALLERY_COMBINATIONS.forEach((appearance, index) => {
      const composition = resolver(appearance, animationId, frameIndex);
      this.characterViews[index]!.render(composition);
    });
    this.lastKey = key;
  }

  destroy(): void {
    this.characterViews.forEach((view) => view.destroy());
    this.container.destroy({ children: true });
  }
}
