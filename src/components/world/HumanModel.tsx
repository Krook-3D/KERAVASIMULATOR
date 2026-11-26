import type { RefObject } from 'react';
import type * as THREE from 'three';

/**
 * Original chunky low-poly human with game-style proportions: big head,
 * hands and feet, short sturdy legs (about 1.8 m tall in total, readable from
 * a high camera). Limbs pivot at hips and shoulders for animation.
 */
export interface HumanRig {
  legL: RefObject<THREE.Group | null>;
  legR: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
}

export interface Outfit {
  top: string;
  legs: string;
  shoes: string;
  skin?: string;
  hat: 'beanie' | 'cap';
  hatColor: string;
  accent: string;
  backpack?: boolean;
}

const DEFAULT_SKIN = '#f1c7a1';

export function HumanModel({ outfit, rig }: { outfit: Outfit; rig: HumanRig }) {
  const skin = { color: outfit.skin ?? DEFAULT_SKIN, roughness: 0.7 };
  const top = { color: outfit.top, roughness: 0.85 };
  const legs = { color: outfit.legs, roughness: 0.9 };

  return (
    <group>
      {/* legs */}
      {([rig.legL, rig.legR] as const).map((ref, i) => (
        <group key={i} ref={ref} position={[i === 0 ? -0.17 : 0.17, 0.78, 0]}>
          <mesh position={[0, -0.33, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.42, 4, 10]} />
            <meshStandardMaterial {...legs} />
          </mesh>
          <mesh position={[0, -0.7, 0.08]} castShadow>
            <boxGeometry args={[0.27, 0.16, 0.44]} />
            <meshStandardMaterial color={outfit.shoes} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.775, 0.08]}>
            <boxGeometry args={[0.28, 0.035, 0.45]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
        </group>
      ))}

      {/* torso */}
      <mesh position={[0, 1.12, 0]} scale={[1.2, 1, 0.85]} castShadow>
        <capsuleGeometry args={[0.28, 0.32, 6, 14]} />
        <meshStandardMaterial {...top} />
      </mesh>
      {/* belt line / hem */}
      <mesh position={[0, 0.83, 0]} scale={[1.2, 1, 0.85]}>
        <cylinderGeometry args={[0.285, 0.285, 0.08, 14]} />
        <meshStandardMaterial color={outfit.accent} roughness={0.8} />
      </mesh>
      {outfit.backpack && (
        <group>
          <mesh position={[0, 1.15, -0.3]} castShadow>
            <boxGeometry args={[0.44, 0.5, 0.2]} />
            <meshStandardMaterial color="#2b3245" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.3, -0.41]}>
            <boxGeometry args={[0.34, 0.05, 0.02]} />
            <meshStandardMaterial color={outfit.accent} />
          </mesh>
        </group>
      )}

      {/* arms */}
      {([rig.armL, rig.armR] as const).map((ref, i) => (
        <group key={i} ref={ref} position={[i === 0 ? -0.43 : 0.43, 1.38, 0]}>
          <mesh position={[0, -0.27, 0]} rotation-z={i === 0 ? 0.1 : -0.1} castShadow>
            <capsuleGeometry args={[0.1, 0.38, 4, 10]} />
            <meshStandardMaterial {...top} />
          </mesh>
          <mesh position={[i === 0 ? -0.05 : 0.05, -0.58, 0]} castShadow>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        </group>
      ))}

      {/* head (big, game-style) */}
      <group ref={rig.head} position={[0, 1.55, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.12, 10]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        <mesh position={[0, 0.3, 0.01]} scale={[1, 1.06, 0.98]} castShadow>
          <sphereGeometry args={[0.27, 20, 16]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        {[-0.27, 0.27].map((x) => (
          <mesh key={x} position={[x, 0.29, 0]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        ))}
        {outfit.hat === 'beanie' ? (
          <group>
            <mesh position={[0, 0.38, 0]} scale={[1.04, 0.9, 1.04]} castShadow>
              <sphereGeometry args={[0.275, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={outfit.hatColor} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.39, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.27, 0.045, 8, 22]} />
              <meshStandardMaterial color={outfit.accent} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.65, 0]} castShadow>
              <sphereGeometry args={[0.085, 10, 8]} />
              <meshStandardMaterial color={outfit.accent} roughness={1} />
            </mesh>
          </group>
        ) : (
          <group>
            <mesh position={[0, 0.47, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.29, 0.16, 18]} />
              <meshStandardMaterial color={outfit.hatColor} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.41, 0.2]} rotation-x={0.25}>
              <boxGeometry args={[0.4, 0.03, 0.22]} />
              <meshStandardMaterial color="#14171f" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.48, 0.285]}>
              <boxGeometry args={[0.12, 0.07, 0.01]} />
              <meshStandardMaterial color={outfit.accent} metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        )}
        {/* face on +z */}
        {[-0.095, 0.095].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.31, 0.24]}>
              <sphereGeometry args={[0.042, 10, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[x, 0.31, 0.275]}>
              <sphereGeometry args={[0.022, 8, 6]} />
              <meshBasicMaterial color="#14171f" />
            </mesh>
            <mesh position={[x, 0.385, 0.25]} rotation-z={x < 0 ? 0.15 : -0.15}>
              <boxGeometry args={[0.08, 0.018, 0.012]} />
              <meshBasicMaterial color="#4a3020" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.25, 0.275]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        <mesh position={[0, 0.17, 0.255]}>
          <boxGeometry args={[0.1, 0.018, 0.01]} />
          <meshBasicMaterial color="#7a3b2e" />
        </mesh>
      </group>
    </group>
  );
}
