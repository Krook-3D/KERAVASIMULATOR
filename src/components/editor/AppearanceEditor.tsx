import { useState } from 'react';
import {
  CLOTH_COLORS,
  EYE_COLORS,
  FACIAL_HAIR,
  FACIAL_HAIR_NAMES,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_NAMES,
  SKIN_TONES,
  type Appearance,
} from '../../game/player/appearance';

type Tab = 'body' | 'head' | 'clothes';

function Swatches({ colors, value, onPick, label }: { colors: readonly string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div className="ed__field">
      <span className="ed__label">{label}</span>
      <div className="ed__swatches" role="radiogroup" aria-label={label}>
        {colors.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === value} aria-label={c} className={`ed__swatch${c === value ? ' is-on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} />
        ))}
        <input type="color" className="ed__custom" value={value} onChange={(e) => onPick(e.target.value)} title="Oma sävy" aria-label={`${label}: oma sävy`} />
      </div>
    </div>
  );
}

function Choices<T extends string>({ options, names, value, onPick, label }: { options: readonly T[]; names: Record<T, string>; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div className="ed__field">
      <span className="ed__label">{label}</span>
      <div className="ed__chips">
        {options.map((o) => (
          <button key={o} type="button" className={`ed__chip${o === value ? ' is-on' : ''}`} onClick={() => onPick(o)}>
            {names[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, left, right }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; left: string; right: string }) {
  return (
    <label className="ed__field">
      <span className="ed__label">{label}</span>
      <div className="ed__slider">
        <span>{left}</span>
        <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(+e.target.value)} />
        <span>{right}</span>
      </div>
    </label>
  );
}

/**
 * Detailed look editor. `only="hair"` limits it to what the barber can change.
 */
export function AppearanceEditor({ value, onChange, only, onTab }: { value: Appearance; onChange: (a: Appearance) => void; only?: 'hair'; onTab?: (t: Tab) => void }) {
  const [tab, setTabState] = useState<Tab>(only ? 'head' : 'body');
  const setTab = (t: Tab) => {
    setTabState(t);
    onTab?.(t);
  };
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="ed">
      {!only && (
        <div className="ed__tabs" role="tablist">
          {(
            [
              ['body', 'Keho'],
              ['head', 'Pää'],
              ['clothes', 'Vaatteet'],
            ] as const
          ).map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ed__tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
              {name}
            </button>
          ))}
        </div>
      )}
      {tab === 'body' && (
        <>
          <Swatches label="Ihonväri" colors={SKIN_TONES} value={value.skin} onPick={(c) => set('skin', c)} />
          <Slider label="Ruumiinrakenne" value={value.build} min={0.9} max={1.15} onChange={(v) => set('build', v)} left="Hoikka" right="Jässikkä" />
          <Slider label="Pituus" value={value.height} min={0.92} max={1.08} onChange={(v) => set('height', v)} left="Lyhyt" right="Pitkä" />
        </>
      )}
      {tab === 'head' && (
        <>
          <Choices label="Kampaus" options={HAIR_STYLES} names={HAIR_STYLE_NAMES} value={value.hairStyle} onPick={(v) => set('hairStyle', v)} />
          <Swatches label="Hiusten väri" colors={HAIR_COLORS} value={value.hair} onPick={(c) => set('hair', c)} />
          <Choices label="Parta" options={FACIAL_HAIR} names={FACIAL_HAIR_NAMES} value={value.facialHair} onPick={(v) => set('facialHair', v)} />
          {!only && (
            <>
              <Swatches label="Silmät" colors={EYE_COLORS} value={value.eyes} onPick={(c) => set('eyes', c)} />
              <label className="ed__check">
                <input type="checkbox" checked={value.glasses} onChange={(e) => set('glasses', e.target.checked)} /> Aurinkolasit
              </label>
            </>
          )}
        </>
      )}
      {tab === 'clothes' && (
        <>
          <Choices label="Takki" options={['suit', 'hoodie', 'jacket'] as const} names={{ suit: 'Puku', hoodie: 'Huppari', jacket: 'Takki' }} value={value.topStyle} onPick={(v) => set('topStyle', v)} />
          <Swatches label="Paidan väri" colors={CLOTH_COLORS} value={value.top} onPick={(c) => set('top', c)} />
          <Swatches label="Housut" colors={['#2e3b55', '#14171f', '#3b4a6b', '#6b4a2e', '#8a8f96', '#2e6b4f', '#c8c0aa']} value={value.legs} onPick={(c) => set('legs', c)} />
          <Swatches label="Kengät" colors={['#f4f4f0', '#14171f', '#8a5a32', '#c8312b', '#3a7bd5']} value={value.shoes} onPick={(c) => set('shoes', c)} />
          <Choices label="Päähine" options={['beanie', 'cap', 'none'] as const} names={{ beanie: 'Pipo', cap: 'Lippis', none: 'Ei mitään' }} value={value.hat} onPick={(v) => set('hat', v)} />
          {value.hat !== 'none' && <Swatches label="Päähineen väri" colors={CLOTH_COLORS} value={value.hatColor} onPick={(c) => set('hatColor', c)} />}
          <Swatches label="Korostusväri (narut, tupsu)" colors={CLOTH_COLORS} value={value.accent} onPick={(c) => set('accent', c)} />
          <label className="ed__check">
            <input type="checkbox" checked={value.backpack} onChange={(e) => set('backpack', e.target.checked)} /> Reppu selässä
          </label>
        </>
      )}
    </div>
  );
}
