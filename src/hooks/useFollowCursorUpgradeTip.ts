import { useCallback, useEffect, useRef, useState } from "react";

const OFFSET_X = 12;
const OFFSET_Y = -36;
/** Approximate floater size for viewport clamping */
const TIP_W = 240;
const TIP_H = 44;

export interface CursorTipState {
  x: number;
  y: number;
  visible: boolean;
}

function clampTip(x: number, y: number): { x: number; y: number } {
  let cx = x;
  let cy = y;
  cx = Math.min(cx, window.innerWidth - TIP_W - 8);
  cx = Math.max(cx, 8);
  cy = Math.min(cy, window.innerHeight - TIP_H - 8);
  cy = Math.max(cy, 8);
  return { x: cx, y: cy };
}

/**
 * Tracks pointer position inside a container so an upgrade hint can render
 * with `position: fixed` near the cursor. Hides on mouseleave; supports
 * focus-in positioning for keyboard users when used from ProLockHoverWrap.
 */
export function useFollowCursorUpgradeTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<CursorTipState>({ x: 0, y: 0, visible: false });

  const hide = useCallback(() => {
    setTip((prev) => ({ ...prev, visible: false }));
  }, []);

  const showNearPointer = useCallback((e: MouseEvent) => {
    const { x, y } = clampTip(e.clientX + OFFSET_X, e.clientY + OFFSET_Y);
    setTip({ x, y, visible: true });
  }, []);

  const showNearFocus = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - TIP_W / 2;
    const y = r.top + OFFSET_Y;
    const c = clampTip(x, y);
    setTip({ ...c, visible: true });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => showNearPointer(e);
    const onMouseLeave = () => hide();

    const onFocusIn = () => showNearFocus();
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && el.contains(next)) return;
      hide();
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);

    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [hide, showNearPointer, showNearFocus]);

  return { ref, tip };
}
