// Постобробка: Render → GTAO (сучасний SSAO з денойзом) → Bloom → Output (тонмапінг/sRGB) → SMAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { CONFIG } from '../config.js';

export class PostFX {
  constructor(engine) {
    const { renderer, scene, camera } = engine;
    const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();

    // HalfFloat-буфер: зберігає HDR-значення >1, потрібні для чесного Bloom
    const target = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType });
    const composer = (this.composer = new EffectComposer(renderer, target));
    composer.setPixelRatio(pr);
    composer.setSize(w, h);

    composer.addPass(new RenderPass(scene, camera));

    this.ao = new GTAOPass(scene, camera, w, h);
    this.ao.output = GTAOPass.OUTPUT.Default;
    this.ao.blendIntensity = 1.0;
    this.ao.updateGtaoMaterial?.({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
    this.ao.updatePdMaterial?.({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.ao.enabled = CONFIG.gfx.ssao;
    composer.addPass(this.ao);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.4, 0.95);
    this.bloom.enabled = CONFIG.gfx.bloom;
    composer.addPass(this.bloom);

    composer.addPass(new OutputPass());

    this.smaa = new SMAAPass(w * pr, h * pr);
    composer.addPass(this.smaa);
  }

  /** night ∈ [0..1]: вночі bloom сильніший — неонові вивіски «світяться». */
  setNight(night) {
    this.bloom.strength = 0.25 + night * 0.35;
    this.bloom.threshold = 0.95 - night * 0.1;
  }

  setSize(w, h) { this.composer.setSize(w, h); }
  render() { this.composer.render(); }
}
