import * as THREE from 'three';

/**
 * Patches a standard material so fragments between the camera and the player
 * are discarded. Buildings in front of the player get a see-through "hole"
 * and the character is never hidden behind a wall.
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
    uRadius: { value: 3.2 },
  };
}

export function applyXray(material: THREE.Material, uniforms: XrayUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXrayWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvXrayWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vXrayWorld;\nuniform vec3 uPlayer;\nuniform vec3 uCamera;\nuniform float uRadius;',
      )
      .replace(
        'void main() {',
        `void main() {
  vec3 seg = uPlayer - uCamera;
  float t = dot(vXrayWorld - uCamera, seg) / max(dot(seg, seg), 0.0001);
  if (t > 0.0 && t < 0.97 && length(vXrayWorld - (uCamera + seg * t)) < uRadius) discard;`,
      );
  };
  material.customProgramCacheKey = () => 'xray';
}
