// Playroom 3D product studio — product only.
// Image-derived materials, art-directed geometry, real fullscreen viewport.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let current = null;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const DEFAULT_PALETTE_REGIONS = {
  cream: [0.22, 0.06, 0.18, 0.2],
  rust: [0.25, 0.24, 0.18, 0.14],
  mustard: [0.34, 0.39, 0.16, 0.12],
  sage: [0.39, 0.58, 0.2, 0.16],
  slate: [0.68, 0.47, 0.13, 0.13],
  rose: [0.58, 0.73, 0.2, 0.11],
  wood: [0.86, 0.57, 0.1, 0.1],
};

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

async function imagePalette(url, fallback = {}, regions = DEFAULT_PALETTE_REGIONS) {
  const fallbackPalette = {
    cream: '#c2d5e8',
    rust: '#cb6859',
    mustard: '#6b9bc7',
    sage: '#89a1b2',
    slate: '#4c7078',
    rose: '#cb8378',
    wood: '#8fb3d5',
    ...fallback,
  };
  const sampleRegions = { ...DEFAULT_PALETTE_REGIONS, ...regions };
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    const image = texture.image;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const sample = (x, y, w, h, base) => {
      const sx = Math.floor(x * canvas.width);
      const sy = Math.floor(y * canvas.height);
      const sw = Math.max(4, Math.floor(w * canvas.width));
      const sh = Math.max(4, Math.floor(h * canvas.height));
      const data = ctx.getImageData(sx, sy, sw, sh).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const count = Math.max(1, data.length / 4);
      const avg = [r / count, g / count, b / count];
      const fb = hexToRgb(base);
      // Blend toward the sampled image colour; this keeps lighting consistent.
      return rgbToHex(avg[0] * 0.72 + fb[0] * 0.28, avg[1] * 0.72 + fb[1] * 0.28, avg[2] * 0.72 + fb[2] * 0.28);
    };

    const palette = {
      cream: sample(...sampleRegions.cream, fallbackPalette.cream),
      rust: sample(...sampleRegions.rust, fallbackPalette.rust),
      mustard: sample(...sampleRegions.mustard, fallbackPalette.mustard),
      sage: sample(...sampleRegions.sage, fallbackPalette.sage),
      slate: sample(...sampleRegions.slate, fallbackPalette.slate),
      rose: sample(...sampleRegions.rose, fallbackPalette.rose),
      wood: sample(...sampleRegions.wood, fallbackPalette.wood),
    };
    texture.dispose();
    return palette;
  } catch (error) {
    console.warn('[3D] image palette unavailable, using fallbacks', error);
    return fallbackPalette;
  }
}

function materialTexture(hex, wood = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const [r, g, b] = hexToRgb(hex);
  ctx.fillStyle = rgbToHex(r, g, b);
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1100; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const delta = (Math.random() - 0.5) * (wood ? 20 : 10);
    ctx.fillStyle = `rgba(${Math.max(0, r + delta)}, ${Math.max(0, g + delta)}, ${Math.max(0, b + delta)}, ${0.06 + Math.random() * 0.08})`;
    ctx.fillRect(x, y, wood ? 1.4 : 1, wood ? 8 : 3);
  }

  if (wood) {
    for (let i = 0; i < 22; i += 1) {
      const y = Math.random() * 256;
      ctx.strokeStyle = `rgba(${Math.max(0, r - 34)}, ${Math.max(0, g - 26)}, ${Math.max(0, b - 18)}, .09)`;
      ctx.lineWidth = 0.7 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 18) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 2.4);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

async function makeMaterials(config) {
  const palette = await imagePalette(config.poster, config.fallbackPalette, config.paletteRegions);
  const [wr, wg, wb] = hexToRgb(palette.wood);
  const [sr, sg, sb] = hexToRgb(palette.slate);
  palette.woodDark = rgbToHex(wr * 0.82, wg * 0.82, wb * 0.82);
  palette.dark = rgbToHex(sr * 0.45, sg * 0.45, sb * 0.45);
  const pbr = (hex, wood = false, clearcoat = 0.12) => new THREE.MeshPhysicalMaterial({
    map: materialTexture(hex, wood),
    roughness: wood ? 0.55 : 0.42,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: wood ? 0.65 : 0.28,
  });

  return {
    palette,
    cream: pbr(palette.cream, true),
    rust: pbr(palette.rust, false),
    mustard: pbr(palette.mustard, false),
    sage: pbr(palette.sage, false),
    slate: pbr(palette.slate, false),
    rose: pbr(palette.rose, false),
    wood: pbr(palette.wood, true, 0.08),
    woodDark: pbr(palette.woodDark, true, 0.08),
    dark: pbr(palette.dark, false, 0.18),
    floor: new THREE.MeshStandardMaterial({ color: 0xf0e5d7, roughness: 0.95, metalness: 0 }),
  };
}

