import { useState } from 'react';
import { useStore } from '../store';
import { AvatarBuilder } from './AvatarBuilder';
import { Icon } from './icons';
import { usePlaceSearch } from './PlacesPanel';
import { defaultCharacter, randomToken, sanitizeName, slugUsername, PROFILE_EMOJIS, HUMAN_PRESETS, type Profile } from '../../shared/profile';

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const existing = useStore((s) => s.profile);
  const world = useStore((s) => s.world)!;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? PROFILE_EMOJIS[Math.floor(Math.random() * PROFILE_EMOJIS.length)]);
  const [character, setCharacter] = useState(existing?.character ?? { ...defaultCharacter(), ...HUMAN_PRESETS[Math.floor(Math.random() * HUMAN_PRESETS.length)].patch });
  const [home, setHome] = useState<Profile['home']>(existing?.home ?? null);
  const [q, setQ] = useState('');
  const results = usePlaceSearch(q);
  const finish = () => {
    const clean = sanitizeName(name) || 'Islander';
    onDone({ token: existing?.token ?? randomToken(), name: clean, username: existing?.username ?? slugUsername(clean), emoji, character, home, language: existing?.language ?? 'en', createdAt: existing?.createdAt ?? Date.now() });
  };
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-steps">{['Name', 'Character', 'Home'].map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</span>)}</div>
        {step === 0 && (<>
          <h2>Welcome to {world.island.name}</h2>
          <p>What should we call you?</p>
          <input autoFocus value={name} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(1); }} />
          <small>Other islanders see this name above your character. You can change it later in your profile.</small>
          <div className="emoji-grid">{PROFILE_EMOJIS.map((e) => <button key={e} type="button" className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>)}</div>
          <div className="row end"><button disabled={!name.trim()} onClick={() => setStep(1)}>Next</button></div>
        </>)}
        {step === 1 && (<>
          <h2>Make your character</h2>
          <p>Choose how you look on the island. You can change it any time in your profile.</p>
          <AvatarBuilder value={character} onChange={setCharacter} />
          <div className="row"><button className="secondary" onClick={() => setStep(0)}><Icon name="back" size={14} /> Back</button><button onClick={() => setStep(2)}>Save character</button></div>
        </>)}
        {step === 2 && (<>
          <h2>Where is home?</h2>
          <p>Search for your address and you’ll start in front of it every time you visit. You can change it later in your profile.</p>
          <label className="search"><Icon name="search" size={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places, streets or addresses" /></label>
          <div className="home-results">
            {results.slice(0, 6).map((p) => <button key={p.id} type="button" className={home?.label === p.name ? 'on' : ''} onClick={() => setHome({ x: p.x, z: p.z, label: p.name })}>{p.name}<small>{p.category}</small></button>)}
          </div>
          <small>Address coverage for {world.island.name} is incomplete on OpenStreetMap, so most houses aren’t searchable yet.</small>
          <div className="row"><button className="secondary" onClick={() => setStep(1)}><Icon name="back" size={14} /> Back</button>{home ? <button onClick={finish}>Start exploring from {home.label}</button> : <button onClick={finish}>Start at the jetty for now</button>}</div>
        </>)}
      </div>
    </div>
  );
}
