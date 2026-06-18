import * as Speech from "expo-speech";

let isPaused = false;
let isPlaying = false;

export const BibleAudioEngine = {
  stop: () => {
    isPlaying = false;
    isPaused = false;
    Speech.stop();
  },

  pause: () => {
    isPaused = true;
    Speech.stop();
  },

  resume: (queue: string[]) => {
    if (!isPaused) return;
    isPaused = false;
    playQueue(queue);
  },

  play: (queue: string[]) => {
    isPlaying = true;
    isPaused = false;
    playQueue(queue);
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function playQueue(queue: string[]) {
  for (let i = 0; i < queue.length; i++) {
    if (!isPlaying || isPaused) return;

    const text = queue[i];
    if (!text) continue;

    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: "en-US",
        rate: 0.95,
        onDone: () => resolve(),
        onStopped: () => resolve(),
      });
    });

    await sleep(200);
  }

  isPlaying = false;
}
