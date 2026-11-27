import * as THREE from 'three';

/**
 * Shader patches for the world's materials. Everything is procedural, so the
 * game ships no texture files and works offline.
 */

export interface XrayUniforms {
  uPlayer: { value: THREE.Vector3 };
  uCamera: { value: THREE.Vector3 };
  uRadius: { value: number };
}

export function createXrayUniforms(): XrayUniforms {
  return {
    uPlayer: { value: new THREE.Vector3() },
    uCamera: { value: new THREE.Vector3() },
    uRadius: { value: 3.4 },
  };
}

const WORLD_VARYINGS = 'varying vec3 vWorldPos;\nvarying vec3 vWorldNormal;';

function addWorldVaryings(shader: THREE.WebGLProgramParametersWithUniforms, extraVertexDecl = '', extraVertexBody = '') {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\n${extraVertexDecl}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNormal = mat3(modelMatrix) * objectNormal;
${extraVertexBody}`,
    );
}

const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}`;

/**
 * Buildings: windows, plinth and roof tint drawn in the shader, plus an x-ray
 * hole where a wall sits between the camera and the player.
 */
export function createBuildingMaterial(xray: XrayUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, xray);
    addWorldVaryings(
      shader,
      'attribute float aFacade;\nattribute float aTop;\nattribute float aBase;\nvarying float vFacade;\nvarying float vTop;\nvarying float vBase;',
      'vFacade = aFacade;\nvTop = aTop;\nvBase = aBase;',
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${WORLD_VARYINGS}
varying float vFacade;
varying float vTop;
varying float vBase;
uniform vec3 uPlayer;
uniform vec3 uCamera;
uniform float uRadius;
${NOISE_GLSL}`,
      )
      .replace(
        'void main() {',
        `void main() {
  vec3 seg = uPlayer - uCamera;
  float xt = dot(vWorldPos - uCamera, seg) / max(dot(seg, seg), 0.0001);
  if (xt > 0.0 && xt < 0.96 && length(vWorldPos - (uCamera + seg * xt)) < uRadius) discard;
  float glass = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec3 n = vWorldNormal / max(length(vWorldNormal), 1e-4);
  float grime = vnoise(vWorldPos.xz * 0.35 + vWorldPos.y * 0.2) * 0.12;
  if (vFacade > 1.5) {
    diffuseColor.rgb *= 0.9 - grime;               // parapet
  } else if (vFacade > 0.5) {
    if (n.y > 0.5) {
      // flat roof: dark felt with patches
      diffuseColor.rgb = mix(vec3(0.27, 0.28, 0.30), diffuseColor.rgb * 0.5, 0.25) * (0.9 + vnoise(vWorldPos.xz * 0.4) * 0.2);
    } else {
      float u = abs(n.z) > abs(n.x) ? vWorldPos.x : vWorldPos.z;
      float h = vWorldPos.y - vBase;
      float floorH = vTop < 7.6 ? 2.9 : 3.1;
      float cellW = vTop < 7.6 ? 3.6 : 2.7;
      vec2 cell = vec2(u / cellW, (h - 0.3) / floorH);
      vec2 f = fract(cell);
      vec2 id = floor(cell);
      bool inWin = f.x > 0.24 && f.x < 0.76 && f.y > 0.32 && f.y < 0.8 && h > 0.9 && h < vTop - 0.7;
      bool inFrame = f.x > 0.2 && f.x < 0.8 && f.y > 0.28 && f.y < 0.84 && h > 0.9 && h < vTop - 0.7;
      // ground-floor shop windows on taller buildings
      bool shop = vTop > 7.6 && h > 0.5 && h < 2.8 && f.x > 0.08 && f.x < 0.92;
      diffuseColor.rgb *= 1.0 - grime;
      if (h < 0.5) diffuseColor.rgb *= 0.55;        // plinth
      if (shop || inWin) {
        float lit = step(0.86, hash21(id));
        vec3 glassCol = mix(vec3(0.16, 0.22, 0.30), vec3(0.42, 0.55, 0.66), f.y);
        diffuseColor.rgb = mix(glassCol, vec3(0.95, 0.82, 0.55), lit * 0.55);
        glass = 1.0;
      } else if (inFrame) {
        diffuseColor.rgb = vec3(0.93, 0.92, 0.88);
      }
      // subtle horizontal floor lines
      diffuseColor.rgb *= 1.0 - 0.06 * step(0.97, fract((h - 0.3) / floorH));
    }
  }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.22, glass);',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.6, glass);',
      );
  };
  m.customProgramCacheKey = () => 'kerava-building';
  return m;
}

