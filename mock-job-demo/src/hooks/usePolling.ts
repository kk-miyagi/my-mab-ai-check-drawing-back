
import { useEffect, useRef } from 'react';

type Poller<T> = () => Promise<T>;
type StopEnd<T> = (result: T) => boolean;
type OnStopEnd<T> = (result: T) => void;
type StopError<T> = (result: T) => boolean;
type OnStopError<T> = (result: T) => void;

export function usePolling<T>(
  poller: Poller<T>,
  stopEnd: StopEnd<T>,
  onStopEnd: OnStopEnd<T>,
  stopError: StopError<T>,
  onStopError: OnStopError<T>,
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
        if (stopEnd(result)) {
          stoppedRef.current = true;
          onStopEnd(result);
          return;
        }
        if (stopError(result)) {
          stoppedRef.current = true;
          onStopError(result);
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
  }, [poller, stopEnd, onStopEnd, stopError, onStopError, intervalMs, startDelayMs]);
}
