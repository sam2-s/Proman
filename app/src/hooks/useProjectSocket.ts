import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, WS_URL } from '../api/client';

type Handler = (event: Record<string, unknown>) => void;

/**
 * Subscribes to the Proman WebSocket for a project.
 * Reconnects with backoff and invokes `onEvent` for each message.
 */
export function useProjectSocket(
  projectId: number | null,
  onEvent: Handler,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connect = useCallback(async () => {
    if (!projectId) return;
    const token = await getToken();
    if (!token) return;

    const url = `${WS_URL}/ws?project_id=${projectId}&token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;

    const open = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        schedule();
        return;
      }

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(String(e.data));
          handlerRef.current(data);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) schedule();
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    const schedule = () => {
      if (closed) return;
      retry += 1;
      const delay = Math.min(1000 * 2 ** Math.min(retry, 5), 15000);
      setTimeout(open, delay);
    };

    open();

    return () => {
      closed = true;
      setConnected(false);
      ws?.close();
    };
  }, [projectId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      cleanup = await connect();
    })();
    return () => cleanup?.();
  }, [connect]);

  return { connected };
}
