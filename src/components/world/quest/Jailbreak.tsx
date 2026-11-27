import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { atBars, deskGuard, escapeSeen, filingDangerSoon, filingNoticed, patrolGuard } from '../../../game/quests/guards';
import { FILE_TIME, JAILBREAK_STEP } from '../../../game/quests/jailbreak';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, posePhone, resetPose } from '../humanoid/animate';

/** Live minigame state shared between the 3D scene and the DOM HUD. */
export interface JailLive {
  progress: number;
  atBars: boolean;
  danger: boolean;
  seen: boolean;
  deskWarn: boolean;
  deskLooking: boolean;
  /** Guard clock (s). */
  t: number;
}

export const newJailLive = (): JailLive => ({ progress: 0, atBars: false, danger: false, seen: false, deskWarn: false, deskLooking: false, t: 0 });

const GUARD: Outfit = { top: '#2b3a4a', legs: '#1a2238', shoes: '#111', hair: '#3b2a1e', skin: '#e8b892', hat: 'cap', hatColor: '#2b3a4a', accent: '#d9b44a', style: 'jacket', build: 1.12 };
const DESK: Outfit = { ...GUARD, hat: 'none', hair: '#8a8a8a', prop: 'phone', build: 1.18 };

function Cone({ angle, range, color }: { angle: number; range: number; color: string }) {
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(range, 24, Math.PI / 2 - angle, angle * 2);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [angle, range]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position-y={0.03} rotation-y={Math.PI}>
      <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

interface GuardsProps {
  step: number;
  playerRef: MutableRefObject<THREE.Vector3>;
  holdingRef: MutableRefObject<boolean>;
  live: MutableRefObject<JailLive>;
  frozen: boolean;
  onCaught: () => void;
  onFiled: () => void;
}

/** Guards, their vision cones and the filing / sneaking rules. */
export function PrisonGuards({ step, playerRef, holdingRef, live, frozen, onCaught, onFiled }: GuardsProps) {
  const patrol = useRef<THREE.Group>(null);
  const desk = useRef<THREE.Group>(null);
  const patrolBones = useRef<HumanBones | null>(null);
  const deskBones = useRef<HumanBones | null>(null);
  const deskCone = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame((_, dt) => {
    const L = live.current;
    if (!frozen) L.t += Math.min(dt, 0.1);
    const t = L.t;
    const pg = patrolGuard(t);
    const dg = deskGuard(t);
    if (patrol.current) {
      patrol.current.position.set(pg.x, 0, pg.z);
      patrol.current.rotation.y = pg.yaw;
    }
    if (desk.current) desk.current.rotation.y = dg.yaw + (dg.looking ? 0 : 0.35);
    if (deskCone.current) deskCone.current.visible = dg.looking || dg.warn;
    phase.current += dt * 7 * (pg.walking ? 1 : 0);
    if (patrolBones.current) {
      resetPose(patrolBones.current);
      poseLocomotion(patrolBones.current, phase.current, pg.walking ? 0.45 : 0, t);
    }
    if (deskBones.current) {
      const b = deskBones.current;
      resetPose(b);
      poseLocomotion(b, 0, 0, t);
      if (!dg.looking && !dg.warn) posePhone(b, t);
      else if (dg.warn) {
        b.upperArmL.rotation.set(-2.6, 0, 0.3);
        b.upperArmR.rotation.set(-2.6, 0, -0.3);
        b.forearmL.rotation.x = -1;
        b.forearmR.rotation.x = -1;
      }
      // sitting
      b.hips.position.y = 0.55;
      b.thighL.rotation.x = -1.5;
      b.thighR.rotation.x = -1.5;
      b.shinL.rotation.x = 1.5;
      b.shinR.rotation.x = 1.5;
    }

    const p = playerRef.current;
    const pos: [number, number] = [p.x, p.z];
    L.atBars = atBars(pos);
    L.deskWarn = dg.warn;
    L.deskLooking = dg.looking;
    L.seen = false;
    L.danger = false;
    if (frozen) return;

    if (step === JAILBREAK_STEP.file) {
      L.danger = filingDangerSoon(t);
      const filing = holdingRef.current && L.atBars;
      if (filing) {
        if (filingNoticed(t)) {
          L.seen = true;
          onCaught();
          return;
        }
        L.progress = Math.min(1, L.progress + dt / FILE_TIME);
        if (L.progress >= 1) onFiled();
      }
    } else if (step === JAILBREAK_STEP.escape) {
      const outOfCell = p.z > -1.5;
      L.danger = escapeSeen(t + 0.8, pos) && outOfCell;
      if (outOfCell && escapeSeen(t, pos)) {
        L.seen = true;
        onCaught();
      }
    }
  });

  return (
    <group>
      <group ref={patrol}>
        <Humanoid outfit={GUARD} bonesRef={patrolBones} />
        <Cone angle={(55 * Math.PI) / 180} range={10} color="#ff4d4d" />
      </group>
      <group ref={desk} position={[13.2, 0, -2.6]}>
        <Humanoid outfit={DESK} bonesRef={deskBones} />
        <group ref={deskCone}>
          <Cone angle={0.5} range={14} color="#ffb43c" />
        </group>
      </group>
    </group>
  );
}

/** DOM overlay for the jail: objective, visit button, filing bar and guard status. */
export function JailHud({ step, live, holdingRef, onVisit }: { step: number; live: MutableRefObject<JailLive>; holdingRef: MutableRefObject<boolean>; onVisit: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        holdingRef.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') holdingRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      holdingRef.current = false;
    };
  }, [holdingRef]);
  const L = live.current;
  const hold = (v: boolean) => () => {
    holdingRef.current = v;
  };

  return (
    <div className="jail-hud">
      {step === JAILBREAK_STEP.visit && (
        <>
          <p className="jail-hud__goal">Istut sellissä B2. Serkku Pasi lupasi tulla tapaamaan.</p>
          <button type="button" className="btn" onClick={onVisit}>
            Pyydä tapaamista
          </button>
        </>
      )}
      {step === JAILBREAK_STEP.file && (
        <>
          <p className="jail-hud__goal">Viilaa kalterit poikki. Jos vartija näkee, jäät kiinni.</p>
          <div className="jail-hud__bar">
            <div style={{ width: `${Math.round(L.progress * 100)}%` }} />
            <span>Kalterit {Math.round(L.progress * 100)}%</span>
          </div>
          <div className={`jail-hud__status ${L.danger ? 'is-danger' : 'is-safe'}`}>{L.danger ? '❗ Vartija tulee! Lopeta viilaus' : '👂 Käytävä on hiljainen'}</div>
          {L.atBars ? (
            <button
              type="button"
              className="btn jail-hud__file"
              onPointerDown={hold(true)}
              onPointerUp={hold(false)}
              onPointerLeave={hold(false)}
            >
              Pidä pohjassa: viilaa (tai välilyönti)
            </button>
          ) : (
            <p className="muted">Kävele kaltereiden luo viilaamaan.</p>
          )}
        </>
      )}
      {step === JAILBREAK_STEP.escape && (
        <>
          <p className="jail-hud__goal">Kalterit poikki! Hiivi käytävän päähän ovelle ➜ kun kumpikaan vartija ei katso.</p>
          <div className={`jail-hud__status ${L.danger ? 'is-danger' : 'is-safe'}`}>{L.danger ? '👁 Sinut nähdään kohta!' : 'Varjoissa'}</div>
          <div className={`jail-hud__status ${L.deskLooking ? 'is-danger' : L.deskWarn ? 'is-warn' : 'is-safe'}`}>
            Pöytävartija: {L.deskLooking ? 'katsoo käytävälle' : L.deskWarn ? 'venyttelee… kohta katsoo' : 'puhelimella'}
          </div>
        </>
      )}
    </div>
  );
}