function createArch(radius, thickness, depth, material, position, rotation = [0, 0, 0]) {
  const inner = radius - thickness;
  const shape = new THREE.Shape();
  shape.moveTo(radius, 0);
  shape.absarc(0, 0, radius, 0, Math.PI, false);
  shape.lineTo(-inner, 0);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 72,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: thickness * 0.16,
    bevelThickness: depth * 0.18,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRing(radius, thickness, depth, material, position, rotation = [Math.PI / 2, 0, 0]) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius - thickness, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 64,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: thickness * 0.18,
    bevelThickness: depth * 0.2,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBlock(width, height, depth, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 5, Math.min(width, height, depth) * 0.14),
    material,
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRainbowBlocks(mats) {
  const group = new THREE.Group();
  group.name = 'product';

  group.add(createArch(1.56, 0.2, 0.3, mats.cream, [-0.2, 0.24, -0.55]));
  group.add(createArch(1.30, 0.18, 0.28, mats.rust, [-0.2, 0.24, -0.40]));
  group.add(createArch(1.04, 0.17, 0.26, mats.mustard, [-0.2, 0.24, -0.25]));
  group.add(createArch(0.78, 0.16, 0.24, mats.cream, [-0.2, 0.24, -0.10]));

  group.add(createArch(0.92, 0.19, 0.28, mats.sage, [-0.05, 0.23, 0.64], [0, -0.12, 0]));
  group.add(createArch(0.62, 0.17, 0.25, mats.rust, [0.28, 0.23, 0.92], [0, 0.12, 0]));
  group.add(createArch(0.42, 0.14, 0.22, mats.slate, [1.25, 0.24, -0.22], [0, -0.2, 0]));

  group.add(createRing(0.5, 0.15, 0.22, mats.rose, [1.55, 0.22, 0.35]));
  group.add(createRing(0.4, 0.14, 0.2, mats.cream, [1.55, 0.40, 0.35]));
  group.add(createRing(0.3, 0.13, 0.18, mats.slate, [1.55, 0.55, 0.35]));
  group.add(roundedBlock(0.36, 0.36, 0.36, mats.slate, [1.55, 0.88, 0.35], [0, 0.2, 0]));
  group.add(roundedBlock(0.24, 0.2, 0.24, mats.wood, [1.55, 1.15, 0.35], [0, 0, 0]));

  group.add(createRing(0.31, 0.12, 0.2, mats.wood, [-1.55, 0.23, 0.58]));
  group.add(createRing(0.31, 0.12, 0.2, mats.cream, [-1.55, 0.43, 0.58]));
  group.add(createRing(0.24, 0.1, 0.18, mats.woodDark, [-1.25, 0.2, 0.82], [Math.PI / 2, 0, 0.35]));

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 40, 32), mats.wood);
  ball.position.set(2.18, 0.28, 0.45);
  ball.castShadow = true;
  ball.receiveShadow = true;
  group.add(ball);

  group.userData.focusBlock = group.children[1];
  return group;
}

function translucentMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({
    map: materialTexture(hex, false),
    roughness: 0.16,
    metalness: 0,
    transmission: 0.28,
    transparent: true,
    opacity: 0.94,
    thickness: 0.35,
    ior: 1.42,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
}

function triangularTile(width, height, material, position, rotation = [0, 0, 0]) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(0, height / 2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.035,
    bevelThickness: 0.03,
  });
  geometry.translate(0, 0, -0.08);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createMagneticTiles(mats) {
  const group = new THREE.Group();
  group.name = 'product';
  const colors = mats.palette;
  const red = translucentMaterial(colors.rust);
  const amber = translucentMaterial(colors.mustard);
  const lime = translucentMaterial(colors.sage);
  const blue = translucentMaterial(colors.slate);
  const violet = translucentMaterial(colors.rose);
  const cream = translucentMaterial(colors.cream);

  group.add(triangularTile(1.7, 1.35, red, [-1.35, 0.78, 0]));
  group.add(triangularTile(1.7, 1.35, amber, [-1.35, 0.78, 0.2]));
  group.add(roundedBlock(0.72, 0.72, 0.18, blue, [-1.35, 0.35, 0.42], [0, 0, Math.PI / 4]));

  group.add(triangularTile(1.9, 1.5, lime, [0.15, 0.85, -0.1]));
  group.add(triangularTile(1.25, 1.0, cream, [0.15, 1.15, 0.14]));
  group.add(roundedBlock(0.8, 0.8, 0.18, violet, [0.15, 0.36, 0.38], [0, 0, Math.PI / 4]));

  group.add(triangularTile(1.55, 1.2, blue, [1.55, 0.72, 0.05]));
  group.add(triangularTile(1.1, 0.86, red, [1.55, 0.96, 0.24]));
  group.add(roundedBlock(0.7, 0.7, 0.18, amber, [1.55, 0.34, 0.42], [0, 0, Math.PI / 4]));

  group.userData.focusBlock = group.children[3];
  return group;
}

function cylinder(radius, length, material, position, rotation = [Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWoodenBus(mats) {
  const group = new THREE.Group();
  group.name = 'product';

  group.add(roundedBlock(2.9, 0.9, 0.95, mats.sage, [0, 0.72, 0]));
  group.add(roundedBlock(2.65, 0.24, 0.9, mats.cream, [0, 1.28, 0]));
  group.add(roundedBlock(2.1, 0.42, 0.06, mats.dark, [-0.12, 1.0, 0.5]));
  group.add(roundedBlock(0.62, 0.42, 0.06, mats.dark, [1.05, 1.0, 0.5]));
  group.add(roundedBlock(0.06, 0.42, 0.72, mats.dark, [1.46, 1.0, 0]));

  [-1.0, 0.95].forEach((x) => {
    [-0.52, 0.52].forEach((z) => {
      group.add(cylinder(0.25, 0.16, mats.dark, [x, 0.3, z]));
      group.add(cylinder(0.1, 0.18, mats.cream, [x, 0.3, z]));
    });
  });

  group.add(roundedBlock(0.12, 0.18, 0.9, mats.woodDark, [1.5, 0.55, 0]));
  group.add(cylinder(0.09, 0.08, mats.mustard, [1.53, 0.78, 0.3], [Math.PI / 2, 0, 0]));
  group.add(cylinder(0.09, 0.08, mats.mustard, [1.53, 0.78, -0.3], [Math.PI / 2, 0, 0]));

  group.add(roundedBlock(0.42, 0.52, 0.42, mats.cream, [-1.75, 0.45, -0.45]));
  group.add(roundedBlock(0.42, 0.7, 0.42, mats.rust, [-1.75, 0.58, 0.1]));
  group.add(roundedBlock(0.42, 0.42, 0.42, mats.mustard, [-1.75, 0.38, 0.62]));

  group.userData.focusBlock = group.children[0];
  return group;
}

function createStackingRings(mats) {
  const group = new THREE.Group();
  group.name = 'product';

  group.add(cylinder(0.09, 1.45, mats.wood, [0, 0.78, 0], [0, 0, 0]));
  const rings = [
    [0.58, 0.14, mats.wood, 0.2],
    [0.5, 0.13, mats.sage, 0.43],
    [0.42, 0.12, mats.rose, 0.64],
    [0.34, 0.11, mats.mustard, 0.83],
    [0.26, 0.1, mats.slate, 1.0],
  ];
  rings.forEach(([r, t, m, y]) => group.add(createRing(r, t, 0.2, m, [0, y, 0])));

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), mats.wood);
  head.position.set(0, 1.38, 0);
  head.castShadow = true;
  group.add(head);
  [-0.18, 0.18].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), mats.woodDark);
    ear.position.set(x, 1.55, 0);
    ear.castShadow = true;
    group.add(ear);
  });
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), mats.cream);
  snout.position.set(0, 1.34, 0.24);
  group.add(snout);

  group.add(createRing(0.34, 0.12, 0.2, mats.wood, [-1.35, 0.22, 0.45]));
  group.add(createRing(0.27, 0.1, 0.18, mats.rust, [1.3, 0.2, 0.5], [Math.PI / 2, 0, 0.3]));
  group.add(roundedBlock(0.34, 0.34, 0.34, mats.sage, [1.45, 0.25, -0.4], [0, 0.2, 0]));

  group.userData.focusBlock = group.children[2];
  return group;
}

