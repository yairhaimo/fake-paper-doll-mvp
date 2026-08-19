import type {
  AnchorName,
  Bounds,
  FrameDefinition,
  PaletteToken,
  Point,
  SemanticLayer,
  VectorPieceDescriptor,
  VectorPrimitive,
} from './types';

const INK = 'shared.ink' as const;

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointText(point: Point): string {
  return `${rounded(point.x)} ${rounded(point.y)}`;
}

function relative(point: Point, origin: Point): Point {
  return { x: point.x - origin.x, y: point.y - origin.y };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function length(point: Point): number {
  return Math.hypot(point.x, point.y);
}

function normal(from: Point, to: Point): Point {
  const vector = subtract(to, from);
  const magnitude = Math.max(0.001, length(vector));
  return { x: -vector.y / magnitude, y: vector.x / magnitude };
}

function averageNormal(a: Point, b: Point): Point {
  const sum = add(a, b);
  const magnitude = Math.max(0.001, length(sum));
  return { x: sum.x / magnitude, y: sum.y / magnitude };
}

function bentContour(
  elbow: Point,
  end: Point,
  startWidth: number,
  jointWidth: number,
  endWidth: number,
): string {
  const start = { x: 0, y: 0 };
  const firstNormal = normal(start, elbow);
  const secondNormal = normal(elbow, end);
  const jointNormal = averageNormal(firstNormal, secondNormal);

  const a = add(start, scale(firstNormal, startWidth));
  const b = add(elbow, scale(jointNormal, jointWidth));
  const c = add(end, scale(secondNormal, endWidth));
  const d = add(end, scale(secondNormal, -endWidth));
  const e = add(elbow, scale(jointNormal, -jointWidth));
  const f = add(start, scale(firstNormal, -startWidth));

  return [
    `M ${pointText(a)}`,
    `Q ${pointText(b)} ${pointText(c)}`,
    `Q ${pointText(add(end, scale(subtract(end, elbow), 0.16)))} ${pointText(d)}`,
    `Q ${pointText(e)} ${pointText(f)}`,
    `Q ${pointText(add(start, scale(subtract(start, elbow), 0.16)))} ${pointText(a)}`,
    'Z',
  ].join(' ');
}

function straightContour(end: Point, startWidth: number, endWidth: number): string {
  const start = { x: 0, y: 0 };
  const side = normal(start, end);
  const a = add(start, scale(side, startWidth));
  const b = add(end, scale(side, endWidth));
  const c = add(end, scale(side, -endWidth));
  const d = add(start, scale(side, -startWidth));
  return `M ${pointText(a)} Q ${pointText(b)} ${pointText(b)} Q ${pointText(end)} ${pointText(c)} L ${pointText(d)} Q ${pointText(start)} ${pointText(a)} Z`;
}

function piece(
  id: string,
  shapeKey: string,
  layer: SemanticLayer,
  attachmentAnchor: AnchorName,
  bounds: Bounds,
  primitives: readonly VectorPrimitive[],
  tags: readonly string[] = [],
): VectorPieceDescriptor {
  return Object.freeze({
    id,
    shapeKey,
    layer,
    attachmentAnchor,
    bounds: Object.freeze(bounds),
    primitives: Object.freeze(primitives),
    tags: Object.freeze(tags),
  });
}

function filledPath(
  d: string,
  fill: PaletteToken,
  strokeWidth = 4,
): VectorPrimitive {
  return {
    kind: 'path',
    d,
    fill,
    stroke: INK,
    strokeWidth,
    lineJoin: 'round',
    lineCap: 'round',
  };
}

export function createSharedGroundShadow(): VectorPieceDescriptor {
  return piece(
    'shared/ground-shadow',
    'shared.ground-shadow',
    'groundShadow',
    'ground',
    { x: -48, y: -5, width: 96, height: 13 },
    [
      {
        kind: 'ellipse',
        cx: 0,
        cy: 1,
        rx: 46,
        ry: 6,
        fill: 'shared.groundShadow',
        opacity: 0.34,
      },
    ],
    ['shared', 'non-random'],
  );
}

export function createIdentityPiece(
  identityId: 'moss' | 'bramble',
  frame: FrameDefinition,
  layer: SemanticLayer,
): VectorPieceDescriptor {
  const id = `identity/${identityId}/${frame.id}/${layer}`;
  const poseChannel =
    layer === 'rearArm' || layer === 'frontArm'
      ? layer
      : layer === 'rearHand'
        ? 'rearHand'
        : layer === 'frontHand'
          ? 'frontHand'
          : layer === 'rearLeg' || layer === 'frontLeg'
            ? layer
            : layer === 'rearFoot' || layer === 'frontFoot'
              ? layer
              : layer === 'face'
                ? 'face'
                : layer === 'tailBack'
                  ? 'tail'
                  : layer === 'tuftBack' || layer === 'tuftFront'
                    ? 'tuft'
                    : layer === 'head' || layer === 'earBack'
                      ? 'head'
                      : 'body';
  const poseTag = frame.poses[poseChannel];
  const shapeKey = `identity.${identityId}.${layer}.${frame.id}.${poseTag}`;

  if (layer === 'tailBack') {
    const isMoss = identityId === 'moss';
    const lift = frame.poses.tail.includes('lift') ? -8 : 0;
    const d = isMoss
      ? `M 1 2 C -13 ${-7 + lift} -28 ${-12 + lift} -36 ${-2 + lift} C -43 ${8 + lift} -30 ${17 + lift} -15 ${12 + lift} C -6 ${10 + lift} 0 7 1 2 Z`
      : `M 1 2 C -11 ${-5 + lift} -29 ${-5 + lift} -39 ${5 + lift} C -47 ${13 + lift} -37 ${23 + lift} -21 ${19 + lift} C -8 ${16 + lift} -1 9 1 2 Z`;
    return piece(
      id,
      shapeKey,
      layer,
      'tailRoot',
      { x: -49, y: -22, width: 53, height: 48 },
      [filledPath(d, 'identity.shadow')],
      ['identity-silhouette', 'pose-specific'],
    );
  }

  if (layer === 'earBack') {
    const primitives: VectorPrimitive[] =
      identityId === 'moss'
        ? [
            filledPath(
              'M -39 40 C -61 31 -69 13 -55 7 C -40 1 -27 19 -29 38 Z',
              'identity.fur',
            ),
            filledPath(
              'M 39 40 C 60 29 65 11 51 7 C 37 3 27 21 29 39 Z',
              'identity.shadow',
            ),
            {
              kind: 'path',
              d: 'M -51 14 Q -43 23 -35 34 M 51 14 Q 43 23 35 34',
              fill: 'none',
              stroke: 'identity.highlight',
              strokeWidth: 4,
              lineCap: 'round',
            },
          ]
        : [
            filledPath(
              'M -37 34 C -49 22 -51 7 -40 1 C -30 -3 -24 12 -26 31 Z',
              'identity.horn',
            ),
            filledPath(
              'M 36 34 C 49 20 49 5 38 1 C 28 -2 23 13 26 32 Z',
              'identity.horn',
            ),
            {
              kind: 'path',
              d: 'M -43 11 Q -35 16 -28 27 M 42 10 Q 34 17 28 28',
              fill: 'none',
              stroke: 'identity.hornShadow',
              strokeWidth: 3,
              lineCap: 'round',
            },
          ];
    return piece(
      id,
      shapeKey,
      layer,
      'headTop',
      { x: -70, y: -5, width: 138, height: 55 },
      primitives,
      ['identity-silhouette'],
    );
  }

  if (layer === 'tuftBack') {
    const d =
      identityId === 'moss'
        ? 'M -18 13 C -25 -5 -10 -15 -1 2 C 4 -16 21 -11 17 7 C 26 1 33 13 19 20 Z'
        : 'M -22 16 C -25 0 -8 -12 0 4 C 8 -10 24 -2 17 13 C 29 10 31 25 17 25 Z';
    return piece(
      id,
      shapeKey,
      layer,
      'headTop',
      { x: -30, y: -18, width: 64, height: 47 },
      [filledPath(d, 'identity.shadow')],
      ['secondary-motion-safe'],
    );
  }

  if (layer === 'head') {
    const squash = frame.poses.head.includes('squash');
    const forwardFocus = frame.poses.head.includes('forward-focus');
    const centerY = squash ? -36 : forwardFocus ? -39 : -40;
    const ry = squash ? 41 : forwardFocus ? 44 : 45;
    const backEdge = forwardFocus ? -46 : -49;
    const frontEdge = forwardFocus ? 57 : 53;
    return piece(
      id,
      shapeKey,
      layer,
      'neck',
      { x: -57, y: -88, width: 114, height: 91 },
      [
        filledPath(
          `M ${backEdge} ${centerY - 13} C ${backEdge + 2} ${centerY - 39} -24 ${centerY - ry} 1 ${centerY - ry} C 29 ${centerY - ry} ${frontEdge - 2} ${centerY - 37} ${frontEdge} ${centerY - 11} C ${frontEdge + 5} ${centerY + 8} ${frontEdge - 5} ${centerY + 33} 27 ${centerY + 40} C 11 ${centerY + 50} -10 ${centerY + 48} -25 ${centerY + 39} C ${backEdge + 2} ${centerY + 34} ${backEdge - 8} ${centerY + 8} ${backEdge - 3} ${centerY - 7} C ${backEdge - 9} ${centerY - 10} ${backEdge - 7} ${centerY - 15} ${backEdge} ${centerY - 13} Z`,
          'identity.fur',
        ),
        {
          kind: 'path',
          d: `M -30 ${centerY - 25} Q -10 ${centerY - 40} 13 ${centerY - 34}`,
          fill: 'none',
          stroke: 'identity.highlight',
          strokeWidth: 5,
          lineCap: 'round',
        },
      ],
      ['canonical-head-mask'],
    );
  }

  if (layer === 'face') {
    const blink = frame.poses.face === 'blink';
    const focused = frame.poses.face === 'attack-focus';
    const eyeY = -8;
    const primitives: VectorPrimitive[] = [
      {
        kind: 'ellipse',
        cx: 0,
        cy: 8,
        rx: identityId === 'moss' ? 25 : 23,
        ry: identityId === 'moss' ? 17 : 16,
        fill: 'identity.muzzle',
      },
    ];
    if (focused) {
      primitives.push(
        {
          kind: 'ellipse',
          cx: -10,
          cy: eyeY,
          rx: identityId === 'moss' ? 7 : 8,
          ry: 5,
          fill: INK,
        },
        {
          kind: 'ellipse',
          cx: 17,
          cy: eyeY,
          rx: identityId === 'moss' ? 7 : 8,
          ry: 5,
          fill: INK,
        },
        { kind: 'ellipse', cx: -8, cy: eyeY - 1, rx: 2, ry: 2, fill: 'shared.eyeGlint' },
        { kind: 'ellipse', cx: 19, cy: eyeY - 1, rx: 2, ry: 2, fill: 'shared.eyeGlint' },
        {
          kind: 'path',
          d: `M -19 ${eyeY - 9} Q -11 ${eyeY - 13} -3 ${eyeY - 8} M 9 ${eyeY - 8} Q 17 ${eyeY - 13} 25 ${eyeY - 9}`,
          fill: 'none',
          stroke: INK,
          strokeWidth: 3,
          lineCap: 'round',
        },
      );
    } else if (blink) {
      primitives.push({
        kind: 'path',
        d: `M -18 ${eyeY} Q -11 ${eyeY + 5} -4 ${eyeY} M 9 ${eyeY} Q 16 ${eyeY + 5} 23 ${eyeY}`,
        fill: 'none',
        stroke: INK,
        strokeWidth: 4,
        lineCap: 'round',
      });
    } else {
      primitives.push(
        {
          kind: 'ellipse',
          cx: -10,
          cy: eyeY,
          rx: identityId === 'moss' ? 7 : 8,
          ry: identityId === 'moss' ? 9 : 7,
          fill: INK,
        },
        {
          kind: 'ellipse',
          cx: 17,
          cy: eyeY,
          rx: identityId === 'moss' ? 7 : 8,
          ry: identityId === 'moss' ? 9 : 7,
          fill: INK,
        },
        { kind: 'ellipse', cx: -8, cy: eyeY - 2, rx: 2, ry: 3, fill: 'shared.eyeGlint' },
        { kind: 'ellipse', cx: 19, cy: eyeY - 2, rx: 2, ry: 3, fill: 'shared.eyeGlint' },
      );
    }
    primitives.push(
      { kind: 'ellipse', cx: 5, cy: 4, rx: 4, ry: 3, fill: INK },
      {
        kind: 'path',
        d: focused
          ? 'M 3 12 Q 10 8 18 12'
          : identityId === 'moss'
            ? 'M 4 10 Q 10 16 17 11'
            : 'M 3 11 Q 9 14 15 10',
        fill: 'none',
        stroke: INK,
        strokeWidth: 3,
        lineCap: 'round',
      },
    );
    if (identityId === 'moss') {
      primitives.push({
        kind: 'path',
        d: 'M -26 9 Q -32 5 -34 -1 M -24 14 Q -31 14 -35 18',
        fill: 'none',
        stroke: 'identity.detail',
        strokeWidth: 3,
        lineCap: 'round',
      });
    } else {
      primitives.push(
        { kind: 'ellipse', cx: 27, cy: 8, rx: 2, ry: 2, fill: 'identity.detail' },
        { kind: 'ellipse', cx: 31, cy: 13, rx: 2, ry: 2, fill: 'identity.detail' },
      );
    }
    return piece(
      id,
      shapeKey,
      layer,
      'faceCenter',
      { x: -38, y: -20, width: 74, height: 48 },
      primitives,
      ['identity-expression'],
    );
  }

  if (layer === 'body') {
    const neck = frame.anchors.neck;
    const waist = frame.anchors.waist;
    const height = waist.y - neck.y;
    const squash = frame.poses.body.includes('squash');
    const lunging =
      frame.poses.body.includes('lunge') ||
      frame.poses.body.includes('forward-flight');
    const width = squash ? 44 : frame.poses.body.includes('expanded') ? 40 : 38;
    const lean = lunging ? neck.x - waist.x : 0;
    const torsoPath = lunging
      ? `M ${-18 + lean} ${-height + 2} C ${-34 + lean} ${-height + 9} -${width} -31 -${width - 3} -9 C -${width - 8} 4 ${width - 10} 5 ${width - 2} -7 C ${width + 4} -29 ${34 + lean} ${-height + 11} ${18 + lean} ${-height + 2} Z`
      : `M -18 ${-height + 2} C -36 ${-height + 10} -${width} -30 -${width - 3} -9 C -${width - 8} 4 ${width - 8} 4 ${width - 3} -9 C ${width} -31 35 ${-height + 10} 18 ${-height + 2} Z`;
    return piece(
      id,
      shapeKey,
      layer,
      'waist',
      { x: -48, y: -70, width: 96, height: 74 },
      [
        filledPath(
          torsoPath,
          'identity.fur',
        ),
      ],
      ['canonical-torso'],
    );
  }

  if (layer === 'rearArm' || layer === 'frontArm') {
    const rear = layer === 'rearArm';
    const shoulderName = rear ? 'shoulderRear' : 'shoulderFront';
    const elbowName = rear ? 'elbowRear' : 'elbowFront';
    const handName = rear ? 'handRear' : 'handFront';
    const shoulder = frame.anchors[shoulderName];
    const elbow = relative(frame.anchors[elbowName], shoulder);
    const hand = relative(frame.anchors[handName], shoulder);
    return piece(
      id,
      shapeKey,
      layer,
      shoulderName,
      { x: -28, y: -30, width: 90, height: 105 },
      [filledPath(bentContour(elbow, hand, 11, 10, 8), rear ? 'identity.shadow' : 'identity.fur')],
      ['authored-bent-limb', 'pose-specific', frame.poses[rear ? 'rearArm' : 'frontArm']],
    );
  }

  if (layer === 'rearHand' || layer === 'frontHand') {
    const rear = layer === 'rearHand';
    return piece(
      id,
      shapeKey,
      layer,
      rear ? 'handRear' : 'handFront',
      { x: -12, y: -11, width: 24, height: 23 },
      [
        filledPath(
          'M -9 -4 C -7 -11 3 -12 8 -7 C 14 -2 10 9 3 11 C -5 13 -13 5 -9 -4 Z',
          rear ? 'identity.shadow' : 'identity.fur',
          3,
        ),
      ],
      ['mitten-paw', 'pose-specific'],
    );
  }

  if (layer === 'rearLeg' || layer === 'frontLeg') {
    const rear = layer === 'rearLeg';
    const hipName = rear ? 'hipRear' : 'hipFront';
    const kneeName = rear ? 'kneeRear' : 'kneeFront';
    const footName = rear ? 'footRear' : 'footFront';
    const hip = frame.anchors[hipName];
    const knee = relative(frame.anchors[kneeName], hip);
    const foot = relative(frame.anchors[footName], hip);
    return piece(
      id,
      shapeKey,
      layer,
      hipName,
      { x: -31, y: -15, width: 72, height: 72 },
      [filledPath(bentContour(knee, foot, 12, 11, 8), rear ? 'identity.shadow' : 'identity.fur')],
      ['authored-knee', 'pose-specific', frame.poses[rear ? 'rearLeg' : 'frontLeg']],
    );
  }

  if (layer === 'rearFoot' || layer === 'frontFoot') {
    const rear = layer === 'rearFoot';
    const pose = frame.poses[rear ? 'rearFoot' : 'frontFoot'];
    const flattened = pose.includes('flat') || pose.includes('planted') || pose.includes('contact');
    const ry = flattened ? 8 : 10;
    const forward = pose.includes('forward') || pose.includes('front');
    const d = forward
      ? `M -10 -${ry - 1} C 2 -${ry + 5} 18 -${ry} 19 0 C 20 ${ry} 6 ${ry + 3} -9 ${ry} C -18 ${ry - 1} -19 -3 -10 -${ry - 1} Z`
      : `M 10 -${ry - 1} C -2 -${ry + 5} -18 -${ry} -19 0 C -20 ${ry} -6 ${ry + 3} 9 ${ry} C 18 ${ry - 1} 19 -3 10 -${ry - 1} Z`;
    return piece(
      id,
      shapeKey,
      layer,
      rear ? 'footRear' : 'footFront',
      { x: -22, y: -16, width: 44, height: 30 },
      [filledPath(d, rear ? 'identity.shadow' : 'identity.fur')],
      ['authored-foot', 'pose-specific', pose],
    );
  }

  if (layer === 'tuftFront') {
    const d =
      identityId === 'moss'
        ? 'M -23 11 C -19 -2 -7 -9 -2 4 C 3 -9 14 -7 13 5 C 23 -3 30 8 20 18 C 8 14 -8 14 -23 11 Z'
        : 'M -22 12 C -15 -2 -5 -6 0 5 C 7 -6 18 1 13 11 C 24 5 28 17 17 21 C 5 15 -9 15 -22 12 Z';
    return piece(
      id,
      shapeKey,
      layer,
      'headTop',
      { x: -27, y: -12, width: 58, height: 36 },
      [filledPath(d, 'identity.fur')],
      ['identity-silhouette', 'secondary-motion-safe'],
    );
  }

  throw new Error(`Unsupported identity layer ${layer}`);
}

export function createOutfitPiece(
  outfitId: 'trail' | 'hoodie',
  frame: FrameDefinition,
  layer: SemanticLayer,
): VectorPieceDescriptor {
  const id = `outfit/${outfitId}/${frame.id}/${layer}`;
  const poseChannel =
    layer === 'rearArm' || layer === 'frontArm'
      ? layer
      : layer === 'rearFoot' || layer === 'frontFoot'
        ? layer
        : 'body';
  const poseTag = frame.poses[poseChannel];
  const shapeKey = `outfit.${outfitId}.${layer}.${frame.id}.${poseTag}`;

  if (layer === 'rearArm' || layer === 'frontArm') {
    const rear = layer === 'rearArm';
    const shoulderName = rear ? 'shoulderRear' : 'shoulderFront';
    const elbowName = rear ? 'elbowRear' : 'elbowFront';
    const handName = rear ? 'handRear' : 'handFront';
    const shoulder = frame.anchors[shoulderName];
    const elbow = relative(frame.anchors[elbowName], shoulder);
    const hand = relative(frame.anchors[handName], shoulder);
    const baseColor = rear ? 'outfit.shadow' : 'outfit.primary';
    const primitives: VectorPrimitive[] = [];

    if (outfitId === 'trail') {
      primitives.push(
        filledPath(bentContour(elbow, hand, 10, 9, 7), 'identity.fur'),
        filledPath(
          straightContour(scale(elbow, 0.7), 13, 11),
          baseColor,
        ),
      );
    } else {
      primitives.push(
        filledPath(bentContour(elbow, hand, 15, 14, 11), baseColor),
        {
          kind: 'ellipse',
          cx: hand.x,
          cy: hand.y,
          rx: 11,
          ry: 8,
          fill: 'outfit.accent',
          stroke: INK,
          strokeWidth: 3,
        },
      );
    }

    return piece(
      id,
      shapeKey,
      layer,
      shoulderName,
      { x: -32, y: -35, width: 100, height: 112 },
      primitives,
      [
        'authored-sleeve',
        'pose-specific',
        outfitId === 'hoodie' ? 'puffy-contour' : 'short-sleeve',
        poseTag,
      ],
    );
  }

  if (layer === 'rearFoot' || layer === 'frontFoot') {
    const rear = layer === 'rearFoot';
    const pose = frame.poses[rear ? 'rearFoot' : 'frontFoot'];
    const flat = pose.includes('flat') || pose.includes('contact') || pose.includes('planted');
    const wide = outfitId === 'hoodie' ? 23 : 20;
    const height = flat ? 10 : 13;
    const d = `M -${wide - 7} -${height} C -2 -${height + 5} ${wide - 3} -${height + 3} ${wide} -2 C ${wide + 2} ${height - 2} ${wide - 8} ${height} -${wide - 12} ${height} C -${wide + 1} ${height - 1} -${wide + 3} -3 -${wide - 7} -${height} Z`;
    return piece(
      id,
      shapeKey,
      layer,
      rear ? 'footRear' : 'footFront',
      { x: -26, y: -20, width: 53, height: 35 },
      [
        filledPath(d, rear ? 'outfit.shoeShadow' : 'outfit.shoe'),
        {
          kind: 'line',
          from: { x: -wide + 7, y: height - 1 },
          to: { x: wide - 5, y: height - 1 },
          stroke: 'outfit.sole',
          strokeWidth: outfitId === 'hoodie' ? 5 : 4,
          lineCap: 'round',
        },
      ],
      ['authored-shoe', 'pose-specific', pose],
    );
  }

  if (layer === 'top') {
    const waist = frame.anchors.waist;
    const neck = relative(frame.anchors.neck, waist);
    const rearShoulder = relative(frame.anchors.shoulderRear, waist);
    const frontShoulder = relative(frame.anchors.shoulderFront, waist);
    const compressed = frame.poses.body.includes('compressed') || frame.poses.body.includes('squash');
    const lunging =
      frame.poses.body.includes('lunge') ||
      frame.poses.body.includes('forward-flight');
    const chestShift = lunging ? neck.x : 0;
    const detailShift = lunging ? Math.round(chestShift * 0.45) : 0;
    const hemY = outfitId === 'hoodie' ? 8 : 2;
    const side = outfitId === 'hoodie' ? 45 : 39;
    const topY = neck.y + 4;
    const d = lunging
      ? outfitId === 'hoodie'
        ? `M ${rearShoulder.x - 8} ${rearShoulder.y} Q ${chestShift} ${topY - 12} ${frontShoulder.x + 8} ${frontShoulder.y} C ${side + 8} -32 ${side + 4} ${hemY - 3} ${side - 7} ${hemY + 3} Q 3 ${hemY + 7} -${side - 9} ${hemY + 3} C -${side} ${hemY - 4} -${side + 4} -34 ${rearShoulder.x - 8} ${rearShoulder.y} Z`
        : `M ${rearShoulder.x - 6} ${rearShoulder.y} Q ${chestShift} ${topY - 8} ${frontShoulder.x + 6} ${frontShoulder.y} L ${side + 4} -4 L ${side - 5} ${hemY + 1} L -${side - 10} ${hemY + 1} L -${side - 3} -3 Z`
      : outfitId === 'hoodie'
        ? `M ${rearShoulder.x - 7} ${rearShoulder.y} Q 0 ${topY - 9} ${frontShoulder.x + 7} ${frontShoulder.y} C ${side + 5} -35 ${side + 4} ${hemY - 3} ${side - 7} ${hemY + 3} Q 0 ${hemY + (compressed ? 8 : 4)} -${side - 7} ${hemY + 3} C -${side + 4} ${hemY - 4} -${side + 5} -35 ${rearShoulder.x - 7} ${rearShoulder.y} Z`
        : `M ${rearShoulder.x - 5} ${rearShoulder.y} Q 0 ${topY - 5} ${frontShoulder.x + 5} ${frontShoulder.y} L ${side - 4} -2 L ${side - 10} ${hemY + 1} L -${side - 8} ${hemY + 1} L -${side - 4} -2 Z`;
    const primitives: VectorPrimitive[] = [filledPath(d, 'outfit.primary')];
    if (outfitId === 'trail') {
      primitives.push(
        { kind: 'line', from: { x: 5 + detailShift, y: topY + 9 }, to: { x: 5 + detailShift, y: -22 }, stroke: 'outfit.highlight', strokeWidth: 3, lineCap: 'round' },
        { kind: 'ellipse', cx: 7 + detailShift, cy: -18, rx: 4, ry: 6, fill: 'outfit.accent' },
      );
    } else {
      primitives.push(
        {
          kind: 'path',
          d: `M -23 -13 Q 0 -2 23 -13 L 19 ${hemY - 6} Q 0 ${hemY + 2} -19 ${hemY - 6} Z`,
          fill: 'outfit.shadow',
          stroke: INK,
          strokeWidth: 3,
          lineJoin: 'round',
        },
        { kind: 'line', from: { x: -8, y: topY + 4 }, to: { x: -6, y: -28 }, stroke: 'outfit.accent', strokeWidth: 3, lineCap: 'round' },
        { kind: 'line', from: { x: 9, y: topY + 4 }, to: { x: 8, y: -28 }, stroke: 'outfit.accent', strokeWidth: 3, lineCap: 'round' },
      );
    }
    return piece(
      id,
      shapeKey,
      layer,
      'waist',
      { x: -53, y: -74, width: 106, height: 86 },
      primitives,
      ['authored-torso-garment', outfitId === 'hoodie' ? 'low-rounded-hem' : 'fitted-hem'],
    );
  }

  if (layer === 'bottoms') {
    const impact = frame.poses.body.includes('squash');
    const lunging =
      frame.poses.body.includes('lunge') ||
      frame.poses.body.includes('forward-flight');
    const width = impact ? 38 : 34;
    const d = lunging
      ? `M -${width} -3 Q 4 -10 ${width + 2} -2 L ${width} 20 L 9 19 L 2 8 L -8 19 L -${width - 3} 18 Z`
      : `M -${width} -3 Q 0 -9 ${width} -3 L ${width - 3} 20 L 7 19 L 0 8 L -7 19 L -${width - 3} 20 Z`;
    return piece(
      id,
      shapeKey,
      layer,
      'waist',
      { x: -42, y: -12, width: 84, height: 37 },
      [filledPath(d, 'outfit.bottoms')],
      ['waist-underlap-7px'],
    );
  }

  if (layer === 'topBack' && outfitId === 'hoodie') {
    return piece(
      id,
      shapeKey,
      layer,
      'neck',
      { x: -45, y: -29, width: 90, height: 49 },
      [
        filledPath(
          'M -37 12 C -43 -13 -20 -27 0 -25 C 22 -27 44 -11 37 13 C 25 2 13 -3 0 -2 C -14 -3 -27 2 -37 12 Z',
          'outfit.shadow',
        ),
        {
          kind: 'path',
          d: 'M -29 6 Q 0 -18 30 6',
          fill: 'none',
          stroke: 'outfit.lining',
          strokeWidth: 6,
          lineCap: 'round',
        },
      ],
      ['hood-behind-head'],
    );
  }

  if (layer === 'hoodOrHatFront' && outfitId === 'hoodie') {
    return piece(
      id,
      shapeKey,
      layer,
      'neck',
      { x: -29, y: -4, width: 58, height: 25 },
      [
        {
          kind: 'path',
          d: 'M -25 4 Q 0 16 25 4',
          fill: 'none',
          stroke: 'outfit.lining',
          strokeWidth: 7,
          lineCap: 'round',
        },
      ],
      ['front-collar'],
    );
  }

  throw new Error(`Unsupported outfit layer ${outfitId}/${layer}`);
}

function weaponVector(pose: string): Point {
  // Contact is intentionally shorter than the authored wind-up vectors. With
  // the forward grip anchor this keeps the whole rounded tip inside the 248px
  // weapon-safe edge instead of cropping the visual payoff of the strike.
  if (pose.includes('strike-front')) return { x: 55, y: -15 };
  if (pose.includes('run-trail-carry')) return { x: -54, y: 14 };
  if (pose.includes('low-front')) return { x: 57, y: 49 };
  if (pose.includes('high-transition')) return { x: 25, y: -75 };
  if (pose.includes('high-back')) return { x: -29, y: -72 };
  if (pose.includes('cocked-back')) return { x: -50, y: -57 };
  if (pose.includes('carry-back')) return { x: 60, y: 24 };
  // Neutral and aerial poses hold the blade outward so the equipped item is
  // readable at gameplay scale even though it still occupies weaponBack.
  return { x: 49, y: -58 };
}

export function createWeaponPiece(
  frame: FrameDefinition,
  layer: 'frontHand' | 'weaponBack' | 'weaponFront',
): VectorPieceDescriptor {
  const id = `weapon/wooden-sword/${frame.id}/${layer}`;
  const pose = frame.poses.weapon;
  const shapeKey = `weapon.wooden-sword.${layer}.${frame.id}.${pose}`;

  if (layer === 'frontHand') {
    return piece(
      id,
      shapeKey,
      layer,
      'handFront',
      { x: -12, y: -12, width: 24, height: 25 },
      [
        filledPath(
          'M -9 -5 C -7 -11 2 -12 8 -7 C 12 -3 10 8 4 11 C -4 13 -13 5 -9 -5 Z',
          'identity.fur',
          3,
        ),
        {
          kind: 'line',
          from: { x: -5, y: -4 },
          to: { x: 6, y: 6 },
          stroke: 'identity.shadow',
          strokeWidth: 3,
          lineCap: 'round',
        },
      ],
      ['grip-hand', 'weapon-override', pose],
    );
  }

  const vector = weaponVector(pose);
  const magnitude = length(vector);
  const unit = scale(vector, 1 / magnitude);
  const side = { x: -unit.y, y: unit.x };
  const bladeStart = scale(unit, 12);
  const bladeEnd = vector;
  const bladeWidth = 8;
  const p1 = add(bladeStart, scale(side, bladeWidth));
  const p2 = add(bladeEnd, scale(side, bladeWidth * 0.72));
  const p3 = add(bladeEnd, scale(side, -bladeWidth * 0.72));
  const p4 = add(bladeStart, scale(side, -bladeWidth));
  const handleEnd = scale(unit, -17);
  const guardA = scale(side, 15);
  const guardB = scale(side, -15);

  return piece(
    id,
    shapeKey,
    layer,
    'weaponGrip',
    { x: -88, y: -88, width: 176, height: 176 },
    [
      {
        kind: 'polygon',
        points: [p1, add(p2, scale(unit, 4)), add(p3, scale(unit, 4)), p4],
        fill: 'weapon.wood',
        stroke: INK,
        strokeWidth: 4,
        lineJoin: 'round',
      },
      {
        kind: 'line',
        from: scale(unit, 18),
        to: scale(unit, magnitude - 9),
        stroke: 'weapon.highlight',
        strokeWidth: 3,
        lineCap: 'round',
      },
      {
        kind: 'line',
        from: guardA,
        to: guardB,
        stroke: 'weapon.guard',
        strokeWidth: 9,
        lineCap: 'round',
      },
      {
        kind: 'line',
        from: { x: 0, y: 0 },
        to: handleEnd,
        stroke: 'weapon.grip',
        strokeWidth: 8,
        lineCap: 'round',
      },
    ],
    ['rigid-authored-weapon', 'pose-specific', pose],
  );
}
