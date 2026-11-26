import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/** Post-processing for the "high" graphics setting: ambient occlusion, soft bloom, vignette. */
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={3} distanceFalloff={1.2} intensity={2.2} quality="medium" halfRes />
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.35} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.25} darkness={0.45} />
      <SMAA />
    </EffectComposer>
  );
}
