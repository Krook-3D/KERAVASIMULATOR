import { useEffect, useRef, useState, type ReactNode } from 'react';

const W = 512;
const H = 256;

/** Freehand spray painting on a wall patch. The paint layer is transparent so it can go on the wall as a decal. */
export function GraffitiCanvas({ palette, wallColor = '#b9b4aa', info, onDone, onCancel }: {
  palette: { id: string; color: string; name: string }[];
  wallColor?: string;
  info?: ReactNode;
  onDone: (img: string, coverage: number, usedCans: string[]) => void;
  onCancel: () => void;
}) {
  const bg = useRef<HTMLCanvasElement>(null);
  const paint = useRef<HTMLCanvasElement>(null);
  const [can, setCan] = useState(palette[0]?.id ?? '');
  const [size, setSize] = useState(14);
  const used = useRef(new Map<string, number>());
  const down = useRef(false);
  const last = useRef<[number, number] | null>(null);
  const colorOf = (id: string) => palette.find((p) => p.id === id)?.color ?? '#000';

  // the wall behind: plaster with grain and some old stains
  useEffect(() => {
    const c = bg.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = wallColor;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`;
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    c.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let y = 32; y < H; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
  }, [wallColor]);

  const spray = (x: number, y: number) => {
    const c = paint.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = colorOf(can);
    const r = size;
    const n = Math.round(r * 2.2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 1.6) * r;
      c.globalAlpha = 0.35 + Math.random() * 0.5;
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.random() * 1.4 + 0.6, 0, Math.PI * 2);
      c.fill();
    }
    // the occasional drip
    if (Math.random() < 0.012 * (r / 10)) {
      c.globalAlpha = 0.8;
      c.fillRect(x - 1, y, 2.2, 8 + Math.random() * 26);
    }
    c.globalAlpha = 1;
    used.current.set(can, (used.current.get(can) ?? 0) + 1);
  };

  const at = (e: React.PointerEvent): [number, number] => {
    const r = paint.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const stroke = (e: React.PointerEvent) => {
    const p = at(e);
    const l = last.current;
    if (l) {
      const d = Math.hypot(p[0] - l[0], p[1] - l[1]);
      const steps = Math.max(1, Math.floor(d / (size * 0.4)));
      for (let i = 1; i <= steps; i++) spray(l[0] + ((p[0] - l[0]) * i) / steps, l[1] + ((p[1] - l[1]) * i) / steps);
    } else spray(p[0], p[1]);
    last.current = p;
  };

  const finish = () => {
    const cv = paint.current;
    if (!cv) return;
    const data = cv.getContext('2d')!.getImageData(0, 0, W, H).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i]! > 40) filled++;
    const coverage = filled / (data.length / 16);
    let img = cv.toDataURL('image/webp', 0.82);
    if (!img.startsWith('data:image/webp')) img = cv.toDataURL('image/png');
    const cans = [...used.current.entries()].filter(([, n]) => n > 25).map(([id]) => id);
    onDone(img, coverage, cans);
  };
  const clear = () => {
    paint.current?.getContext('2d')?.clearRect(0, 0, W, H);
    used.current.clear();
  };

  return (
    <div className="graffiti" onContextMenu={(e) => e.preventDefault()}>
      <div className="graffiti__head">
        <strong>🎨 Graffiti</strong>
        <span className="muted">Paina ja vedä hiirellä · sävy tölkeistä</span>
      </div>
      <div className="graffiti__stage">
        <canvas ref={bg} width={W} height={H} className="graffiti__canvas" />
        <canvas
          ref={paint}
          width={W}
          height={H}
          className="graffiti__canvas graffiti__canvas--paint"
          onPointerDown={(e) => {
            down.current = true;
            last.current = null;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            stroke(e);
          }}
          onPointerMove={(e) => down.current && stroke(e)}
          onPointerUp={() => {
            down.current = false;
            last.current = null;
          }}
        />
      </div>
      <div className="graffiti__tools">
        {palette.map((p) => (
          <button key={p.id} type="button" title={p.name} className={`graffiti__can${can === p.id ? ' is-on' : ''}`} style={{ background: p.color }} onClick={() => setCan(p.id)} />
        ))}
        <label className="graffiti__size">
          Suutin
          <input type="range" min={4} max={34} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      </div>
      {info && <div className="graffiti__info">{info}</div>}
      <div className="gym-hud__actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>Lopeta</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={clear}>Tyhjennä</button>
        <button type="button" className="btn btn--small" onClick={finish}>Valmis ✓</button>
      </div>
    </div>
  );
}
