import { useStore } from '../store';
import { startAmbience } from '../audio';

export function StartScreen({ onStart, onNew }: { onStart: () => void; onNew: () => void }) {
  const profile = useStore((s) => s.profile);
  const world = useStore((s) => s.world);
  const setPanel = useStore((s) => s.setPanel);
  return (
    <div className="start">
      <div className="start-sky" />
      <div className="start-sea" />
      <div className="start-card">
        <div className="start-brand"><span className="brand-mark big">L15</span><h1>Explore Isdhoo.<br />Meet your friends.</h1></div>
        <p>Wander around L. Isdhoo, catch up with friends, and settle in for a game of UNO, a quiz, or chess by the beach. Everything you see is built from the real map of the island.</p>
        <div className="start-actions">
          {profile ? (<>
            <button onClick={() => { startAmbience(); onStart(); }}>Continue as {profile.emoji} {profile.name}</button>
            <button className="secondary" onClick={() => { startAmbience(); onNew(); }}>New character</button>
          </>) : <button onClick={() => { startAmbience(); onNew(); }}>Start exploring</button>}
          <button className="quiet" onClick={() => setPanel('about')}>Why we created L15</button>
        </div>
        <small className="start-foot">{world ? `${world.coverage.roads} roads · ${world.coverage.buildings} mapped buildings · ${world.coverage.places} places` : 'Loading the island…'} · Map data © OpenStreetMap contributors</small>
      </div>
    </div>
  );
}