/**
 * Ground: grass with large- and small-scale colour variation, plus land
 * cover from a painted map (park lawn, forest floor, muddy banks) and bare
 * earth / rock on steep slopes.
 */
export function createGroundMaterial(map?: { texture: THREE.Texture; min: THREE.Vector2; size: THREE.Vector2 }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  black.needsUpdate = true;
  const uniforms = {
    uGroundMap: { value: map?.texture ?? black },
    uMapMin: { value: map?.min ?? new THREE.Vector2(0, 0) },
    uMapSize: { value: map?.size ?? new THREE.Vector2(1, 1) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    addWorldVaryings(shader, 'attribute float aSlope;\nvarying float vSlope;', 'vSlope = aSlope;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${WORLD_VARYINGS}\nvarying float vSlope;\nuniform sampler2D uGroundMap;\nuniform vec2 uMapMin;\nuniform vec2 uMapSize;\n${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec2 p = vWorldPos.xz;
  float big = vnoise(p * 0.012) * 0.6 + vnoise(p * 0.04) * 0.4;
  float small = vnoise(p * 0.6) * 0.5 + vnoise(p * 2.3) * 0.5;
  vec3 g1 = vec3(0.22, 0.48, 0.11);
  vec3 g2 = vec3(0.36, 0.62, 0.16);
  vec3 dry = vec3(0.62, 0.60, 0.38);
  vec3 col = mix(g1, g2, big);
  col = mix(col, dry, smoothstep(0.72, 0.95, big) * 0.3);
  // lush, darker grass in low wet ground; drier, paler grass up on the hills
  float hgt = vWorldPos.y;
  col = mix(col, col * vec3(0.82, 0.95, 0.80), smoothstep(1.5, -4.0, hgt) * 0.6);
  col = mix(col, mix(col, dry, 0.5), smoothstep(8.0, 22.0, hgt) * 0.45);
  vec2 muv = (p - uMapMin) / uMapSize;
  vec3 cover = texture2D(uGroundMap, muv).rgb;
  if (muv.x < 0.0 || muv.y < 0.0 || muv.x > 1.0 || muv.y > 1.0) cover = vec3(0.0);
  col = mix(col, vec3(0.28, 0.60, 0.15), cover.r * 0.85);
  vec3 forest = mix(vec3(0.17, 0.25, 0.10), vec3(0.32, 0.27, 0.15), vnoise(p * 0.21));
  forest = mix(forest, vec3(0.42, 0.40, 0.22), smoothstep(0.75, 0.95, vnoise(p * 0.07)) * 0.6); // clearings with heather
  col = mix(col, forest, cover.g);
  col = mix(col, vec3(0.38, 0.33, 0.24), cover.b * 0.75);
  float rock = smoothstep(0.12, 0.3, vSlope + (small - 0.5) * 0.08);
  col = mix(col, mix(vec3(0.40, 0.33, 0.24), vec3(0.50, 0.49, 0.47), vnoise(p * 0.35)), rock * 0.85);
  diffuseColor.rgb = col * (0.88 + small * 0.24);`,
      );
  };
  m.customProgramCacheKey = () => `kerava-ground-${map ? 'map' : 'plain'}`;
  return m;
}

/** Asphalt / gravel with fine grain noise. */
export function createGrainMaterial(color: string, grain = 0.18, roughness = 0.95): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness });
  m.onBeforeCompile = (shader) => {
    addWorldVaryings(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float gr = vnoise(vWorldPos.xz * 3.1) * 0.5 + vnoise(vWorldPos.xz * 0.3) * 0.5;
  diffuseColor.rgb *= 1.0 - ${grain.toFixed(3)} + gr * ${(grain * 2).toFixed(3)};`,
      );
  };
  m.customProgramCacheKey = () => `kerava-grain-${color}-${grain}`;
  return m;
}

/** Plain standard material with the x-ray hole (for canopies and other roofs). */
export function createXrayStandardMaterial(xray: XrayUniforms, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, xray);
    addWorldVaryings(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\nuniform vec3 uPlayer;\nuniform vec3 uCamera;\nuniform float uRadius;`)
      .replace(
        'void main() {',
        `void main() {
  vec3 seg = uPlayer - uCamera;
  float xt = dot(vWorldPos - uCamera, seg) / max(dot(seg, seg), 0.0001);
  if (xt > 0.0 && xt < 0.96 && length(vWorldPos - (uCamera + seg * xt)) < uRadius) discard;`,
      );
  };
  m.customProgramCacheKey = () => `kerava-xray-${String(params.color)}`;
  return m;
}

/**
 * Stylised animated water: rippling normals from layered sine waves, a
 * shallow/deep tint that follows the ripples and sparkles on the crests.
 * Update `material.userData.uTime.value` every frame.
 */
export function createWaterMaterial(color = '#2f7fb0'): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.9 });
  const uTime = { value: 0 };
  m.userData.uTime = uTime;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 wp = vWPos.xz;
        float band = sin(wp.x * 0.21 + uTime * 0.6) * sin(wp.y * 0.19 - uTime * 0.5);
        float caust = pow(abs(sin(wp.x * 1.3 + sin(wp.y * 0.9 + uTime) * 1.5) * sin(wp.y * 1.2 + sin(wp.x * 0.8 - uTime * 1.2) * 1.5)), 3.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.85, 0.95), 0.35 + 0.25 * band);
        diffuseColor.rgb += vec3(0.25, 0.4, 0.45) * caust * 0.35;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xz;
          float t = uTime;
          vec2 g = vec2(cos(p.x * 0.35 + t * 1.1), cos(p.y * 0.31 + t * 0.9)) * 0.09;
          g += vec2(cos((p.x + p.y) * 0.9 + t * 1.7), cos((p.x - p.y) * 0.8 - t * 1.4)) * 0.05;
          g += vec2(cos(p.x * 2.3 - t * 2.6), cos(p.y * 2.1 + t * 2.2)) * 0.025;
          vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 q = vWPos.xz;
          float sp = pow(max(0.0, sin(q.x * 3.1 + uTime * 2.0) * sin(q.y * 2.7 - uTime * 1.7) * sin((q.x + q.y) * 1.9 + uTime)), 18.0);
          totalEmissiveRadiance += vec3(1.0, 0.98, 0.9) * sp * 0.9;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'kerava-water';
  return m;
}

/** Soft animated foam along shores (a ribbon with u across, v along). */
export function createFoamMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
  const uTime = { value: 0 };
  m.userData.uTime = uTime;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 foam;\nvarying vec2 vFoam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoam = foam;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFoam;')
      .replace(
        '#include <opaque_fragment>',
        `float edge = 1.0 - abs(vFoam.x * 2.0 - 1.0);
        float wave = 0.5 + 0.5 * sin(vFoam.y * 0.8 - uTime * 2.2 + vFoam.x * 3.0);
        diffuseColor.a *= smoothstep(0.0, 0.6, edge) * (0.35 + 0.65 * wave);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'kerava-foam';
  return m;
}
