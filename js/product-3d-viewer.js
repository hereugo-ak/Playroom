// Playroom 3D product studio.
// Lazy-loaded Three.js viewer with a reusable realistic-proportioned human rig.
// Products can use a procedural art-directed scene now or an external GLB later.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let current = null;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9b985';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 70; i += 1) {
    const x = Math.random() * canvas.width;
    ctx.strokeStyle = `rgba(112, 74, 42, ${0.03 + Math.random() * 0.07})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= canvas.height; y += 22) {
      ctx.lineTo(x + Math.sin(y * 0.02 + i) * (2 + (i % 4)), y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeMaterials() {
  const grain = woodTexture();
  return {
    grain,
    wood: new THREE.MeshPhysicalMaterial({
      map: grain,
      color: 0xe7c99c,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.65,
    }),
    woodDark: new THREE.MeshPhysicalMaterial({
      map: grain,
      color: 0xc99c68,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.08,
    }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc98f72, roughness: 0.72, metalness: 0 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x536c55, roughness: 0.88 }),
    trouser: new THREE.MeshStandardMaterial({ color: 0x4c4038, roughness: 0.92 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xf0e5d7, roughness: 0.95, metalness: 0 }),
  };
}

function roundedBlock(width, height, depth, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 4, Math.min(width, height, depth) * 0.12),
    material,
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createBlocks(product, mats) {
  const group = new THREE.Group();
  group.name = 'product';

  // A small, credible architectural stack — not a random cube pile.
  group.add(roundedBlock(1.65, 0.24, 0.5, mats.wood, [0, 0.16, 0.2], [0, 0.08, 0]));
  group.add(roundedBlock(1.35, 0.24, 0.5, mats.woodDark, [0.05, 0.42, -0.05], [0, -0.16, 0]));
  group.add(roundedBlock(0.42, 0.86, 0.42, mats.wood, [-0.55, 0.82, 0.05], [0, 0, 0.02]));
  group.add(roundedBlock(0.42, 0.86, 0.42, mats.wood, [0.55, 0.82, 0.05], [0, 0, -0.02]));
  group.add(roundedBlock(1.34, 0.24, 0.42, mats.wood, [0, 1.34, 0], [0, 0.06, 0]));
  group.add(roundedBlock(0.3, 0.62, 0.3, mats.woodDark, [-0.36, 1.62, 0.02], [0, 0, 0.06]));
  group.add(roundedBlock(0.3, 0.62, 0.3, mats.woodDark, [0.36, 1.62, 0.02], [0, 0, -0.06]));
  group.add(roundedBlock(0.92, 0.2, 0.34, mats.wood, [0, 1.86, 0], [0, 0, 0]));
  group.add(roundedBlock(0.5, 0.28, 0.5, mats.woodDark, [-1.05, 0.35, 0.65], [0, 0.3, 0]));
  group.add(roundedBlock(0.5, 0.28, 0.5, mats.wood, [1.02, 0.34, 0.6], [0, -0.3, 0]));

  // A loose piece on the floor gives the scene a lived-in, playable feeling.
  group.add(roundedBlock(0.78, 0.18, 0.26, mats.woodDark, [1.15, 0.14, -0.65], [0, 0.55, 0]));
  group.add(roundedBlock(0.36, 0.36, 0.36, mats.wood, [-1.18, 0.24, -0.55], [0, 0, 0.12]));

  group.userData.focusBlock = group.children[4];
  return group;
}

// Reusable human rig: realistic proportions, no mascot styling. It can be
// reused for other products by adding a product config entry.
function createChildFigure(mats) {
  const figure = new THREE.Group();
  figure.name = 'child-figure';

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), mats.skin);
  head.scale.set(0.92, 1.05, 0.9);
  head.position.set(0, 1.72, 0);
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.trouser);
  hair.position.set(0, 1.76, 0);
  hair.scale.set(0.94, 1, 0.92);
  hair.castShadow = true;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.52, 8, 20), mats.sleeve);
  torso.position.set(0, 1.1, 0);
  torso.scale.set(1, 1, 0.72);
  torso.castShadow = true;

  const makeArm = (side) => {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 14), mats.sleeve);
    upper.position.set(side * 0.33, 1.18, 0.05);
    upper.rotation.z = side * -0.28;
    upper.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), mats.skin);
    hand.scale.set(0.85, 1.05, 0.65);
    hand.position.set(side * 0.52, 0.82, 0.18);
    hand.castShadow = true;
    arm.add(upper, hand);
    arm.userData.hand = hand;
    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 6, 14), mats.trouser);
  legL.position.set(-0.17, 0.42, 0.03);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.17;

  figure.add(head, hair, torso, leftArm, rightArm, legL, legR);
  figure.userData.rightHand = rightArm.userData.hand;
  figure.userData.rightArm = rightArm;
  figure.scale.setScalar(0.82);
  figure.position.set(-1.55, 0, 1.15);
  figure.rotation.y = 0.55;
  return figure;
}

function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  g.addColorStop(0, 'rgba(63,43,33,0.28)');
  g.addColorStop(1, 'rgba(63,43,33,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

function buildScene(config, mats) {
  const scene = new THREE.Scene();
  const product = createBlocks(config, mats);
  scene.add(product);
  scene.add(createContactShadow());

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const figure = createChildFigure(mats);
  figure.visible = false;
  scene.add(figure);

  return { scene, product, figure };
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
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    const visible = v.z < 1 && state.mode !== 'play';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.opacity = visible ? '1' : '0';
    el.style.pointerEvents = visible ? 'auto' : 'none';
  });
}

function setMode(state, mode) {
  state.mode = mode;
  state.figure.visible = mode !== 'product';
  state.figure.scale.setScalar(mode === 'scale' ? 0.82 : 0.72);
  state.figure.position.set(mode === 'scale' ? -1.55 : -1.9, 0, 1.05);
  state.playT = 0;
  document.querySelectorAll('[data-p3d-mode]').forEach((b) => {
    const on = b.dataset.p3dMode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const caption = document.querySelector('[data-p3d-caption]');
  if (caption) {
    caption.textContent = mode === 'product'
      ? 'Drag to turn the piece. Open a marker for the small details.'
      : mode === 'play'
        ? 'Watch the blocks move through a child’s hands. Drag to explore while it plays.'
        : 'A child-scale reference sits beside the build.';
  }
}

function animateFigure(state, elapsed) {
  if (state.mode !== 'play') return;
  const cycle = (elapsed * 0.16) % 1;
  const t = easeInOut(clamp01(cycle * 1.5));
  const hand = state.figure.userData.rightHand;
  if (!hand) return;
  const start = new THREE.Vector3(0.55, 0.86, 0.25);
  const pick = new THREE.Vector3(0.12, 1.52, 0.2);
  const drop = new THREE.Vector3(-0.1, 2.08, 0.1);
  hand.position.lerpVectors(start, pick, Math.min(1, t * 1.4));
  if (t > 0.55) hand.position.lerpVectors(pick, drop, (t - 0.55) / 0.45);
  hand.rotation.z = -0.2 + Math.sin(elapsed * 1.2) * 0.12;
}

export async function mountProduct3D(slug, config) {
  disposeProduct3D();

  const stage = document.getElementById('p3dStage');
  if (!stage || !config) return;

  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'p3d-canvas';
    stage.prepend(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, stage.clientWidth / Math.max(stage.clientHeight, 1), 0.1, 100);
    camera.position.set(3.6, 2.35, 4.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.4;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.95, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;

    const mats = makeMaterials();
    const { scene, product, figure } = buildScene(config, mats);

    scene.add(new THREE.HemisphereLight(0xfff4df, 0x7d6a55, 1.45));
    const key = new THREE.DirectionalLight(0xfff0d0, 3.2);
    key.position.set(4, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -3;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xe8b96a, 1.15);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    // Optional GLB path for future products. Config-driven and reusable.
    if (config.modelUrl) {
      try {
        const gltf = await new GLTFLoader().loadAsync(config.modelUrl);
        const model = gltf.scene;
        model.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        model.scale.setScalar(1);
        product.visible = false;
        scene.add(model);
      } catch (error) {
        console.warn('[3D] GLB could not be loaded; using procedural scene.', error);
      }
    }

    const state = {
      slug,
      stage,
      renderer,
      camera,
      controls,
      scene,
      product,
      figure,
      config,
      hotspots: makeHotspots(stage, config),
      mode: 'product',
      playT: 0,
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

    document.querySelectorAll('[data-p3d-mode]').forEach((button) => {
      button.addEventListener('click', () => setMode(state, button.dataset.p3dMode));
    });
    document.querySelector('[data-p3d-reset]')?.addEventListener('click', () => {
      camera.position.set(3.6, 2.35, 4.2);
      controls.target.set(0, 0.95, 0);
      controls.update();
    });
    document.querySelector('[data-p3d-rotate]')?.addEventListener('click', (event) => {
      controls.autoRotate = !controls.autoRotate;
      event.currentTarget.classList.toggle('active', controls.autoRotate);
      event.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
    });
    state.hotspots.forEach((el) => {
      el.addEventListener('click', () => {
        const h = state.config.hotspots.find((x) => x.id === el.dataset.hotspot);
        if (!h) return;
        state.hotspots.forEach((x) => x.classList.remove('is-open'));
        el.classList.add('is-open');
        controls.target.set(h.point[0] * 0.35, h.point[1] + 0.6, h.point[2] * 0.35);
      });
    });

    setMode(state, 'product');
    const clock = new THREE.Clock();
    const tick = () => {
      if (!current) return;
      const elapsed = clock.getElapsedTime();
      controls.update();
      animateFigure(state, elapsed);
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
  current.scene?.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        m.map?.dispose?.();
        m.dispose?.();
      });
    }
  });
  current.renderer?.dispose();
  current.renderer?.domElement?.remove();
  current.hotspots = [];
  current = null;
}

export function isProduct3DMounted(slug) {
  return Boolean(current && current.slug === slug);
}
