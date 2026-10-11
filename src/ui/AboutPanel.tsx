import { useStore } from '../store';

export function AboutPanel() {
  const world = useStore((s) => s.world);
  return (
    <div className="about">
      <h3>Why we created L15</h3>
      <p>L15 started from a pretty simple idea. We wanted to make something for Isdhoo that actually felt like Isdhoo: the harbour, the old mosque, Bodumagu, the long road down to Kalaidhoo.</p>
      <p>There are games and different things to do inside L15, but those things are almost secondary. The main part is the people. Sometimes you might log in, walk around for five minutes and leave. That's fine too. That's kind of the fun of it.</p>
      <p>L15 is a personal clone inspired by <a href="https://d15.live" target="_blank" rel="noreferrer">D15</a>, the island hangout made for N. Velidhoo. The name follows the same pattern: <strong>L</strong> for Laamu atoll and <strong>15</strong> for the atoll’s postcode prefix (Isdhoo is 15011).</p>
      <h3>Map data</h3>
      <p className="small">Coastline, roads, buildings and places come from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> under ODbL{world ? `, retrieved ${world.source.retrievedAt}` : ''}. Heights, vegetation, cats, boats and the extra houses along the streets are illustrative, not survey data. Building coverage on OpenStreetMap is incomplete for Isdhoo.</p>
      <h3>Credits</h3>
      <p className="small">Built with React, three.js and React Three Fiber. Sounds are synthesised in the browser. Quiz facts come from Wikipedia and OpenStreetMap.</p>
    </div>
  );
}
