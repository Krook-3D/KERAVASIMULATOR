import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SavedPiece } from '../../../game/art/graffiti';

function Piece({ piece }: { piece: SavedPiece }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(piece.img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [piece.img]);
  useEffect(() => () => tex.dispose(), [tex]);
  const yaw = Math.atan2(piece.n[0], piece.n[1]);
  return (
    <mesh position={[piece.q[0] + piece.n[0] * 0.07, piece.y + 0.35 + piece.h / 2, piece.q[1] + piece.n[1] * 0.07]} rotation-y={yaw} raycast={() => null}>
      <planeGeometry args={[piece.w, piece.h]} />
      <meshStandardMaterial map={tex} transparent roughness={0.6} polygonOffset polygonOffsetFactor={-4} depthWrite={false} />
    </mesh>
  );
}

/** Finished graffiti pieces on the town's walls. */
export function GraffitiWall({ pieces }: { pieces: SavedPiece[] }) {
  return (
    <group>
      {pieces.map((p) => (
        <Piece key={p.id} piece={p} />
      ))}
    </group>
  );
}
