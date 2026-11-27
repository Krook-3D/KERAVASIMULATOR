import { useEffect, useMemo, type MutableRefObject } from 'react';
import { buildHumanoid, disposeHumanoid, type HumanBones, type Outfit } from './buildHumanoid';

/**
 * Renders one skinned humanoid. The bones are handed to the parent through
 * `bonesRef` so it can animate them in its own useFrame.
 */
export function Humanoid({ outfit, bonesRef }: { outfit: Outfit; bonesRef: MutableRefObject<HumanBones | null> }) {
  const key = JSON.stringify(outfit);
  const built = useMemo(() => buildHumanoid(outfit), [key]);
  bonesRef.current = built.bones;
  useEffect(() => () => disposeHumanoid(built.mesh), [built]);
  return <primitive object={built.mesh} />;
}

export type { HumanBones, Outfit };
