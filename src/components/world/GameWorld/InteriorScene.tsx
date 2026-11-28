import type { MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import { INTERIORS, POLICE_DESK_SPOT, type InteriorId } from '../../../game/interiors/interiors';
import { JAILBREAK_STEP } from '../../../game/quests/jailbreak';
import { ROINA_SPOT } from '../../../game/gym/roina';
import type { ShopDef } from '../../../game/shop/shop';
import type { LiftId } from '../../../game/gym/lifting';
import { ClickFloor, Hotspot } from '../interiors/kit';
import { TunnelInterior } from '../interiors/TunnelInterior';
import { StationInterior } from '../interiors/StationInterior';
import { PrismaInterior, Shopper, type ShelfProductsProps } from '../interiors/PrismaInterior';
import { PrisonInterior } from '../interiors/PrisonInterior';
import { GymInterior, type GymActive } from '../interiors/GymInterior';
import { PoolInterior } from '../interiors/PoolInterior';
import { AlepaInterior } from '../interiors/AlepaInterior';
import { BarberInterior } from '../interiors/BarberInterior';
import { PoliceInterior } from '../interiors/PoliceInterior';
import { KRautaInterior } from '../interiors/KRautaInterior';
import { MotonetInterior } from '../interiors/MotonetInterior';
import { FightGymInterior, type FightActive } from '../interiors/FightGymInterior';
import { FIGHT_SPOTS } from '../../../game/interiors/interiors';
import { PrisonGuards, type JailLive } from '../quest/Jailbreak';
import type { playerOutfit } from '../PlayerCharacter';
import { ROINA_TALK_SPOT } from './constants';

type Outfit = ReturnType<typeof playerOutfit>;

/** The current interior: its room, hotspots (exits, shelves, till, desk) and people in it. */
export function InteriorScene(props: {
  scene: InteriorId;
  shop: ShopDef | undefined;
  jailStep: number;
  putkaUntil: number | null;
  gymPairs: Record<LiftId, number[]>;
  gymActive: GymActive | null;
  swimT0: number | null;
  fightActive: FightActive | null;
  outfit: Outfit;
  clockRef: MutableRefObject<number>;
  playerRef: MutableRefObject<THREE.Vector3>;
  holdingRef: MutableRefObject<boolean>;
  jailLive: MutableRefObject<JailLive>;
  guardsFrozen: boolean;
  onCaught: () => void;
  onFiled: () => void;
  onGroundClick: (p: WorldXZ) => void;
  /** Clickable products on the Prisma shelves. */
  shelf: ShelfProductsProps;
}) {
  const { scene, shop, jailStep, putkaUntil, outfit, clockRef, onGroundClick } = props;
  const def = INTERIORS[scene];
  return (
    <group>
      <ClickFloor r={def.floor} invisible={scene === 'pool'} color={scene === 'prison' ? '#8f918c' : scene === 'tunnel' ? '#5d5f63' : scene === 'station' ? '#c9b48a' : '#d4d4cf'} onClick={onGroundClick} />
      {scene === 'tunnel' && <TunnelInterior />}
      {scene === 'station' && <StationInterior />}
      {scene === 'prisma' && <PrismaInterior shelf={props.shelf} />}
      {scene === 'gym' && <GymInterior pairs={props.gymPairs} active={props.gymActive} outfit={outfit} clockRef={clockRef} />}
      {scene === 'alepa' && <AlepaInterior />}
      {scene === 'barber' && <BarberInterior />}
      {scene === 'motonet' && <MotonetInterior />}
      {scene === 'krauta' && <KRautaInterior />}
      {scene === 'fightgym' && <FightGymInterior active={props.fightActive} outfit={outfit} clockRef={clockRef} />}
      {scene === 'fightgym' && (
        <>
          <Hotspot at={FIGHT_SPOTS.bag} label="🥊 Säkki" onClick={() => onGroundClick(FIGHT_SPOTS.bag)} />
          <Hotspot at={FIGHT_SPOTS.wrestle} label="🤼 Paini" onClick={() => onGroundClick(FIGHT_SPOTS.wrestle)} />
          <Hotspot at={FIGHT_SPOTS.spar} label="🥋 Sparri" onClick={() => onGroundClick(FIGHT_SPOTS.spar)} />
        </>
      )}
      {scene === 'police' && <PoliceInterior cellOpen={putkaUntil === null} />}
      {scene === 'pool' && <PoolInterior swimT0={props.swimT0} clockRef={clockRef} outfit={outfit} />}
      {scene === 'prison' && (
        <>
          <PrisonInterior barsCut={jailStep >= JAILBREAK_STEP.escape} progress={props.jailLive.current.progress} />
          <PrisonGuards
            step={jailStep}
            playerRef={props.playerRef}
            holdingRef={props.holdingRef}
            live={props.jailLive}
            frozen={props.guardsFrozen}
            onCaught={props.onCaught}
            onFiled={props.onFiled}
          />
        </>
      )}
      {def.exits.map((e) => (
        <Hotspot key={e.id} at={e.at} label={e.label} onClick={() => onGroundClick(e.at)} />
      ))}
      {shop?.shelves.map((sh) => <Hotspot key={sh.id} at={sh.at} label={`🛒 ${sh.name}`} onClick={() => onGroundClick(sh.at)} />)}
      {shop && (
        <Shopper p={shop.guard} yaw={Math.PI * 0.85} sway={1.3} outfit={{ top: '#1b1d22', legs: '#1b1d22', shoes: '#111', hair: '#2a2018', hairStyle: 'buzz', hat: 'none', hatColor: '#000', accent: '#ffd23f', style: 'jacket', build: 1.12 }} />
      )}
      {shop && <Hotspot at={shop.till} label="🧾 Kassa" onClick={() => onGroundClick(shop.till)} />}
      {scene === 'gym' && (
        <>
          <Shopper p={ROINA_SPOT} yaw={-2.2} sway={0.7} outfit={{ top: '#14171f', legs: '#3c4a63', shoes: '#f2f2f2', skin: '#e0ac7e', hair: '#1a1410', hairStyle: 'buzz', facialHair: 'goatee', hat: 'cap', hatColor: '#c8312b', accent: '#ffd23f', style: 'hoodie', build: 1.1, muscle: 1, fat: 0.15 }} />
          <Hotspot at={ROINA_TALK_SPOT} label="🧴 Pumppi-Pete" onClick={() => onGroundClick(ROINA_TALK_SPOT)} />
        </>
      )}
      {scene === 'police' && <Hotspot at={POLICE_DESK_SPOT} label="👮 Palvelutiski" onClick={() => onGroundClick(POLICE_DESK_SPOT)} />}
    </group>
  );
}
