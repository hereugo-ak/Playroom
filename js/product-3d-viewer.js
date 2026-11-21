// Playroom 3D product studio — product only.
// Image-derived materials, art-directed geometry, real fullscreen viewport.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let current = null;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

async function imagePalette(url, fallback) {
  const fallbackPalette = {
    cream: '#e9d9b8',
    rust: '#c8735c',
    mustard: '#d8ad52',
    sage: '#a5b487',
    slate: '#4c7078',
    rose: '#c9827a',
    wood: '#d8b985',
    ...fallback,
  };
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
      cream: sample(0.22, 0.06, 0.18, 0.2, fallbackPalette.cream),
      rust: sample(0.25, 0.24, 0.18, 0.14, fallbackPalette.rust),
      mustard: sample(0.34, 0.39, 0.16, 0.12, fallbackPalette.mustard),
      sage: sample(0.39, 0.58, 0.2, 0.16, fallbackPalette.sage),
      slate: sample(0.68, 0.47, 0.13, 0.13, fallbackPalette.slate),
      rose: sample(0.58, 0.73, 0.2, 0.11, fallbackPalette.rose),
      wood: sample(0.86, 0.57, 0.1, 0.1, fallbackPalette.wood),
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
  const palette = await imagePalette(config.poster);
  const [wr, wg, wb] = hexToRgb(palette.wood);
  palette.woodDark = rgbToHex(wr * 0.82, wg * 0.82, wb * 0.82);
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

function createProduct(mats) {
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

function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  g.addColorStop(0, 'rgba(63,43,33,0.32)');
  g.addColorStop(1, 'rgba(63,43,33,0)');
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
    const product = createProduct(mats);
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
    document.querySelector('[data-p3d-fallback]')?.removeAttribute('hidden');
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
