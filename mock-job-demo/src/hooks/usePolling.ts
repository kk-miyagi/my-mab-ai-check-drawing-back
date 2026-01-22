
import { useEffect, useRef } from 'react';

type Poller<T> = () => Promise<T>;
type StopWhen<T> = (result: T) => boolean;
type OnStop<T> = (result: T) => void;

export function usePolling<T>(
  poller: Poller<T>,
  stopWhen: StopWhen<T>,
  onStop: OnStop<T>,
  intervalMs = 3000,
  startDelayMs = 0
) {
  const stoppedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stoppedRef.current = false;

    const loop = async () => {
      if (stoppedRef.current) return;
      try {
        const result = await poller();
        if (stopWhen(result)) {
          stoppedRef.current = true;
          onStop(result);
          return;
        }
      } finally {
        if (!stoppedRef.current) {
          timerRef.current = window.setTimeout(loop, intervalMs);
        }
      }
    };

    const start = () => {
      if (stoppedRef.current) return;
      loop();
    };

    if (startDelayMs > 0) {
      startTimerRef.current = window.setTimeout(start, startDelayMs);
    } else {
      start();
    }

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startTimerRef.current) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, [poller, stopWhen, onStop, intervalMs, startDelayMs]);
}
