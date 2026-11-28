import type { MutableRefObject } from 'react';
import type { Player } from '../../../types/game';
import type { SceneId } from '../../../game/interiors/interiors';
import { INTERIORS } from '../../../game/interiors/interiors';
import type { IntroLine } from '../../../game/world/intro';
import type { WorldData } from '../../../game/world/worldData';
import type { BusStop } from '../../../game/world/transit';
import { DialogueBox, type DialogueView } from '../quest/DialogueBox';
import { JailHud, type JailLive } from '../quest/Jailbreak';
import { CookHud } from '../CookHud';
import type { TrainStop } from './gameWorld.types';
import type { useTransit } from './systems/useTransit';
import type { useTraining } from './systems/useTraining';
import type { useBarber } from './systems/useBarber';
import type { useShop } from './systems/useShop';
import type { useGraffiti } from './systems/useGraffiti';
import type { useCooking } from './systems/useCooking';
import { IntroOverlay } from './hud/IntroOverlay';
import { TransitHud, TrainRide } from './hud/TransitHud';
import { VenueHud } from './hud/VenueHud';
import { ShopOverlay } from './hud/ShopOverlay';
import { ArtHud } from './hud/ArtHud';
import { BuffBar } from './hud/BuffBar';

/** Everything drawn over the 3D view: intro, location, activity panels, dialogue, toasts. */
export function GameHUD(p: {
  world: WorldData | null;
  player: Player | null;
  scene: SceneId;
  cutscene: boolean;
  line: IntroLine | null;
  speaker: string | null;
  onSkip: () => void;
  dialogue: DialogueView | null;
  toast: string | null;
  fading: boolean;
  jailStep: number;
  jailLive: MutableRefObject<JailLive>;
  holdingRef: MutableRefObject<boolean>;
  onVisit: () => void;
  clockRef: MutableRefObject<number>;
  busStops: BusStop[];
  trainStops: TrainStop[];
  transit: ReturnType<typeof useTransit>;
  training: ReturnType<typeof useTraining>;
  barber: ReturnType<typeof useBarber>;
  shop: ReturnType<typeof useShop>;
  graffiti: ReturnType<typeof useGraffiti>;
  cooking: ReturnType<typeof useCooking>;
}) {
  const { world, player, scene, cutscene, dialogue, transit, cooking } = p;
  const inWorld = scene === 'world';
  const def = scene !== 'world' ? INTERIORS[scene] : null;
  const money = player?.money ?? 0;
  return (
    <>
      {!world && <div className="world-loading">Ladataan Keravaa…</div>}
      {cutscene && world && <IntroOverlay line={p.line} speaker={p.speaker} onSkip={p.onSkip} />}
      {!cutscene && (
        <>
          {def && <div className="location-tag">📍 {def.name}</div>}
          {scene === 'prison' && !dialogue && <JailHud step={p.jailStep} live={p.jailLive} holdingRef={p.holdingRef} onVisit={p.onVisit} />}
          <VenueHud scene={scene} t={p.training} b={p.barber} money={money} />
          <TransitHud t={transit} inWorld={inWorld} busStops={p.busStops} trainStops={p.trainStops} />
        </>
      )}
      {transit.trainRide && <TrainRide text={transit.trainRide} />}
      {!cutscene && (
        <>
          <ShopOverlay s={p.shop} scene={scene} inWorld={inWorld} dialogueOpen={!!dialogue} money={money} />
          {inWorld && cooking.atCook && player && (
            <CookHud
              name={cooking.atCook.name}
              level={cooking.cookLevel}
              inventory={player.inventory}
              cooking={cooking.cooking ? { recipe: cooking.cooking.recipe, progress: cooking.cookProgress } : null}
              onCook={cooking.startCook}
              onClose={() => cooking.setAtCook(null)}
            />
          )}
          <ArtHud g={p.graffiti} inWorld={inWorld} dialogueOpen={!!dialogue} clockRef={p.clockRef} />
          <BuffBar buffs={player?.buffs ?? []} strain={player?.strain ?? 0} />
        </>
      )}
      {dialogue && <DialogueBox view={dialogue} />}
      {p.toast && <div className="toast">{p.toast}</div>}
      <div className={`fade${p.fading ? ' is-on' : ''}`} />
      {!cutscene && inWorld && world?.source === 'placeholder' && (
        <div className="world-badge">Väliaikainen kartta · aja <code>npm run fetch:osm</code> saadaksesi oikean Keravan</div>
      )}
      {!cutscene && inWorld && world?.source === 'osm' && <div className="world-badge">© OpenStreetMap contributors</div>}
    </>
  );
}
