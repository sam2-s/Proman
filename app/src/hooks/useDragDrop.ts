import { useCallback, useMemo, useRef, useState } from 'react';

export interface DragState {
  cardId: number | null;
  x: number;
  y: number;
  width: number;
}

export interface ColumnLayout {
  id: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const empty: DragState = { cardId: null, x: 0, y: 0, width: 0 };

export type SetDragFn = (
  d: DragState | ((prev: DragState) => DragState),
) => void;

/**
 * Tracks active drag + column hit-testing for the Kanban board.
 */
export function useDragDrop() {
  const [drag, setDragState] = useState<DragState>(empty);
  const layoutsRef = useRef<Map<number, ColumnLayout>>(new Map());
  const dragRef = useRef<DragState>(empty);
  const [, force] = useState(0);

  const setDrag: SetDragFn = useCallback((d) => {
    const next =
      typeof d === 'function'
        ? (d as (prev: DragState) => DragState)(dragRef.current)
        : d;
    dragRef.current = next;
    setDragState(next);
    force((n) => n + 1);
  }, []);

  const registerColumn = useCallback((id: number, layout: ColumnLayout) => {
    layoutsRef.current.set(id, layout);
    force((n) => n + 1);
  }, []);

  const registerColumnWindow = useCallback(
    (id: number, left: number, top: number, width: number, height: number) => {
      layoutsRef.current.set(id, {
        id,
        left,
        right: left + width,
        top,
        bottom: top + height,
      });
      force((n) => n + 1);
    },
    [],
  );

  const clearDrag = useCallback(() => {
    dragRef.current = empty;
    setDragState(empty);
  }, []);

  const hitColumn = useCallback((absX: number, absY: number): number | null => {
    for (const [id, l] of layoutsRef.current) {
      if (
        absX >= l.left &&
        absX <= l.right &&
        absY >= l.top &&
        absY <= l.bottom
      ) {
        return id;
      }
    }
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [id, l] of layoutsRef.current) {
      const cx = (l.left + l.right) / 2;
      const dist = Math.abs(absX - cx);
      if (dist < bestDist && absY >= l.top - 80 && absY <= l.bottom + 80) {
        bestDist = dist;
        best = id;
      }
    }
    return best;
  }, []);

  const hitIndex = useCallback(
    (columnId: number, absY: number, count: number): number => {
      const l = layoutsRef.current.get(columnId);
      if (!l || count <= 0) return 0;
      const rel = absY - l.top;
      const header = 48;
      const slot = 100;
      const idx = Math.floor((rel - header) / slot);
      return Math.max(0, Math.min(count, idx));
    },
    [],
  );

  const activeCardId = drag.cardId;
  const isDragging = useCallback(
    (cardId: number) => activeCardId === cardId,
    [activeCardId],
  );

  return useMemo(
    () => ({
      drag,
      setDrag,
      clearDrag,
      registerColumn,
      registerColumnWindow,
      hitColumn,
      hitIndex,
      isDragging,
      activeCardId,
    }),
    [
      drag,
      setDrag,
      clearDrag,
      registerColumn,
      registerColumnWindow,
      hitColumn,
      hitIndex,
      isDragging,
      activeCardId,
    ],
  );
}
