import { useState } from 'react';
import { TRAIN_DODGE_CATCH, TRAIN_FARE, TRAIN_FINE } from '../../../../game/world/savio';
import { BUS_FARE, FARE_DODGE_CATCH, inspectorDropStop, type BusStop } from '../../../../game/world/transit';
import { BUS_ARRIVE, type BusRun } from '../../Bus';
import type { GameCtx, TrainStop } from '../gameWorld.types';

/** Buses between town stops and the local train Kerava <-> Savio, with fare dodging. */
export function useTransit(ctx: GameCtx, busStops: BusStop[], trainStops: TrainStop[]) {
  const { player, dispatch, clockRef, setRoute, setToast, setFading, setPlayerVisible, teleport } = ctx;
  const [atBusStop, setAtBusStop] = useState<BusStop | null>(null);
  const [busRun, setBusRun] = useState<BusRun | null>(null);
  const [dodge, setDodge] = useState(false);
  const [atTrain, setAtTrain] = useState<TrainStop | null>(null);
  const [trainRide, setTrainRide] = useState<string | null>(null);
  const riding = !!busRun;
  const money = player?.money ?? 0;

  const takeBus = (from: BusStop, to: BusStop) => {
    const pay = !dodge;
    if (pay && money < BUS_FARE) {
      setToast(`Lippu maksaa ${BUS_FARE} €. Rahat ei riitä.`);
      return;
    }
    setAtBusStop(null);
    setRoute([]);
    setBusRun({ stop: from, mode: 'in', t0: clockRef.current, dest: to.name.toUpperCase() });
    window.setTimeout(() => {
      // board
      setPlayerVisible(false);
      if (pay) dispatch({ type: 'adjustStats', money: -BUS_FARE });
      setBusRun({ stop: from, mode: 'out', t0: clockRef.current, dest: to.name.toUpperCase() });
      const caught = !pay && Math.random() < FARE_DODGE_CATCH;
      const end = caught ? (inspectorDropStop(busStops, from.id, to.id, Math.random()) ?? to) : to;
      window.setTimeout(() => {
        teleport('world', end.at);
        window.setTimeout(() => {
          setBusRun({ stop: end, mode: 'wait', t0: clockRef.current, dest: to.name.toUpperCase() });
          setPlayerVisible(true);
          setToast(caught ? `Lipuntarkastus! Sinut heitettiin ulos pysäkillä ${end.name}. Voihan vittu.` : `🚌 Perillä: ${end.name}${pay ? ` (−${BUS_FARE} €)` : ' · pummilla, onnistui!'}`);
          window.setTimeout(() => setBusRun({ stop: end, mode: 'out', t0: clockRef.current, dest: to.name.toUpperCase() }), 1500);
          window.setTimeout(() => setBusRun(null), 7000);
        }, 450);
      }, 2200);
    }, (BUS_ARRIVE + 0.6) * 1000);
  };

  const rideTrain = (from: TrainStop) => {
    const to = trainStops.find((t) => t.id !== from.id);
    if (!to) return;
    if (!dodge && money < TRAIN_FARE) {
      setToast(`Lippu maksaa ${TRAIN_FARE} €. Rahat ei riitä.`);
      return;
    }
    setAtTrain(null);
    setRoute([]);
    setFading(true);
    window.setTimeout(() => {
      setTrainRide(`🚆 Lähijuna ${from.name} → ${to.name}`);
      setPlayerVisible(false);
    }, 300);
    const caught = dodge && Math.random() < TRAIN_DODGE_CATCH;
    window.setTimeout(() => {
      setTrainRide(null);
      setPlayerVisible(true);
      teleport('world', to.at);
      if (!dodge) dispatch({ type: 'adjustStats', money: -TRAIN_FARE });
      if (caught) dispatch({ type: 'adjustStats', money: -TRAIN_FINE });
      window.setTimeout(
        () =>
          setToast(
            caught
              ? `Lipuntarkastus! Tarkastusmaksu ${TRAIN_FINE} €. Tuttu tunne… voihan vittu.`
              : `🚆 Perillä: ${to.name}${dodge ? ' · pummilla, kukaan ei kysellyt' : ` (−${TRAIN_FARE} €)`}`,
          ),
        600,
      );
    }, 3600);
  };

  return { atBusStop, setAtBusStop, busRun, riding, dodge, setDodge, takeBus, atTrain, setAtTrain, trainRide, rideTrain, money };
}
