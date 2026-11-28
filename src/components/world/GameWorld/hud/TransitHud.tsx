import { TRAIN_FARE, TRAIN_FINE } from '../../../../game/world/savio';
import { BUS_FARE, type BusStop } from '../../../../game/world/transit';
import type { TrainStop } from '../gameWorld.types';
import type { useTransit } from '../systems/useTransit';

/** Destination menus at bus stops and train platforms, and the ride screen. */
export function TransitHud({ t, inWorld, busStops, trainStops }: { t: ReturnType<typeof useTransit>; inWorld: boolean; busStops: BusStop[]; trainStops: TrainStop[] }) {
  const { atBusStop, busRun, atTrain, trainRide, money, dodge, setDodge } = t;
  return (
    <>
      {inWorld && atBusStop && !busRun && (
        <div className="gym-hud bus-hud">
          <div className="gym-hud__title">🚌 Pysäkki: {atBusStop.name}</div>
          <div className="gym-hud__label">Minne mennään? Lippu {BUS_FARE} € · rahaa {money} €</div>
          <div className="bus-hud__list">
            {busStops
              .filter((b) => b.id !== atBusStop.id)
              .map((b) => (
                <button key={b.id} type="button" className="bus-hud__dest" onClick={() => t.takeBus(atBusStop, b)}>
                  {b.name}
                </button>
              ))}
          </div>
          <label className="bus-hud__dodge">
            <input type="checkbox" checked={dodge} onChange={(e) => setDodge(e.target.checked)} /> Matkusta pummilla (ilmainen, mutta tarkastaja voi heittää ulos)
          </label>
        </div>
      )}
      {inWorld && atTrain && !trainRide && (
        <div className="gym-hud bus-hud">
          <div className="gym-hud__title">🚆 {atTrain.name}: lähijunat</div>
          <div className="gym-hud__label">Lippu {TRAIN_FARE} € · rahaa {money} €</div>
          <div className="bus-hud__list">
            {trainStops
              .filter((s) => s.id !== atTrain.id)
              .map((s) => (
                <button key={s.id} type="button" className="bus-hud__dest" onClick={() => t.rideTrain(atTrain)}>
                  {s.name} (n. 3 min)
                </button>
              ))}
          </div>
          <label className="bus-hud__dodge">
            <input type="checkbox" checked={dodge} onChange={(e) => setDodge(e.target.checked)} /> Matkusta pummilla (tarkastusmaksu {TRAIN_FINE} €, jos jäät kiinni)
          </label>
        </div>
      )}
    </>
  );
}

export function TrainRide({ text }: { text: string }) {
  return (
    <div className="train-ride">
      <div className="train-ride__title">{text}</div>
      <div className="train-ride__bar"><span /></div>
      <div className="muted">Seuraava asema…</div>
    </div>
  );
}
