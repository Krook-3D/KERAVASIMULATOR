import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post-processing for the "high" graphics setting: ambient occlusion, soft
 * bloom on bright things (sparkles, lamps, legendary loot beams), filmic tone
 * mapping and a gentle colour grade that keeps the storybook look saturated.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={3} distanceFalloff={1.2} intensity={2.2} quality="medium" halfRes />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.25} intensity={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.12} />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <Vignette offset={0.25} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  );
}
