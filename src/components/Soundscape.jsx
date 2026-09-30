import { useEffect, useRef, useState } from "react";
import "./Soundscape.css";

const TRACKS = {
  daybreak: {
    name: "Daybreak",
    description: "A gentle start",
    chords: [
      [130.81, 164.81, 196, 246.94],
      [110, 146.83, 174.61, 220],
      [87.31, 130.81, 164.81, 196],
      [98, 146.83, 196, 220],
    ],
  },
  stillwater: {
    name: "Stillwater",
    description: "A quieter current",
    chords: [
      [110, 138.59, 164.81, 207.65],
      [92.5, 123.47, 146.83, 185],
      [103.83, 130.81, 155.56, 196],
      [82.41, 110, 138.59, 164.81],
    ],
  },
  nightfall: {
    name: "Nightfall",
    description: "Ease into the evening",
    chords: [
      [110, 130.81, 164.81, 196],
      [98, 123.47, 146.83, 185],
      [87.31, 110, 130.81, 164.81],
      [103.83, 130.81, 155.56, 196],
    ],
  },
};

function trackForTheme(theme) {
  if (theme === "morning") return "daybreak";
  if (theme === "evening" || theme === "night") return "nightfall";
  return "stillwater";
}

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function fadeVoices(context, voices, duration = 1.8) {
  const now = context.currentTime;
  voices.forEach(({ oscillator, gain }) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, duration / 5);
    oscillator.stop(now + duration);
  });
}

export default function Soundscape({ timeTheme }) {
  const [trackId, setTrackId] = useState(() => {
    const saved = readPreference("wellsync_soundscape_track", "");
    return TRACKS[saved] ? saved : trackForTheme(timeTheme);
  });
  const [volume, setVolume] = useState(() => {
    const saved = Number(readPreference("wellsync_soundscape_volume", "24"));
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 24;
  });
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const contextRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef([]);
  const intervalRef = useRef(null);
  const chordIndexRef = useRef(0);

  function clearChordTimer() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function playChord(context, chord) {
    fadeVoices(context, voicesRef.current);
    const now = context.currentTime;
    voicesRef.current = chord.flatMap((frequency, index) => {
      const voices = [];
      const layers = [
        { type: "sine", gain: index === 0 ? 0.035 : 0.023, detune: 0 },
        { type: "triangle", gain: 0.006, detune: index % 2 ? -4 : 4 },
      ];

      layers.forEach((layer) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = layer.type;
        oscillator.frequency.value = frequency;
        oscillator.detune.value = layer.detune;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(layer.gain, now + 3.2);
        oscillator.connect(gain);
        gain.connect(masterRef.current);
        oscillator.start(now);
        voices.push({ oscillator, gain });
      });

      return voices;
    });
  }

  function beginPlayback(context, nextTrackId) {
    clearChordTimer();
    chordIndexRef.current = 0;
    const chords = TRACKS[nextTrackId].chords;
    playChord(context, chords[chordIndexRef.current]);
    chordIndexRef.current = 1;
    intervalRef.current = window.setInterval(() => {
      playChord(context, chords[chordIndexRef.current]);
      chordIndexRef.current = (chordIndexRef.current + 1) % chords.length;
    }, 7000);
  }

  async function handleToggle() {
    if (playing) {
      clearChordTimer();
      if (contextRef.current) fadeVoices(contextRef.current, voicesRef.current, 1.2);
      voicesRef.current = [];
      setPlaying(false);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio playback is not supported in this browser.");

      let context = contextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioContextClass();
        const master = context.createGain();
        master.gain.value = volume / 100;
        master.connect(context.destination);
        contextRef.current = context;
        masterRef.current = master;
      }

      await context.resume();
      setAudioError("");
      beginPlayback(context, trackId);
      setPlaying(true);
    } catch (error) {
      setAudioError(error?.message || "Could not start audio playback.");
    }
  }

  function handleTrackChange(event) {
    const nextTrackId = event.target.value;
    setTrackId(nextTrackId);
    try {
      localStorage.setItem("wellsync_soundscape_track", nextTrackId);
    } catch {}
    if (playing && contextRef.current) beginPlayback(contextRef.current, nextTrackId);
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    if (masterRef.current) masterRef.current.gain.setTargetAtTime(nextVolume / 100, contextRef.current.currentTime, 0.08);
    try {
      localStorage.setItem("wellsync_soundscape_volume", String(nextVolume));
    } catch {}
  }

  useEffect(() => {
    return () => {
      clearChordTimer();
      if (contextRef.current && contextRef.current.state !== "closed") {
        voicesRef.current.forEach(({ oscillator }) => {
          try { oscillator.stop(); } catch {}
        });
        contextRef.current.close();
      }
    };
  }, []);

  return (
    <section className="dash2-soundscape glass-panel" aria-label="Ambient music player">
      <div className="dash2-soundscape-head">
        <div>
          <div className="dash2-eyebrow">SOUNDSCAPE</div>
          <h2>Find your rhythm.</h2>
        </div>
        <span className={`dash2-soundscape-status ${playing ? "is-playing" : ""}`}>
          <i /> {playing ? "PLAYING" : "READY"}
        </span>
      </div>

      <div className="dash2-soundscape-track">
        <div className={`dash2-soundscape-art ${playing ? "is-playing" : ""}`} aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
        <div className="dash2-soundscape-copy">
          <strong>{TRACKS[trackId].name}</strong>
          <span>{TRACKS[trackId].description}</span>
        </div>
        <button
          type="button"
          className="dash2-soundscape-play"
          onClick={handleToggle}
          aria-label={playing ? "Pause soundscape" : "Play soundscape"}
          title={playing ? "Pause soundscape" : "Play soundscape"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM15 5h3v14h-3z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>
          )}
        </button>
      </div>

      <label className="dash2-soundscape-select-label" htmlFor="dash2-soundscape-track">Soundscape</label>
      <select id="dash2-soundscape-track" value={trackId} onChange={handleTrackChange}>
        {Object.entries(TRACKS).map(([id, track]) => (
          <option key={id} value={id}>{track.name}</option>
        ))}
      </select>

      <label className="dash2-soundscape-volume-label" htmlFor="dash2-soundscape-volume">
        <span>Volume</span><span>{volume}%</span>
      </label>
      <input
        id="dash2-soundscape-volume"
        className="dash2-soundscape-volume"
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={handleVolumeChange}
        aria-label="Soundscape volume"
      />
      {audioError && <p className="dash2-soundscape-error" role="status">{audioError}</p>}
    </section>
  );
}