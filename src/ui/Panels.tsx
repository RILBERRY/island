import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Icon } from './icons';
import { ChatPanel } from './ChatPanel';
import { NearbyPanel } from './NearbyPanel';
import { PlacesPanel } from './PlacesPanel';
import { ProfilePanel } from './ProfilePanel';
import { SettingsPanel } from './SettingsPanel';
import { GamesPanel } from './GamesPanel';
import { AboutPanel } from './AboutPanel';
import { TravelPanel } from './TravelPanel';

export function Sheet({ title, children, onClose, wide, actions }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean; actions?: ReactNode }) {
  return (
    <aside className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="sheet-head">
        <h2>{title}</h2>
        <div className="sheet-actions">{actions}<button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div>
      </header>
      <div className="sheet-body">{children}</div>
    </aside>
  );
}

export function Panels() {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const close = () => setPanel(null);
  if (!panel) return null;
  switch (panel) {
    case 'chat': return <Sheet title="Global chat" onClose={close}><ChatPanel scope="global" /></Sheet>;
    case 'nearby': return <Sheet title="Nearby islanders" onClose={close}><NearbyPanel /></Sheet>;
    case 'places': return <Sheet title="Find a location" onClose={close}><PlacesPanel /></Sheet>;
    case 'profile': return <Sheet title="Your profile" onClose={close} wide><ProfilePanel /></Sheet>;
    case 'settings': return <Sheet title="Settings" onClose={close}><SettingsPanel /></Sheet>;
    case 'games': case 'leaderboard': return <Sheet title="Games" onClose={close} wide><GamesPanel /></Sheet>;
    case 'about': return <Sheet title="About L15" onClose={close}><AboutPanel /></Sheet>;
    case 'travel': return <Sheet title="Travel" onClose={close}><TravelPanel /></Sheet>;
    default: return null;
  }
}
