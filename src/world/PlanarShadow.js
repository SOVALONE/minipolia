// Проєктована (planar) тінь у реальному часі для рухомих об'єктів на «Низьких».
// Геометрія об'єкта щокадру «сплющується» на горизонтальну площину вздовж напрямку сонця.
// Вартість — кілька draw call без жодного проходу карти тіней, тож статичні тіні
// можна запекти один раз, а фішки й кубики все одно мають чесну тінь свого силуету.
import * as THREE from 'three';

// Stencil гарантує рівномірну тінь: піксель затіняється лише один раз,
// навіть якщо воксельні кубики фігурки перекриваються в проєкції.
const SHADOW_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  fog: false,
  stencilWrite: true,
  stencilRef: 0,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.IncrementStencilOp,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

const _proj = new THREE.Matrix4();

export class PlanarShadow {
  /** source — Object3D (фішка/кубик), height — висота площини, на яку падає тінь. */
  constructor(scene, source, height) {
    this.source = source;
    this.height = height;
    this.group = new THREE.Group();
    this.pairs = [];
    source.traverse((o) => {
      if (!o.isMesh) return;
      let m;
      if (o.isInstancedMesh) {
        m = new THREE.InstancedMesh(o.geometry, SHADOW_MATERIAL, o.count);
        m.instanceMatrix = o.instanceMatrix; // спільні матриці інстансів
      } else {
        m = new THREE.Mesh(o.geometry, SHADOW_MATERIAL);
      }
      m.matrixAutoUpdate = false;
      m.frustumCulled = false;
      m.renderOrder = 1;
      this.group.add(m);
      this.pairs.push([o, m]);
    });
    scene.add(this.group);
  }

  /** dirToSun — нормалізований вектор на сонце. */
  update(dirToSun) {
    this.source.updateWorldMatrix(true, true);
    this.group.visible = this.source.visible;
    const dy = Math.max(dirToSun.y, 0.15);
    const kx = dirToSun.x / dy, kz = dirToSun.z / dy, h = this.height;
    // p' = p - L * (p.y - h) / L.y, L = напрям на сонце → тінь падає у протилежний бік
    _proj.set(
      1, -kx, 0, kx * h,
      0, 0, 0, h,
      0, -kz, 1, kz * h,
      0, 0, 0, 1
    );
    for (const [src, m] of this.pairs) m.matrix.multiplyMatrices(_proj, src.matrixWorld);
  }

  static setStrength(opacity) { SHADOW_MATERIAL.opacity = opacity; }
}
