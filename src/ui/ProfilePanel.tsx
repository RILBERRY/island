import { useState } from 'react';
import { useStore } from '../store';
import { sendProfile, disconnect } from '../net/socket';
import { AvatarBuilder } from './AvatarBuilder';
import { Icon } from './icons';
import { PROFILE_EMOJIS, sanitizeName, slugUsername } from '../../shared/profile';
import { usePlaceSearch } from './PlacesPanel';

export function ProfilePanel() {
  const profile = useStore((s) => s.profile)!;
  const setProfile = useStore((s) => s.setProfile);
  const world = useStore((s) => s.world)!;
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [homeQuery, setHomeQuery] = useState('');
  const [pickHome, setPickHome] = useState(false);
  const results = usePlaceSearch(homeQuery);
  const st = useStore.getState();
  const save = () => {
    const name = sanitizeName(draft.name) || profile.name;
    const next = { ...draft, name, username: slugUsername(draft.username || name) };
    setProfile(next); sendProfile(); st.toast('Profile saved.', 'success'); setEditing(false);
  };
  return (
    <div className="profile">
      <div className="profile-summary">
        <span className="ps-emoji">{profile.emoji}</span>
        <div><strong>{profile.name}</strong><small>@{profile.username} · Guest · saved in this browser</small></div>
      </div>
      <p className="notice"><Icon name="info" size={16} /> Sign-in with Google and ID verification exist in the original D15. This clone keeps your character in this browser only.</p>
      <label className="field"><span>Display name</span><input value={draft.name} maxLength={24} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><small>Other islanders see your name above your character and in chat. It doesn’t have to be unique.</small></label>
      <label className="field"><span>Username</span><input value={draft.username} maxLength={16} onChange={(e) => setDraft({ ...draft, username: slugUsername(e.target.value) })} /><small>Your username is only yours, so people use it to @mention you in chat.</small></label>
      <fieldset className="builder-fieldset"><legend>Profile emoji</legend><div className="emoji-grid">{PROFILE_EMOJIS.map((e) => <button key={e} type="button" className={draft.emoji === e ? 'on' : ''} onClick={() => setDraft({ ...draft, emoji: e })}>{e}</button>)}</div><small>Shown on your profile button and beside your messages in chat.</small></fieldset>
      <fieldset className="builder-fieldset"><legend>Where is home?</legend>
        <div className="home-row"><Icon name="home" size={16} /><span>{draft.home ? draft.home.label : 'Not set · you start at the jetty'}</span>
          <button type="button" className="secondary" onClick={() => setPickHome((p) => !p)}>{draft.home ? 'Change' : 'Search your address'}</button>
          {draft.home && <button type="button" className="quiet" onClick={() => { setDraft({ ...draft, home: null }); st.toast('Home cleared. You’ll start at the jetty.'); }}>Start at the jetty instead</button>}
        </div>
        {pickHome && (<div className="home-picker">
          <label className="search"><Icon name="search" size={16} /><input autoFocus value={homeQuery} onChange={(e) => setHomeQuery(e.target.value)} placeholder="Search places or addresses" /></label>
          <div className="home-results">{results.slice(0, 8).map((p) => <button key={p.id} type="button" onClick={() => { const w = st.walkTest; let x = p.x, z = p.z; if (w && !w(x, z)) { for (let r = 2; r < 60 && !w(x, z); r += 2) for (let i = 0; i < 12 && !w(x, z); i++) { const a = (i / 12) * Math.PI * 2; x = p.x + Math.cos(a) * r; z = p.z + Math.sin(a) * r; } } setDraft({ ...draft, home: { x, z, label: p.name } }); setPickHome(false); }}>{p.name}<small>{p.category}</small></button>)}
            <button type="button" onClick={() => { setDraft({ ...draft, home: { x: Math.round(useStoreLocal().x), z: Math.round(useStoreLocal().z), label: 'My spot' } }); setPickHome(false); }}>Use where I’m standing<small>Current position</small></button>
          </div>
          <small>Search for your address and you’ll start in front of it every time you visit. Address coverage is incomplete on OpenStreetMap for {world.island.name}.</small>
        </div>)}
      </fieldset>
      <fieldset className="builder-fieldset"><legend>Language</legend><div className="builder-options"><button type="button" className={draft.language === 'en' ? 'on' : ''} onClick={() => setDraft({ ...draft, language: 'en' })}>English</button><button type="button" className={draft.language === 'dv' ? 'on' : ''} onClick={() => setDraft({ ...draft, language: 'dv' })}>ދިވެހި</button></div><small>Switches island and place names where a Dhivehi name exists.</small></fieldset>
      <div className="profile-tools">
        <button type="button" className="secondary" onClick={() => setEditing((e) => !e)}><Icon name="edit" size={14} /> {editing ? 'Hide character editor' : 'Edit character'}</button>
      </div>
      {editing && <AvatarBuilder value={draft.character} onChange={(c) => setDraft({ ...draft, character: c })} />}
      <div className="profile-actions">
        <button type="button" onClick={() => { save(); useStore.getState().setSettings({ language: draft.language }); }}>Save profile</button>
        <button type="button" className="danger" onClick={() => { if (confirm('Permanently delete your character from this browser? This can’t be undone.')) { disconnect(); try { localStorage.removeItem('l15.profile'); } catch { /* ignore */ } location.reload(); } }}>Delete profile</button>
      </div>
    </div>
  );
}

function useStoreLocal() { return { x: (window as unknown as { __l15pos?: { x: number; z: number } }).__l15pos?.x ?? 0, z: (window as unknown as { __l15pos?: { x: number; z: number } }).__l15pos?.z ?? 0 }; }
