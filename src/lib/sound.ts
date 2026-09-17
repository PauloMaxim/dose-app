import { useDose } from "./store";

let ctx: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export function playSound(kind: "tap" | "success" | "whoosh" = "tap") {
  if (!useDose.getState().profile.soundOn) return;
  const ac = context();
  if (!ac) return;
  void ac.resume();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  if (kind === "success") {
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.exponentialRampToValueAtTime(784, now + 0.12);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);
    return;
  }
  if (kind === "whoosh") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.32);
    return;
  }
  osc.type = "sine";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.035, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.start(now);
  osc.stop(now + 0.09);
}
