// Динамічна зміна доби: небо-градієнт із сонцем, зірки, колір/напрям сонця й місяця,
// півсферне світло, туман, експозиція та інтенсивність неону.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Ключові кадри (t: 0 = північ, 0.25 = світанок, 0.5 = полудень, 0.75 = захід)
const KEYS = [
  { t: 0.00, top: '#040817', hor: '#101a3e', sun: '#7d93ff', sunI: 0.45, hs: '#25356e', hg: '#0b0d18', hi: 0.35, exp: 1.05 },
  { t: 0.20, top: '#0f1640', hor: '#3b2f6a', sun: '#8f8fff', sunI: 0.35, hs: '#3a3a7a', hg: '#151020', hi: 0.4,  exp: 1.05 },
  { t: 0.26, top: '#2c3a80', hor: '#ff8a5c', sun: '#ff8f4f', sunI: 1.2,  hs: '#8a7ab8', hg: '#4a2e26', hi: 0.55, exp: 1.0 },
  { t: 0.33, top: '#4a90d9', hor: '#ffd2a8', sun: '#ffd9b0', sunI: 2.4,  hs: '#a8d4ff', hg: '#6b5a3a', hi: 0.75, exp: 1.0 },
  { t: 0.50, top: '#3d8ee8', hor: '#c4e6ff', sun: '#fff6e8', sunI: 3.2,  hs: '#c4e6ff', hg: '#6f5d3c', hi: 0.9,  exp: 1.0 },
  { t: 0.68, top: '#4278c8', hor: '#ffc690', sun: '#ffc27a', sunI: 2.4,  hs: '#b0c8ef', hg: '#6b5236', hi: 0.75, exp: 1.0 },
  { t: 0.75, top: '#2b2f6e', hor: '#ff6a3c', sun: '#ff6a3c', sunI: 1.1,  hs: '#8a6aa0', hg: '#4a2a22', hi: 0.55, exp: 1.02 },
  { t: 0.82, top: '#0d1236', hor: '#33285e', sun: '#8f8fff', sunI: 0.35, hs: '#3a3a7a', hg: '#151020', hi: 0.4,  exp: 1.05 },
  { t: 1.00, top: '#040817', hor: '#101a3e', sun: '#7d93ff', sunI: 0.45, hs: '#25356e', hg: '#0b0d18', hi: 0.35, exp: 1.05 },
];
for (const k of KEYS) for (const f of ['top', 'hor', 'sun', 'hs', 'hg']) k[f] = new THREE.Color(k[f]);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class DayNight {
  constructor(engine, post) {
    this.engine = engine;
    this.post = post;
    this.time = CONFIG.startTimeOfDay;
    this.speed = 1;
    this.night = 0;
    this.cur = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };

    // Небо — сфера з градієнтним шейдером
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHor, uSunDir, uSunCol;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.55, h));
            col = mix(col, uHor * 0.35, smoothstep(0.0, -0.4, h));
            float s = max(dot(normalize(vDir), uSunDir), 0.0);
            col += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      })
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    engine.scene.add(this.sky);

    // Зірки
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
      pts.push(...v.normalize().multiplyScalar(380).toArray());
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, color: 0xdfe8ff }));
    engine.scene.add(this.stars);

    engine.scene.fog = new THREE.Fog(0xc4e6ff, 70, 240);

    this.sunDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3(0.35, 0.75, -0.55).normalize();
    // Для запечених тіней сонце «стоїть» під красивим кутом — інакше тіні роз'їдуться з освітленням
    this.fixedDir = new THREE.Vector3(0.35, 1, 0.45).normalize();
  }

  sample(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = smooth(0, 1, (t - a.t) / (b.t - a.t));
    for (const f of ['top', 'hor', 'sun', 'hs', 'hg']) this.cur[f].copy(a[f]).lerp(b[f], k);
    return { sunI: a.sunI + (b.sunI - a.sunI) * k, hi: a.hi + (b.hi - a.hi) * k, exp: a.exp + (b.exp - a.exp) * k };
  }

  /** Години у форматі ГГ:ХХ для HUD */
  get clock() {
    const m = Math.floor(this.time * 24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  get phaseName() {
    const t = this.time;
    if (t < 0.22 || t > 0.84) return 'Ніч';
    if (t < 0.32) return 'Світанок';
    if (t < 0.66) return 'День';
    return 'Вечір';
  }

  update(dt) {
    this.time = (this.time + (dt * this.speed) / CONFIG.dayLength) % 1;
    const t = this.time;
    const v = this.sample(t);

    // Положення сонця: схід на t=0.25, зеніт на 0.5, захід на 0.75
    const el = Math.sin((t - 0.25) * Math.PI * 2);
    const az = t * Math.PI * 2 + 0.6;
    this.sunDir.set(Math.cos(az) * Math.cos(Math.asin(el)), el, Math.sin(az) * Math.cos(Math.asin(el))).normalize();

    // Світло: плавно між сонцем (вдень) і місяцем (вночі), щоб тіні не стрибали
    const dayK = smooth(-0.12, 0.18, el);
    const sunForLight = this.sunDir.clone();
    sunForLight.y = Math.max(sunForLight.y, 0.18);
    if (CONFIG.gfx.sunMoves) this.lightDir.copy(this.moonDir).lerp(sunForLight.normalize(), dayK).normalize();
    else this.lightDir.copy(this.fixedDir);

    this.night = 1 - smooth(-0.06, 0.22, el);

    const e = this.engine;
    e.setSun(this.lightDir, this.cur.sun, v.sunI);
    e.hemi.color.copy(this.cur.hs);
    e.hemi.groundColor.copy(this.cur.hg);
    e.hemi.intensity = v.hi;
    e.renderer.toneMappingExposure = v.exp;
    e.scene.fog.color.copy(this.cur.hor);

    const u = this.sky.material.uniforms;
    u.uTop.value.copy(this.cur.top);
    u.uHor.value.copy(this.cur.hor);
    u.uSunDir.value.copy(this.sunDir);
    u.uSunCol.value.copy(this.cur.sun).multiplyScalar(smooth(-0.08, 0.05, el));
    this.sky.position.copy(e.camera.position);
    this.stars.position.copy(e.camera.position);
    this.stars.material.opacity = this.night;

    // Неонові вокселі: удень — просто яскраві, вночі — HDR для Bloom
    e.materials.glow.color.setScalar(1 + this.night * (CONFIG.gfx.bloom ? 1.4 : 0.6));
    this.post?.setNight(this.night);
  }
}
