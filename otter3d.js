// phones only: the 3d otter sits in the hero where the demo is too small to carry the page.
// drag sideways to spin it (vertical swipes still scroll), tap it to make it hop.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { mergeVertices } from './vendor/three/utils/BufferGeometryUtils.js';

const stage = document.getElementById('otter-stage');
const canvas = document.getElementById('otter-canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  stage.classList.add('no-webgl');
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0.1, 6.6);

  // lit to match the glossy green mascot: warm key, mint rim, soft cool fill
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x16352c, 1.2));
  const key = new THREE.DirectionalLight(0xfff0dc, 3);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe2b0, 2.6);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc9f0d3, 0.8);
  fill.position.set(-3, -1, 3);
  scene.add(fill);

  const pivot = new THREE.Group();
  const hopper = new THREE.Group();
  hopper.add(pivot);
  scene.add(hopper);

  /* ---------- render loop that sleeps when nothing moves ---------- */
  let running = false;
  let visible = false;
  let last = 0;
  let frameFn = () => false;
  const wake = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  };
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (frameFn(dt, now / 1000) && visible && !document.hidden) requestAnimationFrame(loop);
    else running = false;
  }
  document.addEventListener('visibilitychange', wake);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(stage);

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  new GLTFLoader().load('assets/otter3d/otter.glb?v=2', gltf => {
    // the export has positions only: weld duplicate vertices so the normals come out smooth
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.deleteAttribute('normal');
      node.geometry = mergeVertices(node.geometry, 1e-4);
      node.geometry.computeVertexNormals();
      node.material = new THREE.MeshPhysicalMaterial({
        color: 0x2d6a55,
        roughness: 0.34,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        sheen: 0.4,
        sheenColor: new THREE.Color(0x9fe2b0)
      });
    });
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const scale = 2.2 / size.y;
    model.scale.setScalar(scale);
    model.position.multiplyScalar(scale);
    // the bounding box includes the tail, so nudge the body onto the spin axis
    model.position.x += 0.26;
    pivot.add(model);
    stage.classList.add('is-ready');
    hop(0.7);
  }, undefined, () => stage.classList.add('no-webgl'));

  /* ---------- touch: sideways drag spins, tap hops ---------- */
  let yaw = 0;
  let spin = 0; // radians per second of free spin after a flick
  let dragging = false;
  let dragX = 0;
  let dragStart = 0;
  let moved = 0;
  let lastMoveAt = 0;
  let hopT = 1;
  let hopPower = 1;

  function hop(power = 1) {
    if (reduceMotion) return;
    hopT = 0;
    hopPower = power;
    wake();
  }

  stage.addEventListener('pointerdown', event => {
    dragging = true;
    dragX = event.clientX;
    dragStart = performance.now();
    moved = 0;
    spin = 0;
    stage.setPointerCapture(event.pointerId);
    wake();
  });
  stage.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - dragX;
    const now = performance.now();
    dragX = event.clientX;
    moved += Math.abs(dx);
    const delta = dx * 0.012;
    yaw += delta;
    spin = Math.max(-14, Math.min(14, delta / Math.max(0.016, (now - lastMoveAt) / 1000)));
    lastMoveAt = now;
    wake();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6 && performance.now() - dragStart < 350) { spin = 0; hop(); }
    if (performance.now() - lastMoveAt > 80) spin = 0;
    wake();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hop(); }
    if (event.key === 'ArrowLeft') { spin = -6; wake(); }
    if (event.key === 'ArrowRight') { spin = 6; wake(); }
  });

  frameFn = (dt, time) => {
    let busy = dragging;
    if (!dragging) {
      // flick momentum, then settle back to facing the reader
      yaw += spin * dt;
      spin *= Math.exp(-dt * 2.2);
      if (Math.abs(spin) < 0.4) {
        spin = 0;
        const nearestFront = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
        const idle = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.25;
        yaw += (nearestFront + idle - yaw) * ease(dt, 3);
      }
      busy = busy || spin !== 0 || !reduceMotion;
    }
    pivot.rotation.set(0, yaw, 0);

    // hop: rise and fall with a little squash on landing
    if (hopT < 1) {
      hopT = Math.min(1, hopT + dt / 0.62);
      const arc = Math.sin(hopT * Math.PI);
      hopper.position.y = arc * 0.38 * hopPower;
      const squash = hopT > 0.85 ? Math.sin((hopT - 0.85) / 0.15 * Math.PI) * 0.06 * hopPower : 0;
      hopper.scale.set(1 + squash, 1 - squash - arc * 0.02, 1 + squash);
      busy = true;
    } else {
      hopper.position.y = reduceMotion ? 0 : Math.sin(time * 1.5) * 0.025;
      hopper.scale.set(1, 1, 1);
    }

    renderer.render(scene, camera);
    return busy;
  };
}