function createXylophone(mats) {
  const group = new THREE.Group();
  group.name = 'product';

  group.add(roundedBlock(3.5, 0.16, 0.28, mats.wood, [0, 0.22, 0.72]));
  group.add(roundedBlock(3.5, 0.16, 0.28, mats.wood, [0, 0.22, -0.72]));
  group.add(roundedBlock(3.7, 0.2, 0.3, mats.woodDark, [0, 0.1, 0]));

  const barMaterials = [mats.rust, mats.mustard, mats.sage, mats.slate, mats.rose, mats.rust, mats.mustard, mats.sage];
  const lengths = [1.65, 1.55, 1.45, 1.35, 1.28, 1.2, 1.12, 1.04];
  barMaterials.forEach((material, i) => {
    const x = -1.54 + i * 0.44;
    group.add(roundedBlock(0.34, 0.1, lengths[i], material, [x, 0.5, 0]));
    group.add(cylinder(0.035, 0.04, mats.dark, [x, 0.58, -0.42], [0, 0, 0]));
  });

  const mallet = (x, z, rotation) => {
    const g = new THREE.Group();
    g.add(cylinder(0.035, 0.9, mats.wood, [0, 0, 0], [0, 0, Math.PI / 2]));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), mats.rose);
    head.position.x = 0.48;
    head.castShadow = true;
    g.add(head);
    g.position.set(x, 0.16, z);
    g.rotation.y = rotation;
    return g;
  };
  group.add(mallet(-0.35, 1.1, 0.25));
  group.add(mallet(0.45, 1.25, -0.18));

  group.userData.focusBlock = group.children[4];
  return group;
}

function createProduct(mats, config) {
  switch (config.scene) {
    case 'magnetic-tiles': return createMagneticTiles(mats);
    case 'wooden-bus': return createWoodenBus(mats);
    case 'stacking-rings': return createStackingRings(mats);
    case 'xylophone': return createXylophone(mats);
    case 'wooden-blocks':
    default: return createRainbowBlocks(mats);
  }
}

