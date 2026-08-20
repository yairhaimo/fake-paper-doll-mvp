import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'art/source/character/v2');
const OUTPUT = join(ROOT, 'public/assets/character/v2');
const FILES = [
  'moss-trail-armed.png',
  'moss-trail-unarmed.png',
  'moss-hoodie-armed.png',
  'moss-hoodie-unarmed.png',
  'bramble-trail-armed.png',
  'bramble-trail-unarmed.png',
  'bramble-hoodie-armed.png',
  'bramble-hoodie-unarmed.png',
  'moss-trail-run-armed.png',
  'moss-trail-run-unarmed.png',
  'moss-hoodie-run-armed.png',
  'moss-hoodie-run-unarmed.png',
  'bramble-trail-run-armed.png',
  'bramble-trail-run-unarmed.png',
  'bramble-hoodie-run-armed.png',
  'bramble-hoodie-run-unarmed.png',
  'moss-trail-attack.png',
  'moss-hoodie-attack.png',
  'bramble-trail-attack.png',
  'bramble-hoodie-attack.png',
];

const GENERAL_GROUND_LINES = [384, 384, 384, 768, 702, 708];
const ATTACK_GROUND_LINES = [346, 346, 346, 671, 676, 678];
const PREPARED_SIZE = '1152x768';
const PACKED_SIZE = '1536x1024';
const EDGE_MATTE_COLOR = '#242b38';

function commandName() {
  for (const candidate of ['magick', 'convert']) {
    const result = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('ImageMagick is required (expected `magick` or `convert` on PATH).');
}

function hash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`ImageMagick command failed: ${command} ${args.join(' ')}`);
  }
  return result;
}

function foregroundComponents(command, prepared) {
  const result = run(command, [
    prepared,
    '-alpha', 'extract', '-threshold', '5%',
    '-define', 'connected-components:verbose=true',
    '-connected-components', '8', 'null:',
  ]);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const components = [];
  const pattern = /^\s*(\d+):\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+([\d.]+),([\d.]+)\s+(\d+)\s+gray\(255\)/gm;
  for (const match of output.matchAll(pattern)) {
    const [, id, width, height, x, y, centroidX, centroidY, area] = match;
    components.push({
      id: Number(id),
      width: Number(width),
      height: Number(height),
      x: Number(x),
      y: Number(y),
      centroidX: Number(centroidX),
      centroidY: Number(centroidY),
      area: Number(area),
    });
  }
  return components;
}

function connectedComponents(command, prepared) {
  const components = foregroundComponents(command, prepared).filter(
    ({ area }) => area >= 5_000,
  );
  components.sort((left, right) => {
    const leftRow = left.centroidY < 384 ? 0 : 1;
    const rightRow = right.centroidY < 384 ? 0 : 1;
    return leftRow - rightRow || left.centroidX - right.centroidX;
  });
  if (components.length !== 6) {
    throw new Error(`Expected six authored poses in ${prepared}; found ${components.length}.`);
  }
  return components;
}

/**
 * Removes chroma spill without trimming the antialiased silhouette.
 *
 * The generated source uses a magenta field. Making that field transparent is
 * not enough: straight-alpha texture filtering still samples its hidden RGB,
 * producing a neon seam on dark backgrounds. We therefore:
 *
 * 1. preserve the authored alpha channel byte-for-byte;
 * 2. detect magenta-dominant pixels only within a six-pixel inner edge band;
 * 3. replace their RGB with the shared dark outline ink; and
 * 4. give <=5% alpha pixels the same neutral matte RGB so texture filtering
 *    cannot pull chroma color back across the silhouette.
 */
function decontaminateChromaFringe(
  command,
  source,
  destination,
  work,
  filename,
  canvasSize,
) {
  const alpha = join(work, `matte-alpha-${filename}`);
  const solid = join(work, `matte-solid-${filename}`);
  const eroded = join(work, `matte-eroded-${filename}`);
  const edge = join(work, `matte-edge-${filename}`);
  const chroma = join(work, `matte-chroma-${filename}`);
  const fringe = join(work, `matte-fringe-${filename}`);
  const transparent = join(work, `matte-transparent-${filename}`);
  const mask = join(work, `matte-mask-${filename}`);
  const rgb = join(work, `matte-rgb-${filename}`);
  const ink = join(work, `matte-ink-${filename}`);
  const cleanRgb = join(work, `matte-clean-rgb-${filename}`);

  run(command, [source, '-alpha', 'extract', alpha]);
  run(command, [alpha, '-threshold', '2%', solid]);
  run(command, [solid, '-morphology', 'Erode', 'Disk:6', eroded]);
  run(command, [solid, eroded, '-fx', 'u-v', edge]);
  run(command, [
    source,
    '-fx',
    'r>g*1.08 && b>g*1.08 && ((r+b)/2-g)>0.04 && (r+b)>0.18 ? 1 : 0',
    '-alpha', 'off',
    chroma,
  ]);
  run(command, [
    edge, chroma,
    '-compose', 'Multiply', '-composite', '-threshold', '1%',
    fringe,
  ]);
  run(command, [alpha, '-threshold', '5%', '-negate', transparent]);
  run(command, [fringe, transparent, '-compose', 'Lighten', '-composite', mask]);
  run(command, [source, '-alpha', 'off', rgb]);
  run(command, ['-size', canvasSize, `xc:${EDGE_MATTE_COLOR}`, ink]);
  run(command, [rgb, ink, mask, '-compose', 'Src', '-composite', cleanRgb]);
  run(command, [
    cleanRgb, alpha,
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-strip', destination,
  ]);
}

