import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useId, useRef, useState } from "react";
import { AppState } from "react-native";

export function useReadingKeepAwake(playing: boolean) {
  const id = useId();
  const sequence = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!playing || !foreground) return;
    // Each activation owns its tag, so a late cleanup cannot release a newer one.
    const tag = `reading-${id}-${++sequence.current}`;
    let disposed = false;
    const release = () => { void deactivateKeepAwake(tag).catch(() => {}); };
    void activateKeepAwakeAsync(tag).then(() => {
      if (disposed) release();
    }).catch(() => {});
    return () => {
      disposed = true;
      release();
    };
  }, [playing, foreground, id]);
}
