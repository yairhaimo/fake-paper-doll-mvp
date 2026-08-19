import { CANONICAL_BODY } from './canonicalBody';
import {
  ANIMATION_IDS,
  type AnimationId,
  type AnimationPieceTable,
  type CharacterCatalog,
  type EquipmentDefinition,
  type IdentityDefinition,
  type LayerPieceMap,
  type PaletteDefinition,
  type SemanticLayer,
  type VectorPieceDescriptor,
} from './types';
import {
  createIdentityPiece,
  createOutfitPiece,
  createSharedGroundShadow,
  createWeaponPiece,
} from './vectorAssets';

export const SHARED_PALETTE: PaletteDefinition = Object.freeze({
  'shared.ink': '#2D2840',
  'shared.eyeGlint': '#FFF6E4',
  'shared.groundShadow': '#221D38',
});

const IDENTITY_CONFIG = Object.freeze({
  moss: Object.freeze({
    displayName: 'Moss',
    palette: Object.freeze({
      'identity.fur': '#6BC5BE',
      'identity.shadow': '#3D9698',
      'identity.highlight': '#A9E8DA',
      'identity.muzzle': '#D9F8EA',
      'identity.iris': '#7659BE',
      'identity.detail': '#397F82',
      'identity.horn': '#D9F8EA',
      'identity.hornShadow': '#76B5AB',
    }),
  }),
  bramble: Object.freeze({
    displayName: 'Bramble',
    palette: Object.freeze({
      'identity.fur': '#9C6AA6',
      'identity.shadow': '#704A7D',
      'identity.highlight': '#D8A8CF',
      'identity.muzzle': '#F7E5C7',
      'identity.iris': '#D59B3D',
      'identity.detail': '#684264',
      'identity.horn': '#F2D39A',
      'identity.hornShadow': '#C69E68',
    }),
  }),
} as const);

const OUTFIT_CONFIG = Object.freeze({
  trail: Object.freeze({
    displayName: 'Trail Set',
    palette: Object.freeze({
      'outfit.primary': '#F2C14F',
      'outfit.shadow': '#CF9139',
      'outfit.highlight': '#FFE287',
      'outfit.accent': '#8D593D',
      'outfit.bottoms': '#4E5A88',
      'outfit.shoe': '#A45F49',
      'outfit.shoeShadow': '#824A45',
      'outfit.sole': '#633E48',
      'outfit.lining': '#FFE287',
    }),
  }),
  hoodie: Object.freeze({
    displayName: 'Cloud Hoodie',
    palette: Object.freeze({
      'outfit.primary': '#7160CF',
      'outfit.shadow': '#5043A1',
      'outfit.highlight': '#9D8DE9',
      'outfit.accent': '#74C9BA',
      'outfit.bottoms': '#347F78',
      'outfit.shoe': '#E9776B',
      'outfit.shoeShadow': '#A84F5D',
      'outfit.sole': '#643D59',
      'outfit.lining': '#F0C4DE',
    }),
  }),
} as const);

const WEAPON_PALETTE: PaletteDefinition = Object.freeze({
  'weapon.wood': '#C98549',
  'weapon.shadow': '#8E523B',
  'weapon.highlight': '#E8B36B',
  'weapon.guard': '#F2D06B',
  'weapon.grip': '#6BBEB3',
});

const IDENTITY_LAYERS = Object.freeze([
  'groundShadow',
  'tailBack',
  'earBack',
  'tuftBack',
  'rearFoot',
  'rearLeg',
  'rearArm',
  'rearHand',
  'body',
  'head',
  'face',
  'frontLeg',
  'frontFoot',
  'frontArm',
  'frontHand',
  'tuftFront',
] as const satisfies readonly SemanticLayer[]);

const TRAIL_LAYERS = Object.freeze([
  'rearFoot',
  'rearArm',
  'bottoms',
  'frontFoot',
  'top',
  'frontArm',
] as const satisfies readonly SemanticLayer[]);

const HOODIE_LAYERS = Object.freeze([
  'rearFoot',
  'rearArm',
  'topBack',
  'bottoms',
  'frontFoot',
  'top',
  'frontArm',
  'hoodOrHatFront',
] as const satisfies readonly SemanticLayer[]);

function emptyPieceTable(): Record<AnimationId, LayerPieceMap[]> {
  return {
    idle: [],
    run: [],
    jump: [],
    fall: [],
    land: [],
    attack: [],
  };
}

function freezePieceTable(
  table: Record<AnimationId, LayerPieceMap[]>,
): AnimationPieceTable {
  for (const animationId of ANIMATION_IDS) {
    Object.freeze(table[animationId]);
  }
  return Object.freeze(table);
}

function addAsset(
  assets: Map<string, VectorPieceDescriptor>,
  descriptor: VectorPieceDescriptor,
): string {
  if (assets.has(descriptor.id)) {
    throw new Error(`Duplicate vector asset ID: ${descriptor.id}`);
  }
  assets.set(descriptor.id, descriptor);
  return descriptor.id;
}

