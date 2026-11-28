import { useEffect, useMemo, useRef, useState } from 'react';
import { CAR_MODELS, CAR_RESALE, carProbe, crashHurt, kmh, type CarModelId, type CarState } from '../../../../game/vehicle/cars';
import { worldToLngLat, type WorldXZ } from '../../../../game/world/projection';
import { sfx } from '../../../../audio';
import type { GameCtx, Spot } from '../gameWorld.types';
import type { WorldSetup } from '../useWorldSetup';

const fmt = (n: number) => n.toLocaleString('fi-FI');

/**
 * Own car: buy one at the used-car lot beside Motonet, walk up to it and press
 * E to drive, E again to step out. The car stays where you park it (saved).
 */
export function useDriving(ctx: GameCtx, w: WorldSetup) {
  const { player, dispatch, scene, positionRef, say, close, setToast, setPlayerVisible, setRoute } = ctx;
  const [driving, setDriving] = useState(false);
  const [speed, setSpeed] = useState(0);
  const car = player?.car;
  const carRef = useRef<CarState>({ x: car?.x ?? 0, z: car?.z ?? 0, yaw: car?.yaw ?? 0, speed: 0, steer: 0 });
  // keep the parked car where the save says (a new purchase, a reload)
  useEffect(() => {
    if (!driving && car) carRef.current = { x: car.x, z: car.z, yaw: car.yaw, speed: 0, steer: 0 };
  }, [car?.x, car?.z, car?.yaw, car?.model, driving]);

  const blocked = useMemo(() => (x: number, z: number) => !!w.collider?.isBlocked([x, z]) || !!w.extraBlocked?.([x, z], [x, z]), [w.collider, w.extraBlocked]);
  const carFits = (s: { x: number; z: number; yaw: number }) => !carProbe(s).some(([x, z]) => blocked(x, z));

  // the lot: on the Motonet forecourt, a little to the side of the door
  const lot = useMemo(() => {
    const d = w.doors?.motonet;
    if (!d) return null;
    const [ox, oz] = d.outward;
    const yaw = Math.atan2(-oz, ox); // cars stand side by side facing along the shop front
    for (const k of [20, 26, 32, 14, 38])
      for (const side of [14, -14, 22, -22, 8, -8]) {
        const at: WorldXZ = [d.at[0] + ox * k - oz * side, d.at[1] + oz * k + ox * side];
        if (carFits({ x: at[0], z: at[1], yaw })) return { at, yaw, sign: [d.at[0] + ox * (k - 4) - oz * side, d.at[1] + oz * (k - 4) + ox * side] as WorldXZ, outward: d.outward };
      }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.doors, blocked]);

  const lotMenu = () => {
    if (!player || !lot) return;
    const bye = { text: 'Katselen vain.', onPick: close };
    if (player.car) {
      const m = CAR_MODELS[player.car.model];
      const value = Math.round(m.price * CAR_RESALE);
      say('🚗 Keravan Autotori', `Myyjä nojaa kaiteeseen. "${m.name}? Annan siitä ${fmt(value)} €, käteisellä." Yksi auto kerrallaan, sanoo hän, piha on pieni.`, [
        { text: `Myy auto (${fmt(value)} €)`, onPick: () => (driving ? setToast('Nouse ensin autosta.') : (dispatch({ type: 'sellCar', value }), close(), setToast(`🚗 Myit auton: +${fmt(value)} €`))) },
        bye,
      ]);
      return;
    }
    const options = (Object.keys(CAR_MODELS) as CarModelId[]).map((id) => {
      const m = CAR_MODELS[id];
      return {
        text: `${m.name}: ${fmt(m.price)} € (huippu ${kmh(m.top)} km/h)`,
        onPick: () => {
          if (player.money < m.price) return setToast(`Tarvitset ${fmt(m.price)} €.`);
          const color = m.colors[Math.floor(Math.random() * m.colors.length)]!;
          dispatch({ type: 'buyCar', model: id, color, price: m.price, at: { x: lot.at[0], z: lot.at[1], yaw: lot.yaw } });
          close();
          sfx('ignition', { delay: 0.6 });
          setToast(`🚗 ${m.name} on nyt sinun! ${m.blurb} Mene autolle ja paina E.`);
        },
      };
    });
    say('🚗 Keravan Autotori', 'Käytettyjä autoja, rehellisiä hintoja. "Kaikki katsastettu", myyjä sanoo, eikä katso silmiin. Ajokortti oletetaan.', [...options, bye]);
  };

  const enter = () => {
    if (!player?.car || driving) return;
    const p = positionRef.current;
    if (Math.hypot(p.x - carRef.current.x, p.z - carRef.current.z) > 6) return setToast('Mene lähemmäs autoa.');
    close();
    setRoute([]);
    sfx('carDoor');
    sfx('ignition', { delay: 0.3 });
    setPlayerVisible(false);
    setDriving(true);
    setToast(`🚗 W/S kaasu ja jarru · A/D ohjaus · välilyönti käsijarru · E nousee autosta`);
  };

  const exit = () => {
    if (!driving) return;
    const s = carRef.current;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    // the driver's door is on the left; try there, then the right, then behind
    const tries: WorldXZ[] = [[s.x + fz * 1.8, s.z - fx * 1.8], [s.x - fz * 1.8, s.z + fx * 1.8], [s.x - fx * 3.2, s.z - fz * 3.2], [s.x + fx * 3.2, s.z + fz * 3.2]];
    const out = tries.find(([x, z]) => !blocked(x, z)) ?? [s.x, s.z];
    const p = positionRef.current;
    p.x = out[0];
    p.z = out[1];
    carRef.current = { ...s, speed: 0, steer: 0 };
    dispatch({ type: 'parkCar', x: s.x, z: s.z, yaw: s.yaw });
    dispatch({ type: 'movePlayer', position: worldToLngLat(out) });
    sfx('carDoor');
    setDriving(false);
    setSpeed(0);
    setPlayerVisible(true);
  };

  // E steps out (the usual E is locked while driving); leaving the world parks the car
  const exitRef = useRef(exit);
  exitRef.current = exit;
  useEffect(() => {
    if (!driving) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'e' && !e.repeat) exitRef.current();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [driving]);
  useEffect(() => {
    if (driving && scene !== 'world') exitRef.current();
  }, [scene, driving]);

  const lastSpeedUi = useRef(0);
  const onSpeed = (v: number) => {
    const now = performance.now();
    if (now - lastSpeedUi.current < 150) return;
    lastSpeedUi.current = now;
    setSpeed(v);
  };
  const onCrash = (impact: number) => {
    sfx('crash', { gain: Math.min(1, impact / 15) });
    const hurt = crashHurt(impact);
    if (hurt) {
      dispatch({ type: 'adjustStats', health: -hurt });
      setToast(`💥 Kolari ${kmh(impact)} km/h! −${hurt} HP`);
    }
  };

  const spots: Spot[] = [];
  if (scene === 'world' && lot) spots.push({ at: lot.sign, label: '🚗 Keravan Autotori', info: 'Käytettyjen autojen myynti Motonetin pihalla.', use: lotMenu });
  if (scene === 'world' && car && !driving) spots.push({ at: [carRef.current.x, carRef.current.z], label: `🚗 ${CAR_MODELS[car.model].name}`, info: 'Oma auto. Käytä noustaksesi kyytiin.', use: enter });

  return { driving, speed, carRef, blocked, lot, spots, enter, exit, onSpeed, onCrash };
}
