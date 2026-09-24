import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { BoardDetail, Card, Column } from '../api/types';

/**
 * Loads a board and keeps columns/cards in local state,
 * applying realtime WebSocket events on top.
 */
export function useBoard(boardId: number) {
  const [data, setData] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await api.get<BoardDetail>(`/api/boards/${boardId}`);
      setData(detail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string | undefined;
    setData((prev) => {
      if (!prev) return prev;
      const next: BoardDetail = {
        board: prev.board,
        columns: prev.columns.map((c) => ({
          column: { ...c.column },
          cards: [...c.cards],
        })),
      };

      const upsertCard = (card: Card) => {
        let placed = false;
        for (const col of next.columns) {
          const idx = col.cards.findIndex((c) => c.id === card.id);
          if (idx >= 0) {
            col.cards[idx] = card;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const target = next.columns.find((c) => c.column.id === card.column_id);
          if (target) {
            target.cards.push(card);
            target.cards.sort((a, b) => a.position - b.position);
          }
        }
      };

      switch (type) {
        case 'card_created':
        case 'card_updated':
        case 'card_moved':
          upsertCard(event.card as Card);
          break;
        case 'card_deleted': {
          const id = event.card_id as number;
          for (const col of next.columns) {
            col.cards = col.cards.filter((c) => c.id !== id);
          }
          break;
        }
        case 'column_created':
          next.columns.push({
            column: event.column as Column,
            cards: [],
          });
          next.columns.sort((a, b) => a.column.position - b.column.position);
          break;
        case 'column_updated': {
          const col = event.column as Column;
          const found = next.columns.find((c) => c.column.id === col.id);
          if (found) found.column = col;
          next.columns.sort((a, b) => a.column.position - b.column.position);
          break;
        }
        case 'column_deleted': {
          const colId = event.column_id as number;
          next.columns = next.columns.filter((c) => c.column.id !== colId);
          break;
        }
        case 'comment_created':
        case 'subtask_updated':
          // Detail screens refetch; board only needs structural events.
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  /** Move a card to another column/position (optimistic + server). */
  const moveCard = useCallback(
    async (card: Card, toColumnId: number, toPosition: number) => {
      setData((prev) => {
        if (!prev) return prev;
        const next: BoardDetail = {
          board: prev.board,
          columns: prev.columns.map((c) => ({
            column: { ...c.column },
            cards: c.cards.filter((x) => x.id !== card.id),
          })),
        };
        const target = next.columns.find((c) => c.column.id === toColumnId);
        if (target) {
          target.cards.splice(toPosition, 0, {
            ...card,
            column_id: toColumnId,
            position: toPosition,
          });
          target.cards.forEach((c, i) => {
            c.position = i;
          });
        }
        return next;
      });
      try {
        await api.patch(`/api/cards/${card.id}`, {
          column_id: toColumnId,
          position: toPosition,
        });
      } catch {
        await load();
      }
    },
    [load],
  );

  const addCard = useCallback(
    async (columnId: number, title: string) => {
      await api.post(`/api/columns/${columnId}/cards`, { title });
      await load();
    },
    [load],
  );

  return { data, loading, error, reload: load, applyEvent, moveCard, addCard };
}
