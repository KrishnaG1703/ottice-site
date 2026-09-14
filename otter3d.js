// hero otter: a meshy sculpt rendered as warm clay, swaying and leaning toward the cursor
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { mergeVertices } from './vendor/three/utils/BufferGeometryUtils.js';

const stage = document.getElementById('otter-stage');
const canvas = document.getElementById('otter-canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);

/* ---------- the 3d sculpt ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  stage.classList.add('no-webgl', 'is-ready');
}

let lookX = 0;
let lookY = 0;
// lean toward the cursor anywhere on the page, no hovering required
addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  const rect = stage.getBoundingClientRect();
  lookX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
  lookY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
}, { passive: true });

let running = false;
let visible = true;
let last = 0;
let frameFn = () => {};
function wake() {
  if (running || !visible || document.hidden) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const keepGoing = frameFn(dt, now / 1000);
  if (keepGoing && visible && !document.hidden) requestAnimationFrame(loop);
  else running = false;
}
document.addEventListener('visibilitychange', wake);

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.4);

  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x0b2a2a, 1.1));
  const key = new THREE.DirectionalLight(0xffe2c2, 2.6);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe2b0, 2.2);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x6fc7d6, 0.6);
  fill.position.set(-3, -1, 2);
  scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);

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

  new GLTFLoader().load('assets/otter3d/otter.glb', gltf => {
    // the export has positions only: weld duplicate vertices so normals come out smooth
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.deleteAttribute('normal');
      node.geometry = mergeVertices(node.geometry, 1e-4);
      node.geometry.computeVertexNormals();
      node.material = new THREE.MeshPhysicalMaterial({
        color: 0xc97a3e,
        roughness: 0.62,
        metalness: 0,
        sheen: 1,
        sheenColor: new THREE.Color(0xffc38a),
        sheenRoughness: 0.55,
        clearcoat: 0.08
      });
    });
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const scale = 2.05 / size.y;
    model.scale.setScalar(scale);
    model.position.multiplyScalar(scale);
    pivot.add(model);
    stage.classList.add('is-ready');
    wake();
  }, undefined, error => {
    console.warn('otter: model failed to load', error);
    stage.classList.add('no-webgl', 'is-ready');
  });

  let yaw = 0;
  let pitch = 0;
  frameFn = (dt, time) => {
    // idle sway, leaning a little toward the cursor
    // keep it mostly front-facing: the sculpt reads best from the front
    const idle = reduceMotion ? 0 : Math.sin(time * 0.6) * 0.3;
    const wantYaw = idle + lookX * 0.22;
    const wantPitch = lookY * 0.12;
    yaw += (wantYaw - yaw) * ease(dt, 2.4);
    pitch += (wantPitch - pitch) * ease(dt, 3);
    pivot.rotation.set(pitch, yaw, 0);
    pivot.position.y = reduceMotion ? 0 : Math.sin(time * 1.4) * 0.03;

    renderer.render(scene, camera);
    // keep animating while swaying, easing, or revealing
    return !reduceMotion || Math.abs(wantYaw - yaw) > 0.001 || Math.abs(wantPitch - pitch) > 0.001;
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(stage);
}
