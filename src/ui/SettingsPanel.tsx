import { useStore, type Settings } from '../store';
import { applyVolumes } from '../audio';
import { Icon } from './icons';

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="setting-row"><span>{label}</span><div className="seg" role="radiogroup" aria-label={label}>{options.map((o) => <button key={o.id} role="radio" aria-checked={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div></div>
  );
}
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="setting-row"><span>{label} · {Math.round(value * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const world = useStore((s) => s.world)!;
  const set = (p: Partial<Settings>) => { setSettings(p); applyVolumes(); };
  return (
    <div className="settings">
      <h3>Sound</h3>
      <Slider label="Ocean waves" value={settings.oceanVolume} onChange={(v) => set({ oceanVolume: v })} />
      <Slider label="Background music" value={settings.musicVolume} onChange={(v) => set({ musicVolume: v })} />
      <Slider label="Game sounds" value={settings.gameVolume} onChange={(v) => set({ gameVolume: v })} />
      <div className="notice"><Icon name="micoff" size={16} /><p>Nearby voice (LiveKit in the original) isn’t included in this build.</p></div>
      <h3>Island detail</h3>
      <Seg label="Quality" value={settings.quality} options={[{ id: 'low', label: 'Low · lighter on your phone' }, { id: 'standard', label: 'Standard · soft shadows' }, { id: 'high', label: 'High' }]} onChange={(v) => set({ quality: v })} />
      <Seg label="Daylight" value={settings.daylight} options={[{ id: 'auto', label: 'Island time' }, { id: 'day', label: 'Island day' }, { id: 'night', label: 'Island night' }]} onChange={(v) => set({ daylight: v })} />
      <Seg label="Illustrative houses" value={settings.illustrativeHouses ? 'on' : 'off'} options={[{ id: 'on', label: 'Show' }, { id: 'off', label: 'Mapped only' }]} onChange={(v) => set({ illustrativeHouses: v === 'on' })} />
      <Seg label="Touch joystick" value={settings.joystick} options={[{ id: 'auto', label: 'Auto' }, { id: 'on', label: 'On' }, { id: 'off', label: 'Off' }]} onChange={(v) => set({ joystick: v })} />
      <Seg label="Language" value={settings.language} options={[{ id: 'en', label: 'English' }, { id: 'dv', label: 'ދިވެހި' }]} onChange={(v) => set({ language: v })} />
      <h3>Controls &amp; map data</h3>
      <p className="muted small">WASD or arrow keys walk, Shift runs. Drag to look around, scroll or pinch to zoom, click or tap the ground to walk there. On phones use the joystick.</p>
      <p className="muted small">{world.coverage.notes} Coastline, roads, buildings and places © <a href={world.source.licenseUrl} target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL), retrieved {world.source.retrievedAt}. Illustrative houses are generated along mapped roads and are not survey data.</p>
      <button className="secondary" onClick={() => useStore.getState().setPanel('about')}>Why we made L15</button>
    </div>
  );
}