function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  g.addColorStop(0, 'rgba(62,43,34,0.32)');
  g.addColorStop(1, 'rgba(62,43,34,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.8),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

function makeHotspots(stage, config) {
  const layer = stage.querySelector('.p3d-hotspots');
  if (!layer) return [];
  layer.innerHTML = config.hotspots.map((h) => `
    <button class="p3d-hotspot" type="button" data-hotspot="${h.id}" aria-label="${h.label}">
      <span class="p3d-hotspot-dot" aria-hidden="true"></span>
      <span class="p3d-hotspot-card"><b>${h.label}</b><small>${h.detail}</small></span>
    </button>`).join('');
  return [...layer.querySelectorAll('.p3d-hotspot')];
}

function projectHotspots(state) {
  const rect = state.stage.getBoundingClientRect();
  state.hotspots.forEach((el, i) => {
    const point = state.config.hotspots[i]?.point;
    if (!point) return;
    const v = new THREE.Vector3(...point).applyMatrix4(state.product.matrixWorld).project(state.camera);
    el.style.transform = `translate(${(v.x * 0.5 + 0.5) * rect.width}px, ${(-v.y * 0.5 + 0.5) * rect.height}px)`;
    el.style.opacity = v.z < 1 ? '1' : '0';
    el.style.pointerEvents = v.z < 1 ? 'auto' : 'none';
  });
}

function enterFullscreen(state) {
  if (state.viewport) return;
  const viewport = document.createElement('div');
  viewport.className = 'p3d-viewport';
  state.stageReturnParent = state.stage.parentNode;
  state.stageReturnSibling = state.stage.nextSibling;
  viewport.appendChild(state.stage);
  document.body.appendChild(viewport);
  document.body.classList.add('p3d-fullscreen');
  state.viewport = viewport;
}

function exitFullscreen(state) {
  if (!state.viewport) return;
  if (state.stageReturnParent && state.stageReturnParent.isConnected) {
    state.stageReturnParent.insertBefore(state.stage, state.stageReturnSibling || null);
  }
  state.viewport.remove();
  state.viewport = null;
  document.body.classList.remove('p3d-fullscreen');
}

export async function mountProduct3D(slug, config) {
  disposeProduct3D();
  const stage = document.getElementById('p3dStage');
  if (!stage || !config) return;

  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'p3d-canvas';
    stage.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, stage.clientWidth / Math.max(stage.clientHeight, 1), 0.1, 100);
    camera.position.set(3.35, 2.15, 4.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.1;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    const mats = await makeMaterials(config);
    const scene = new THREE.Scene();
    const product = createProduct(mats, config);
    scene.add(product);
    scene.add(createContactShadow());

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.HemisphereLight(0xfff4df, 0x7d6a55, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d0, 3.4);
    key.position.set(4, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xe8b96a, 1.2);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    if (config.modelUrl) {
      try {
        const gltf = await new GLTFLoader().loadAsync(config.modelUrl);
        gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        product.visible = false;
        scene.add(gltf.scene);
      } catch (error) {
        console.warn('[3D] GLB unavailable; using image-derived procedural model.', error);
      }
    }

    const state = {
      slug, stage, renderer, camera, controls, scene, product, config, pmrem,
      hotspots: makeHotspots(stage, config),
      viewport: null,
      stageReturnParent: null,
      stageReturnSibling: null,
      frame: 0,
    };
    current = state;

    const resize = () => {
      if (!current) return;
      const w = stage.clientWidth;
      const h = Math.max(stage.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    state.ro = ro;

    document.querySelector('[data-p3d-reset]')?.addEventListener('click', () => {
      camera.position.set(3.35, 2.15, 4.0);
      controls.target.set(0, 0.9, 0);
      controls.update();
    });
    document.querySelector('[data-p3d-rotate]')?.addEventListener('click', (event) => {
      controls.autoRotate = !controls.autoRotate;
      event.currentTarget.classList.toggle('active', controls.autoRotate);
      event.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
    });
    document.querySelector('[data-p3d-expand]')?.addEventListener('click', () => enterFullscreen(state));
    document.querySelector('[data-p3d-exit]')?.addEventListener('click', () => exitFullscreen(state));
    state.hotspots.forEach((el) => {
      el.addEventListener('click', () => {
        const h = config.hotspots.find((x) => x.id === el.dataset.hotspot);
        if (!h) return;
        state.hotspots.forEach((x) => x.classList.remove('is-open'));
        el.classList.add('is-open');
        controls.target.set(h.point[0] * 0.35, h.point[1] + 0.55, h.point[2] * 0.35);
      });
    });

    const clock = new THREE.Clock();
    const tick = () => {
      if (!current) return;
      controls.update();
      projectHotspots(state);
      renderer.render(scene, camera);
      state.frame = requestAnimationFrame(tick);
    };
    tick();
    stage.classList.add('is-ready');
    document.querySelector('[data-p3d-loading]')?.setAttribute('hidden', '');
  } catch (error) {
    console.error('[3D] viewer unavailable', error);
    stage.classList.add('is-fallback');
    document.querySelector('[data-p3d-loading]')?.setAttribute('hidden', '');
    const fallback = document.querySelector('[data-p3d-fallback]');
    fallback?.removeAttribute('hidden');
    const detail = fallback?.querySelector('p');
    if (detail) detail.textContent = String(error?.message || error || 'Explore the product photos or return to the product page.').slice(0, 180);
  }
}

export function disposeProduct3D() {
  if (!current) return;
  cancelAnimationFrame(current.frame);
  current.ro?.disconnect();
  current.controls?.dispose();
  exitFullscreen(current);
  current.scene?.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
    }
  });
  current.pmrem?.dispose?.();
  current.renderer?.dispose();
  current.renderer?.domElement?.remove();
  current.hotspots = [];
  current = null;
}

export function isProduct3DMounted(slug) {
  return Boolean(current && current.slug === slug);
}