function buildIdentity(
  identityId: keyof typeof IDENTITY_CONFIG,
  assets: Map<string, VectorPieceDescriptor>,
): IdentityDefinition {
  const table = emptyPieceTable();

  for (const animationId of ANIMATION_IDS) {
    for (const frame of CANONICAL_BODY.animations[animationId].frames) {
      const framePieces: Partial<Record<SemanticLayer, string>> = {
        groundShadow: 'shared/ground-shadow',
      };

      for (const layer of IDENTITY_LAYERS) {
        if (layer === 'groundShadow') continue;
        framePieces[layer] = addAsset(
          assets,
          createIdentityPiece(identityId, frame, layer),
        );
      }

      table[animationId].push(Object.freeze(framePieces));
    }
  }

  const config = IDENTITY_CONFIG[identityId];
  return Object.freeze({
    id: identityId,
    displayName: config.displayName,
    slot: 'identity',
    palette: config.palette,
    supportedLayers: IDENTITY_LAYERS,
    animationCoverage: ANIMATION_IDS,
    pieces: freezePieceTable(table),
  });
}

function buildOutfit(
  outfitId: keyof typeof OUTFIT_CONFIG,
  assets: Map<string, VectorPieceDescriptor>,
): EquipmentDefinition {
  const table = emptyPieceTable();
  const supportedLayers = outfitId === 'trail' ? TRAIL_LAYERS : HOODIE_LAYERS;

  for (const animationId of ANIMATION_IDS) {
    for (const frame of CANONICAL_BODY.animations[animationId].frames) {
      const framePieces: Partial<Record<SemanticLayer, string>> = {};
      for (const layer of supportedLayers) {
        framePieces[layer] = addAsset(
          assets,
          createOutfitPiece(outfitId, frame, layer),
        );
      }
      table[animationId].push(Object.freeze(framePieces));
    }
  }

  const config = OUTFIT_CONFIG[outfitId];
  return Object.freeze({
    id: outfitId,
    displayName: config.displayName,
    slot: 'outfit',
    palette: config.palette,
    supportedLayers,
    animationCoverage: ANIMATION_IDS,
    hideLayers: Object.freeze(['body'] as SemanticLayer[]),
    replaceLayers: Object.freeze([
      'rearArm',
      'frontArm',
      'rearFoot',
      'frontFoot',
    ] as SemanticLayer[]),
    pieces: freezePieceTable(table),
  });
}

function weaponLayerForFrame(
  animationId: AnimationId,
  frameIndex: number,
): 'weaponBack' | 'weaponFront' {
  if (animationId === 'attack' && frameIndex >= 2 && frameIndex <= 4) {
    return 'weaponFront';
  }
  // run_3 is the single-support gold pose: its trailing hand and blade pass
  // behind the body, while the later recovery frames bring the item forward.
  if (animationId === 'run' && frameIndex >= 4) {
    return 'weaponFront';
  }
  return 'weaponBack';
}

function buildWeapon(
  assets: Map<string, VectorPieceDescriptor>,
): EquipmentDefinition {
  const table = emptyPieceTable();

  for (const animationId of ANIMATION_IDS) {
    const frames = CANONICAL_BODY.animations[animationId].frames;
    frames.forEach((frame, frameIndex) => {
      const weaponLayer = weaponLayerForFrame(animationId, frameIndex);
      const hand = createWeaponPiece(frame, 'frontHand');
      const weapon = createWeaponPiece(frame, weaponLayer);
      table[animationId].push(
        Object.freeze({
          frontHand: addAsset(assets, hand),
          [weaponLayer]: addAsset(assets, weapon),
        }),
      );
    });
  }

  return Object.freeze({
    id: 'wooden-sword',
    displayName: 'Wooden Practice Sword',
    slot: 'weapon',
    palette: WEAPON_PALETTE,
    supportedLayers: Object.freeze([
      'frontHand',
      'weaponBack',
      'weaponFront',
    ] as SemanticLayer[]),
    animationCoverage: ANIMATION_IDS,
    hideLayers: Object.freeze([]),
    replaceLayers: Object.freeze(['frontHand'] as SemanticLayer[]),
    pieces: freezePieceTable(table),
  });
}

export function createCharacterCatalog(): CharacterCatalog {
  const assets = new Map<string, VectorPieceDescriptor>();
  addAsset(assets, createSharedGroundShadow());

  const identities = new Map<string, IdentityDefinition>();
  identities.set('moss', buildIdentity('moss', assets));
  identities.set('bramble', buildIdentity('bramble', assets));

  const outfits = new Map<string, EquipmentDefinition>();
  outfits.set('trail', buildOutfit('trail', assets));
  outfits.set('hoodie', buildOutfit('hoodie', assets));

  const weapons = new Map<string, EquipmentDefinition>();
  weapons.set('wooden-sword', buildWeapon(assets));

  return Object.freeze({ assets, identities, outfits, weapons });
}

export const DEFAULT_CHARACTER_CATALOG = createCharacterCatalog();
export const VECTOR_ASSET_REGISTRY = DEFAULT_CHARACTER_CATALOG.assets;
export const IDENTITY_REGISTRY = DEFAULT_CHARACTER_CATALOG.identities;
export const OUTFIT_REGISTRY = DEFAULT_CHARACTER_CATALOG.outfits;
export const WEAPON_REGISTRY = DEFAULT_CHARACTER_CATALOG.weapons;

export const DEFAULT_APPEARANCE = Object.freeze({
  identityId: 'moss',
  outfitId: 'trail',
  weaponId: 'wooden-sword',
});
