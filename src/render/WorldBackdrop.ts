import { Container, Graphics, GraphicsContext, Text, TextStyle } from "pixi.js";

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const GROUND_Y = 444;

function createSky(): Graphics {
  const g = new Graphics();
  g.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0xb9e5dc);
  g.rect(0, 0, WORLD_WIDTH, 170).fill({ color: 0xd5eee4, alpha: 0.72 });
  g.circle(770, 96, 48).fill({ color: 0xffe39a, alpha: 0.86 });
  g.circle(770, 96, 69).fill({ color: 0xffedba, alpha: 0.2 });

  const cloud = (x: number, y: number, scale: number, alpha: number) => {
    g.ellipse(x, y, 49 * scale, 15 * scale).fill({ color: 0xf6f3dd, alpha });
    g.circle(x - 28 * scale, y - 7 * scale, 18 * scale).fill({ color: 0xf6f3dd, alpha });
    g.circle(x + 5 * scale, y - 15 * scale, 25 * scale).fill({ color: 0xf6f3dd, alpha });
    g.circle(x + 34 * scale, y - 6 * scale, 17 * scale).fill({ color: 0xf6f3dd, alpha });
  };

  cloud(172, 104, 0.72, 0.55);
  cloud(500, 72, 0.48, 0.35);
  cloud(862, 185, 0.6, 0.32);
  return g;
}

function createLandscape(): Graphics {
  const context = new GraphicsContext();
  context
    .svg(
      '<svg><path d="M0 297 C110 226 205 241 304 290 C414 208 525 224 630 288 C725 233 850 233 960 302 L960 444 L0 444 Z" fill="#72b9a1"/></svg>',
    )
    .svg(
      '<svg><path d="M0 344 C124 285 232 313 335 346 C445 284 572 306 663 347 C781 294 868 303 960 337 L960 444 L0 444 Z" fill="#4e9b85"/></svg>',
    )
    .svg(
      '<svg><path d="M0 386 C120 347 250 362 350 390 C493 338 613 367 706 395 C793 365 873 369 960 386 L960 459 L0 459 Z" fill="#337562"/></svg>',
    );
  return new Graphics(context);
}

function createTree(x: number, y: number, scale: number, flip = false): Container {
  const tree = new Container();
  tree.position.set(x, y);
  tree.scale.set(flip ? -scale : scale, scale);

  const trunk = new Graphics().roundRect(-16, -123, 30, 132, 13).fill(0x7d5949);
  trunk
    .moveTo(-2, -111)
    .bezierCurveTo(-8, -75, 4, -47, -1, -10)
    .stroke({ color: 0x5a3f40, width: 3, alpha: 0.35 });
  tree.addChild(trunk);

  const crown = new Graphics();
  const leaf = (cx: number, cy: number, rx: number, ry: number, color: number) => {
    crown.ellipse(cx, cy, rx, ry).fill(color);
  };
  leaf(-18, -137, 46, 42, 0x286959);
  leaf(26, -145, 52, 48, 0x337c66);
  leaf(-3, -180, 53, 55, 0x3d8a70);
  leaf(51, -188, 35, 40, 0x2e725f);
  leaf(-48, -176, 33, 40, 0x4a9274);
  crown.circle(-16, -193, 7).fill({ color: 0xa6d481, alpha: 0.55 });
  crown.circle(31, -178, 5).fill({ color: 0xe7d77f, alpha: 0.48 });
  tree.addChild(crown);
  return tree;
}

