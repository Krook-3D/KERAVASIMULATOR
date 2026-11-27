import type { MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { WorldXZ } from '../../../game/world/projection';
import { stationGroundHeight } from '../../../game/world/station';
import type { Cloud } from '../../../game/world/streetProps';
import { KeravaWorld } from '../KeravaWorld';
import { Station } from '../Station';
import { Train } from '../Train';
import { Clouds } from '../StreetProps';
import { Birds } from '../Birds';
import { GroundDetail } from '../GroundDetail';
import { BusStopModel, BusVehicle, type BusRun } from '../Bus';
import { BlockExterior, PrismaExterior, PrisonExterior, SavioStationModel } from '../Landmarks';
import { Hotspot } from '../interiors/kit';
import type { XrayUniforms } from '../materials';
import { PRISON_AT, TOWN_SIGNS } from './constants';
import type { WorldSetup } from './useWorldSetup';

/**
 * The town itself: terrain, roads, buildings, the station and train, the
 * landmark exteriors, bus and train stops and the door hotspots.
 * Only rendered once the world is ready.
 */
export function GameMap({ w, clouds, xray, highQuality, cutscene, playerRef, clockRef, busRun, onGroundClick }: {
  w: WorldSetup;
  clouds: Cloud[];
  xray: XrayUniforms;
  highQuality: boolean;
  cutscene: boolean;
  playerRef: MutableRefObject<THREE.Vector3>;
  clockRef: MutableRefObject<number>;
  busRun: BusRun | null;
  onGroundClick: (p: WorldXZ) => void;
}) {
  const world = w.world!, terrain = w.terrain!, layout = w.layout!, placed = w.placed;
  const ground = (p: WorldXZ) => terrain.surfaceAt(p[0], p[1]);
  return (
    <>
      <Clouds clouds={clouds} />
      <Birds followRef={playerRef} />
      <KeravaWorld data={world} terrain={terrain} collider={w.collider!} excludeTrees={w.excludeTrees} playerRef={playerRef} xray={xray} onGroundClick={onGroundClick} />
      <Station layout={layout} xray={xray} />
      <Train layout={layout} clockRef={clockRef} />
      <PrismaExterior site={w.prisma!.site} ground={ground(w.prisma!.site.door)} />
      {w.busStops.map((b) => (
        <BusStopModel key={b.id} stop={b} ground={ground(b.at)} />
      ))}
      {!cutscene && w.busStops.map((b) => <Hotspot key={b.id} at={b.at} y={ground(b.at)} label={`🚌 ${b.name}`} onClick={() => onGroundClick(b.at)} />)}
      {placed && <SavioStationModel centre={placed.savio.centre} dir={placed.savio.dir} side={placed.savio.side} ground={ground(placed.savio.wait)} />}
      {placed && TOWN_SIGNS.map((b) => (
        <BlockExterior key={b.key} site={placed[b.key]} ground={ground(placed[b.key].door)} sign={b.sign} color={b.color} sub={b.sub} />
      ))}
      {!cutscene &&
        w.trainStops.map((t) => (
          <Hotspot key={t.id} at={t.at} y={stationGroundHeight(layout, t.at, ground(t.at))} label="🚆 Lähijuna" onClick={() => onGroundClick(t.at)} />
        ))}
      {busRun && <BusVehicle run={busRun} clockRef={clockRef} groundAt={(x, z) => terrain.surfaceAt(x, z)} />}
      {highQuality && <GroundDetail data={world} terrain={terrain} blocked={w.grassBlocked} playerRef={playerRef} />}
      <PrisonExterior at={PRISON_AT} yaw={0} ground={terrain.surfaceAt(PRISON_AT[0], PRISON_AT[1] + 8)} />
      {!cutscene &&
        Object.values(w.doors!).map((d) => (
          <Hotspot key={d.id} at={d.at} y={stationGroundHeight(layout, d.at, ground(d.at))} label={d.label} onClick={() => onGroundClick(d.at)} />
        ))}
    </>
  );
}
