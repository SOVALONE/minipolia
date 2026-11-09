// Рендерер, сцена, камера, керування та сонце: каскадні тіні (Ультра) або запечені (Низькі).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { CONFIG } from '../config.js';

export class Engine {
  constructor(container) {
    const gfx = (this.gfx = CONFIG.gfx);
    const r = (this.renderer = new THREE.WebGLRenderer({
      antialias: gfx.antialias,
      stencil: true, // потрібен для проєктованих тіней фішок
      powerPreference: 'high-performance',
    }));
    r.setPixelRatio(Math.min(devicePixelRatio, gfx.pixelRatio));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 700);
    this.camera.position.set(24, 30, 34);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 10;
    c.maxDistance = 85;
    c.maxPolarAngle = Math.PI * 0.45;
    c.target.set(0, 0, 0);

    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b5a3a, 0.8);
    this.scene.add(this.hemi);

    if (gfx.csm) {
      this.csm = new CSM({
        maxFar: 90,
        cascades: 3,
        mode: 'practical',
        parent: this.scene,
        shadowMapSize: gfx.shadowMapSize,
        lightDirection: new THREE.Vector3(-1, -1.4, -0.8).normalize(),
        lightIntensity: 3,
        lightMargin: 40,
        shadowBias: -0.0003,
        camera: this.camera,
      });
      this.csm.fade = true;
    } else {
      const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 3));
      sun.castShadow = true;
      sun.shadow.mapSize.set(gfx.shadowMapSize, gfx.shadowMapSize);
      Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 });
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      // Запечені тіні: карта тіней рендериться лише за запитом bakeShadows(), а не щокадру
      if (gfx.shadows === 'baked') sun.shadow.autoUpdate = false;
      this.scene.add(sun, sun.target);
    }

    // Спільні матеріали. Колір кожного вокселя — через instanceColor.
    this.materials = {
      solid: this.std({ roughness: 0.82, metalness: 0.02 }),
      // Unlit-матеріал для «світних» вокселів: колір множиться на HDR-коефіцієнт,
      // тож вночі ці вокселі потрапляють у Bloom.
      glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };

    this.frameHandlers = [];
    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
  }

  /** Створити MeshStandardMaterial, сумісний із CSM. Усі освітлені матеріали — тільки через цей метод! */
  std(params = {}) {
    const m = new THREE.MeshStandardMaterial(params);
    if (this.csm) this.csm.setupMaterial(m);
    return m;
  }

  setSun(dirToSun, color, intensity) {
    if (this.csm) {
      this.csm.lightDirection.copy(dirToSun).negate();
      for (const l of this.csm.lights) {
        l.color.copy(color);
        l.intensity = intensity;
      }
    } else {
      this.sun.position.copy(dirToSun).multiplyScalar(50);
      this.sun.color.copy(color);
      this.sun.intensity = intensity;
    }
  }

  /**
   * Запекти статичні тіні: один прохід карти тіней на наступному кадрі.
   * Динамічні об'єкти (фішки, кубики, частинки) на «Низьких» не кидають тінь у карту —
   * їхні тіні малює PlanarShadow щокадру.
   */
  bakeShadows() {
    if (this.sun && this.gfx.shadows === 'baked') this.sun.shadow.needsUpdate = true;
  }

  get realtimeShadows() { return this.gfx.shadows !== 'baked'; }

  onFrame(fn) { this.frameHandlers.push(fn); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.csm?.updateFrustums();
    this.post?.setSize(w, h);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      for (const fn of this.frameHandlers) fn(dt, t);
      this.controls.update();
      this.camera.updateMatrixWorld();
      this.csm?.update();
      if (this.post) this.post.render();
      else this.renderer.render(this.scene, this.camera);
    });
  }
}
