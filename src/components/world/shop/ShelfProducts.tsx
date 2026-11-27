import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { itemIcon, itemName } from '../../../data/items';
import { priceOf, type Shelf } from '../../../game/shop/shop';
import { buildItemModel, disposeItemModel } from '../items/itemModels';

type V3 = [number, number, number];

/**
 * Where each shelf shows its real products: the first product's spot, the
 * direction the row runs and which way the products face (yaw).
 */
export interface ShelfDisplay {
  origin: V3;
  along: 'x' | 'z';
  yaw: number;
}

export interface PickedProduct {
  shelfId: string;
  itemId: string;
}

const GAP = 0.42;
const SCALE = 1.7;
const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** Product position on the shelf, centred on the display origin. */
function slot(d: ShelfDisplay, i: number, n: number): V3 {
  const off = (i - (n - 1) / 2) * GAP;
  return d.along === 'x' ? [d.origin[0] + off, d.origin[1], d.origin[2]] : [d.origin[0], d.origin[1], d.origin[2] + off];
}

function Product({ itemId, p, yaw, lit, onPick }: { itemId: string; p: V3; yaw: number; lit: boolean; onPick: () => void }) {
  const model = useMemo(() => buildItemModel(itemId), [itemId]);
  useEffect(() => () => disposeItemModel(model), [model]);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!hover) return;
    document.body.style.cursor = 'pointer';
    return () => void (document.body.style.cursor = '');
  }, [hover]);
  const s = SCALE * (hover || lit ? 1.25 : 1);
  return (
    <group
      position={p}
      rotation-y={yaw}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {/* invisible, slightly bigger hit box so small items are easy to click */}
      <mesh position-y={0.15}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <primitive object={model} scale={s} position-y={0.25} />
      {hover && !lit && (
        <Html position={[0, 0.5, 0]} center className="shelf-tag" zIndexRange={[40, 30]}>
          {itemIcon(itemId)} {itemName(itemId)} · {eur(priceOf(itemId))}
        </Html>
      )}
    </group>
  );
}

/**
 * The shelf's own products as clickable 3D items: click one to walk to the
 * shelf and choose "to basket" or "steal into pocket" right there.
 */
export function ShelfProducts({ shelves, displays, picked, atShelfId, inBasket, onPick, onBasket, onSteal }: {
  shelves: Shelf[];
  displays: Record<string, ShelfDisplay>;
  picked: PickedProduct | null;
  /** Shelf the player is standing at (the choice only shows there). */
  atShelfId: string | null;
  inBasket: Record<string, number>;
  onPick: (shelf: Shelf, itemId: string) => void;
  onBasket: (itemId: string) => void;
  onSteal: (itemId: string) => void;
}) {
  return (
    <group>
      {shelves.map((shelf) => {
        const d = displays[shelf.id];
        if (!d) return null;
        return shelf.items.map((id, i) => {
          const p = slot(d, i, shelf.items.length);
          const open = picked?.shelfId === shelf.id && picked.itemId === id && atShelfId === shelf.id;
          return (
            <group key={`${shelf.id}-${id}`}>
              <Product itemId={id} p={p} yaw={d.yaw} lit={open} onPick={() => onPick(shelf, id)} />
              {open && (
                <Html position={[p[0], p[1] + 0.75, p[2]]} center zIndexRange={[50, 40]}>
                  <div className="shelf-pop" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="shelf-pop__title">
                      {itemIcon(id)} {itemName(id)} {inBasket[id] ? <span className="muted">(korissa {inBasket[id]})</span> : null}
                    </div>
                    <button type="button" onClick={() => onBasket(id)}>🧺 Koriin <span className="muted">({eur(priceOf(id))})</span></button>
                    <button type="button" className="is-danger" onClick={() => onSteal(id)}>🫳 Varasta taskuun</button>
                  </div>
                </Html>
              )}
            </group>
          );
        });
      })}
    </group>
  );
}
