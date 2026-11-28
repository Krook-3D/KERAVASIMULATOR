import { CAR_MODELS, type CarModelId } from '../../game/vehicle/cars';
import type { WorldXZ } from '../../game/world/projection';
import { CarMesh } from './DrivableCar';
import { TextPanel } from './interiors/kit';

/** Keravan Autotori: the three models on show in a row, with a sign. */
export function CarLot({ lot, groundAt }: { lot: { at: WorldXZ; yaw: number; sign: WorldXZ; outward: WorldXZ }; groundAt: (x: number, z: number) => number }) {
  const [ox, oz] = lot.outward;
  const ids = Object.keys(CAR_MODELS) as CarModelId[];
  return (
    <group>
      {/* asphalt forecourt under the cars */}
      <mesh position={[lot.at[0] + ox * 5, groundAt(lot.at[0] + ox * 5, lot.at[1] + oz * 5) + 0.04, lot.at[1] + oz * 5]} rotation={[-Math.PI / 2, 0, Math.atan2(-ox, -oz)]} receiveShadow>
        <planeGeometry args={[7, 15]} />
        <meshStandardMaterial color="#4a4d53" roughness={0.9} />
      </mesh>
      {ids.map((id, i) => {
        // display cars stand further out from the shop than the sales spot, side by side
        const x = lot.at[0] + ox * (4 + i * 3.2), z = lot.at[1] + oz * (4 + i * 3.2);
        return (
          <group key={id} position={[x, groundAt(x, z), z]} rotation-y={lot.yaw}>
            <CarMesh color={CAR_MODELS[id].colors[0]!} />
          </group>
        );
      })}
      {/* sign on two posts, facing the shop door */}
      <group position={[lot.sign[0], groundAt(lot.sign[0], lot.sign[1]), lot.sign[1]]} rotation-y={Math.atan2(-ox, -oz)}>
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} position={[x, 1.1, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
            <meshStandardMaterial color="#3b3f46" metalness={0.6} />
          </mesh>
        ))}
        <TextPanel p={[0, 2.2, 0.05]} w={3.2} h={0.8} text={'KERAVAN AUTOTORI\nKÄYTETYT AUTOT'} bg="#d4202a" />
        <TextPanel p={[0, 2.2, -0.05]} rotY={Math.PI} w={3.2} h={0.8} text={'KERAVAN AUTOTORI\nKÄYTETYT AUTOT'} bg="#d4202a" />
      </group>
    </group>
  );
}
