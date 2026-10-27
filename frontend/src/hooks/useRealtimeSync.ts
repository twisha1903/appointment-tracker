import { useEffect, useRef, useState } from 'react';
import { SyncStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export function useRealtimeSync(onRefresh: () => void | Promise<void>) {
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const refreshCallbackRef = useRef(onRefresh);
  refreshCallbackRef.current = onRefresh;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const startPolling = () => {
      if (pollInterval) return;
      if (isMounted) setStatus('fallback');
      pollInterval = setInterval(async () => {
        if (!isMounted) return;
        try {
          await refreshCallbackRef.current();
        } catch {
          if (isMounted) setStatus('disconnected');
        }
      }, 3000);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`${API_BASE}/events`);

        eventSource.onopen = () => {
          if (!isMounted) return;
          stopPolling();
          setStatus('connected');
        };

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            setLastEventTime(new Date().toLocaleTimeString());
            // Do not refresh on initial connection handshake, only on change mutations
            if (data.type && data.type !== 'connected') {
              refreshCallbackRef.current();
            }
          } catch (e) {
            console.error('Failed to parse SSE payload', e);
          }
        };

        eventSource.onerror = () => {
          if (!isMounted) return;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPolling();

          // Attempt SSE reconnection in 10s without tight looping
          if (!retryTimeout) {
            retryTimeout = setTimeout(() => {
              retryTimeout = null;
              if (isMounted) {
                connectSSE();
              }
            }, 10000);
          }
        };
      } catch {
        startPolling();
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      stopPolling();
      if (retryTimeout) clearTimeout(retryTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return { status, lastEventTime };
}
