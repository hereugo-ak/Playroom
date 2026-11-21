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
    cream: new THREE.MeshPhysicalMaterial({ color: 0xe8d6b7, roughness: 0.55, clearcoat: 0.08 }),
    rose: new THREE.MeshPhysicalMaterial({ color: 0xb96862, roughness: 0.5, clearcoat: 0.1 }),
    rust: new THREE.MeshPhysicalMaterial({ color: 0xc97954, roughness: 0.5, clearcoat: 0.1 }),
    mustard: new THREE.MeshPhysicalMaterial({ color: 0xd5a94c, roughness: 0.52, clearcoat: 0.1 }),
    sage: new THREE.MeshPhysicalMaterial({ color: 0x9aab77, roughness: 0.5, clearcoat: 0.1 }),
    slate: new THREE.MeshPhysicalMaterial({ color: 0x42636b, roughness: 0.48, clearcoat: 0.12 }),
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

  const arch = (radius, tube, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 18, 72, Math.PI), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const ring = (radius, tube, material, position, rotation = [Math.PI / 2, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 18, 64), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // The photographed set: nested rainbow arches, two foreground arches,
  // stacking rings, small blocks and a wooden ball.
  group.add(arch(1.56, 0.16, mats.cream, [-0.2, 0.26, -0.52]));
  group.add(arch(1.30, 0.13, mats.rust, [-0.2, 0.26, -0.40]));
  group.add(arch(1.04, 0.12, mats.mustard, [-0.2, 0.26, -0.28]));
  group.add(arch(0.78, 0.11, mats.cream, [-0.2, 0.26, -0.16]));

  group.add(arch(0.92, 0.16, mats.sage, [-0.05, 0.24, 0.62], [0, -0.12, 0]));
  group.add(arch(0.62, 0.14, mats.rust, [0.28, 0.24, 0.90], [0, 0.12, 0]));
  group.add(arch(0.42, 0.12, mats.slate, [1.25, 0.26, -0.22], [0, -0.2, 0]));

  group.add(ring(0.48, 0.11, mats.rose, [1.55, 0.23, 0.35]));
  group.add(ring(0.38, 0.10, mats.cream, [1.55, 0.40, 0.35]));
  group.add(ring(0.28, 0.10, mats.slate, [1.55, 0.55, 0.35]));
  group.add(roundedBlock(0.38, 0.38, 0.38, mats.slate, [1.55, 0.92, 0.35], [0, 0.2, 0]));
  group.add(roundedBlock(0.26, 0.22, 0.26, mats.wood, [1.55, 1.22, 0.35], [0, 0, 0]));

  group.add(ring(0.30, 0.11, mats.wood, [-1.55, 0.24, 0.58]));
  group.add(ring(0.30, 0.11, mats.cream, [-1.55, 0.44, 0.58]));
  group.add(ring(0.24, 0.09, mats.woodDark, [-1.25, 0.20, 0.82], [Math.PI / 2, 0, 0.35]));

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 24), mats.wood);
  ball.position.set(2.18, 0.28, 0.45);
  ball.castShadow = true;
  ball.receiveShadow = true;
  group.add(ball);

  group.userData.focusBlock = group.children[1];
  return group;
}

// Reusable human rig: realistic proportions and hand anatomy without an
// uncanny face. It can be reused for other products by adding a config entry.
function createHand(mats, side = 1) {
  const hand = new THREE.Group();

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), mats.skin);
  palm.scale.set(0.82, 1.08, 0.58);
  palm.castShadow = true;
  hand.add(palm);

  const fingerPositions = [-0.085, -0.028, 0.028, 0.085];
  fingerPositions.forEach((x, i) => {
    const length = i === 0 || i === 3 ? 0.13 : 0.17;
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, length, 5, 10), mats.skin);
    finger.position.set(x * side, 0.2 + (i === 1 || i === 2 ? 0.015 : 0), 0.01);
    finger.rotation.z = x * side * 0.35;
    finger.castShadow = true;
    hand.add(finger);
  });

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 5, 10), mats.skin);
  thumb.position.set(-0.14 * side, 0.09, 0.03);
  thumb.rotation.z = side * -0.85;
  thumb.castShadow = true;
  hand.add(thumb);

  return hand;
}

function createChildFigure(mats) {
  const figure = new THREE.Group();
  figure.name = 'child-figure';

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 36, 28), mats.skin);
  head.scale.set(0.94, 1.12, 0.92);
  head.position.set(0, 1.74, 0);
  head.castShadow = true;

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 36, 28, 0, Math.PI * 2, 0, Math.PI * 0.54),
    mats.trouser,
  );
  hair.position.set(0, 1.79, 0);
  hair.scale.set(0.96, 1.08, 0.94);
  hair.castShadow = true;

  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mats.skin);
  earL.position.set(-0.27, 1.72, 0);
  const earR = earL.clone();
  earR.position.x = 0.27;

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), mats.skin);
  nose.position.set(0, 1.69, 0.27);
  nose.scale.set(0.8, 0.9, 0.7);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 20), mats.skin);
  neck.position.set(0, 1.45, 0);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.54, 10, 24), mats.sleeve);
  torso.position.set(0, 1.04, 0);
  torso.scale.set(1.02, 1, 0.74);
  torso.castShadow = true;

  const makeArm = (side) => {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.36, 8, 18), mats.sleeve);
    upper.position.set(side * 0.31, 1.2, 0.02);
    upper.rotation.z = side * -0.22;
    upper.castShadow = true;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 8, 18), mats.skin);
    fore.position.set(side * 0.42, 0.86, 0.14);
    fore.rotation.z = side * -0.18;
    fore.castShadow = true;
    const hand = createHand(mats, side);
    hand.position.set(side * 0.5, 0.6, 0.22);
    hand.rotation.z = side * -0.25;
    arm.add(upper, fore, hand);
    arm.userData.hand = hand;
    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const leg = (side) => {
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.42, 8, 18), mats.trouser);
    l.position.set(side * 0.16, 0.42, 0);
    l.castShadow = true;
    return l;
  };
  const legL = leg(-1);
  const legR = leg(1);
  const shoeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), mats.trouser);
  shoeL.scale.set(0.8, 0.55, 1.15);
  shoeL.position.set(-0.16, 0.14, 0.08);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.16;

  figure.add(head, hair, earL, earR, nose, neck, torso, leftArm, rightArm, legL, legR, shoeL, shoeR);
  figure.userData.rightHand = rightArm.userData.hand;
  figure.userData.rightArm = rightArm;
  figure.scale.setScalar(0.82);
  figure.position.set(-1.9, 0, 1.25);
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
    const shell = stage.closest('.p3d-shell');
    document.querySelector('[data-p3d-expand]')?.addEventListener('click', () => shell?.classList.add('is-expanded'));
    document.querySelector('[data-p3d-exit]')?.addEventListener('click', () => shell?.classList.remove('is-expanded'));
    document.querySelector('[data-p3d-productonly]')?.addEventListener('click', () => setMode(state, 'product'));
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