function createGround(): Container {
  const ground = new Container();
  const base = new Graphics();
  base.rect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y).fill(0x244f48);
  base
    .svg(
      '<svg><path d="M0 451 C96 428 196 447 284 438 C379 429 453 452 545 441 C670 425 779 453 960 432 L960 476 C802 489 687 469 566 481 C419 494 279 469 0 485 Z" fill="#d9bd76"/></svg>',
    )
    .svg(
      '<svg><path d="M0 443 C123 419 215 443 313 431 C429 416 514 447 618 432 C740 416 847 440 960 421 L960 452 C821 465 735 443 618 458 C497 474 408 445 304 460 C190 476 91 449 0 468 Z" fill="#659b63"/></svg>',
    );
  ground.addChild(base);

  const details = new Graphics();
  const tuft = (x: number, y: number, color: number, s = 1) => {
    details
      .moveTo(x - 8 * s, y)
      .quadraticCurveTo(x - 5 * s, y - 12 * s, x, y)
      .quadraticCurveTo(x + 2 * s, y - 17 * s, x + 4 * s, y)
      .quadraticCurveTo(x + 9 * s, y - 10 * s, x + 12 * s, y)
      .fill(color);
  };
  tuft(72, 458, 0x3d7658, 1.2);
  tuft(198, 452, 0x477f5d, 0.9);
  tuft(338, 463, 0x3d7658, 0.7);
  tuft(718, 456, 0x477f5d, 1.05);
  tuft(872, 454, 0x3d7658, 1.15);
  details.ellipse(160, 474, 21, 6).fill(0xb79b66);
  details.ellipse(598, 471, 17, 5).fill(0xb79b66);
  details.ellipse(790, 486, 27, 6).fill({ color: 0x173d39, alpha: 0.35 });

  const flower = (x: number, y: number, color: number) => {
    details.moveTo(x, y).lineTo(x, y - 15).stroke({ color: 0x3f7d5f, width: 2 });
    details.circle(x - 3, y - 17, 4).fill(color);
    details.circle(x + 3, y - 17, 4).fill(color);
    details.circle(x, y - 21, 4).fill(color);
    details.circle(x, y - 17, 2.5).fill(0xffe086);
  };
  flower(116, 463, 0xf2a084);
  flower(650, 461, 0xc996d7);
  flower(905, 462, 0xf2a084);
  ground.addChild(details);
  return ground;
}

function createSign(): Container {
  const sign = new Container();
  sign.position.set(108, 383);
  const graphic = new Graphics();
  graphic.roundRect(-4, 0, 8, 67, 4).fill(0x6e4a3e);
  graphic
    .svg(
      '<svg><path d="M-52 -13 Q-56 -19 -48 -24 L43 -24 L58 -11 L43 2 L-48 2 Q-56 -4 -52 -13Z" fill="#e7c276" stroke="#6f4b3d" stroke-width="4" stroke-linejoin="round"/></svg>',
    );
  sign.addChild(graphic);
  const text = new Text({
    text: "MOSS GROVE",
    style: new TextStyle({
      fill: 0x61463e,
      fontFamily: "system-ui, sans-serif",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
    }),
  });
  text.anchor.set(0.5);
  text.position.set(-1, -12);
  sign.addChild(text);
  return sign;
}

export class WorldBackdrop {
  readonly container = new Container();
  readonly effects = new Container();
  private readonly motes: Graphics[] = [];

  constructor() {
    this.container.addChild(createSky(), createLandscape());
    this.container.addChild(createTree(20, 434, 1.18));
    this.container.addChild(createTree(925, 439, 1.06, true));
    this.container.addChild(createTree(880, 430, 0.64, true));
    this.container.addChild(createSign());
    this.container.addChild(createGround());

    for (let index = 0; index < 12; index += 1) {
      const mote = new Graphics()
        .circle(0, 0, index % 3 === 0 ? 2.2 : 1.5)
        .fill({ color: index % 2 === 0 ? 0xffe58f : 0xc7f3db, alpha: 0.72 });
      this.motes.push(mote);
      this.effects.addChild(mote);
    }
    this.container.addChild(this.effects);
  }

  update(tick: number): void {
    this.motes.forEach((mote, index) => {
      const phase = tick * 0.012 + index * 2.13;
      mote.x = 72 + ((index * 83 + tick * (0.08 + (index % 3) * 0.02)) % 840);
      mote.y = 210 + ((index * 41) % 165) + Math.sin(phase) * 8;
      mote.alpha = 0.35 + (Math.sin(phase * 1.7) + 1) * 0.18;
    });
  }
}
