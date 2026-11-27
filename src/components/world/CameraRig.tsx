import { useEffect, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DIST_MAX, DIST_MIN, MOVE_KEYS, PITCH_MAX, PITCH_MIN, type ControlState } from './controls';

interface CameraRigProps {
  followRef: MutableRefObject<THREE.Vector3>;
  controlRef: MutableRefObject<ControlState>;
  /** Pointer lock started or ended (shows the crosshair). */
  onLockChange?: (locked: boolean) => void;
}

const MOUSE_YAW = 0.0026; // rad per pixel
const MOUSE_PITCH = 0.002;
const HEAD = 1.55;
const want = new THREE.Vector3();
const look = new THREE.Vector3();

/**
 * Third-person chase camera behind the player. Click the game to lock the
 * mouse to the centre: moving the mouse turns the camera, the wheel zooms,
 * Esc releases the mouse. While locked, clicks aim from the screen centre.
 */
export function CameraRig({ followRef, controlRef, onLockChange }: CameraRigProps) {
  const { camera, gl, setEvents } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const isLocked = () => document.pointerLockElement === el;
    // Aim every pointer event from the screen centre while the mouse is locked.
    setEvents({
      compute: (event, state) => {
        if (isLocked()) state.pointer.set(0, 0);
        else state.pointer.set((event.offsetX / state.size.width) * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    });
    const lock = () => {
      if (!isLocked()) void el.requestPointerLock?.()?.catch?.(() => {});
    };
    const move = (e: MouseEvent) => {
      if (!isLocked()) return;
      const c = controlRef.current;
      c.yaw -= e.movementX * MOUSE_YAW;
      c.pitch = THREE.MathUtils.clamp(c.pitch + e.movementY * MOUSE_PITCH, PITCH_MIN, PITCH_MAX);
    };
    const wheel = (e: WheelEvent) => {
      const c = controlRef.current;
      c.dist = THREE.MathUtils.clamp(c.dist * (1 + e.deltaY * 0.001), DIST_MIN, DIST_MAX);
    };
    const changed = () => onLockChange?.(isLocked());
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (!MOVE_KEYS.has(k)) return;
      controlRef.current.keys.add(k);
      if (k.startsWith('arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controlRef.current.keys.delete(e.key.toLowerCase());
    const clear = () => controlRef.current.keys.clear();
    el.addEventListener('click', lock);
    el.addEventListener('wheel', wheel, { passive: true });
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', changed);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      el.removeEventListener('click', lock);
      el.removeEventListener('wheel', wheel);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', changed);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      if (isLocked()) document.exitPointerLock();
    };
  }, [gl, setEvents, controlRef, onLockChange]);

  useFrame((_, dt) => {
    const c = controlRef.current;
    const p = followRef.current;
    if (!c.ready) {
      // start from wherever the camera was placed (intro view, interior spawn)
      const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
      const flat = Math.hypot(dx, dz);
      if (flat > 0.5) {
        c.yaw = Math.atan2(dx, dz);
        c.pitch = THREE.MathUtils.clamp(Math.atan2(camera.position.y - p.y - HEAD, flat), PITCH_MIN, PITCH_MAX);
        c.dist = THREE.MathUtils.clamp(Math.hypot(flat, camera.position.y - p.y - HEAD), DIST_MIN, DIST_MAX);
      }
      c.ready = true;
    }
    const horiz = Math.cos(c.pitch) * c.dist;
    want.set(p.x + Math.sin(c.yaw) * horiz, p.y + HEAD + Math.sin(c.pitch) * c.dist, p.z + Math.cos(c.yaw) * horiz);
    // follow tightly so the mouse feels direct, smooth only big jumps a little
    const k = 1 - Math.exp(-dt * 18);
    if (camera.position.distanceToSquared(want) > 400) camera.position.copy(want);
    else camera.position.lerp(want, k);
    look.set(p.x, p.y + HEAD, p.z);
    camera.lookAt(look);
  });

  return null;
}