function buildOne(command, filename, destination, work) {
  const source = join(SOURCE, filename);
  if (!existsSync(source)) throw new Error(`Missing authored source sheet: ${source}`);
  const prepared = join(work, `prepared-${filename}`);
  run(command, [
    source,
    '-alpha', 'on',
    '-fuzz', '30%', '-transparent', '#F000F0',
    '-fuzz', '22%', '-transparent', '#FF80FF',
    '-filter', 'Lanczos', '-resize', PREPARED_SIZE,
    '-strip', prepared,
  ]);

  const components = connectedComponents(command, prepared);
  const groundLines = filename.endsWith('-attack.png')
    ? ATTACK_GROUND_LINES
    : filename.includes('-run-')
      ? components.map(({ y, height }) => y + height)
      : GENERAL_GROUND_LINES;
  const poseScale = filename.includes('-run-') ? 1.2 : 1;
  const compositeArgs = ['-size', '1536x1024', 'xc:none'];

  components.forEach((component, index) => {
    const mask = join(work, `mask-${index}-${filename}`);
    const pose = join(work, `pose-${index}-${filename}`);
    run(command, [
      prepared,
      '-alpha', 'extract', '-threshold', '5%',
      '-define', `connected-components:keep=${component.id}`,
      '-connected-components', '8', '-auto-level', mask,
    ]);
    const isolateArgs = [
      prepared, mask,
      '-alpha', 'on', '-compose', 'DstIn', '-composite',
      '-crop', `${component.width}x${component.height}+${component.x}+${component.y}`,
      '+repage',
    ];
    if (poseScale !== 1) {
      isolateArgs.push('-filter', 'Lanczos', '-resize', `${poseScale * 100}%`);
    }
    isolateArgs.push(pose);
    run(command, isolateArgs);

    const column = index % 3;
    const row = Math.floor(index / 3);
    const oldCellCenterX = column * 384 + 192;
    const newCellCenterX = column * 512 + 256;
    const scaledWidth = Math.round(component.width * poseScale);
    const scaledHeight = Math.round(component.height * poseScale);
    const sourceCenterOffset = component.x + component.width / 2 - oldCellCenterX;
    const x = Math.round(
      newCellCenterX + sourceCenterOffset * poseScale - scaledWidth / 2,
    );
    const y = Math.round(
      component.y * poseScale + (row + 1) * 512 - groundLines[index] * poseScale,
    );
    if (scaledWidth > 512 || scaledHeight > 512) {
      throw new Error(`Scaled pose does not fit a runtime cell: ${filename} cell ${index}`);
    }
    compositeArgs.push(pose, '-geometry', `+${x}+${y}`, '-composite');
  });

  compositeArgs.push('-strip', destination);
  run(command, compositeArgs);

  // Chroma-key antialiasing can leave a handful of detached 1–12px flecks.
  // They are never authored pieces: every real pose is one >5kpx component.
  // Clear their exact bounds after packing so neighboring cells stay pristine.
  const flecks = foregroundComponents(command, destination).filter(
    ({ area }) => area < 5_000,
  );
  if (flecks.length > 0) {
    const cleanupArgs = [destination];
    for (const { x, y, width, height } of flecks) {
      cleanupArgs.push(
        '-region', `${width}x${height}+${x}+${y}`,
        '-alpha', 'transparent', '+region',
      );
    }
    cleanupArgs.push('-strip', destination);
    run(command, cleanupArgs);
  }

  // Packing and component isolation establish the final silhouette, so matte
  // the finished atlas rather than an intermediate that may expose new edges.
  const decontaminated = join(work, `decontaminated-${filename}`);
  decontaminateChromaFringe(
    command,
    destination,
    decontaminated,
    work,
    filename,
    PACKED_SIZE,
  );
  run(command, [decontaminated, '-strip', destination]);
}

const check = process.argv.includes('--check');
const command = commandName();
const work = mkdtempSync(join(tmpdir(), 'paper-doll-assets-work-'));
const temporaryOutput = check ? mkdtempSync(join(tmpdir(), 'paper-doll-assets-check-')) : null;
const destinationRoot = temporaryOutput ?? OUTPUT;

try {
  for (const filename of FILES) {
    const destination = join(destinationRoot, filename);
    buildOne(command, filename, destination, work);
    if (!check) {
      console.log(`built ${basename(destination)} ${hash(destination).slice(0, 12)}`);
      continue;
    }
    const committed = join(OUTPUT, filename);
    if (!existsSync(committed) || hash(committed) !== hash(destination)) {
      throw new Error(`Generated asset is stale: ${filename}. Run npm run assets:build.`);
    }
  }
  if (check) console.log(`character asset check passed (${FILES.length} sheets)`);
} finally {
  rmSync(work, { recursive: true, force: true });
  if (temporaryOutput) rmSync(temporaryOutput, { recursive: true, force: true });
}
