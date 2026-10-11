import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Character } from '../scene/Character';
import { ANIMALS, BOTTOM_STYLES, CLOTHES_COLORS, HAIR_COLORS, HAIR_STYLES, HUMAN_PRESETS, SKIN_TONES, type Character as CharacterSpec } from '../../shared/profile';
import { Icon } from './icons';

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="builder-fieldset"><legend>{label}</legend>
      <div className="builder-colors">{colors.map((c) => <button key={c} type="button" className={c === value ? 'on' : ''} style={{ background: c }} aria-label={c} aria-pressed={c === value} onClick={() => onChange(c)} />)}</div>
    </fieldset>
  );
}

function Options<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="builder-fieldset"><legend>{label}</legend>
      <div className="builder-options">{options.map((o) => <button key={o.id} type="button" className={o.id === value ? 'on' : ''} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
    </fieldset>
  );
}

export function AvatarBuilder({ value, onChange }: { value: CharacterSpec; onChange: (c: CharacterSpec) => void }) {
  const [tab, setTab] = useState<'presets' | 'hair' | 'clothes' | 'extras'>('presets');
  const [turn, setTurn] = useState(0.4);
  const drag = useRef<{ x: number; t: number } | null>(null);
  const [anim, setAnim] = useState<'idle' | 'walk'>('idle');
  const patch = (p: Partial<CharacterSpec>) => onChange({ ...value, ...p });
  return (
    <div className="avatar-builder">
      <div className="avatar-stage" onPointerDown={(e) => { drag.current = { x: e.clientX, t: turn }; }} onPointerMove={(e) => { if (drag.current) setTurn(drag.current.t + (e.clientX - drag.current.x) * 0.012); }} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        <Canvas camera={{ position: [0, 1.3, 3.6], fov: 32 }} dpr={[1, 2]}>
          <hemisphereLight args={['#dff3ff', '#c9b893', 1.1]} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} />
          <group rotation={[0, turn, 0]} position={[0, value.kind === 'human' ? -0.85 : -0.4, 0]}>
            <Character character={value} anim={anim} />
          </group>
        </Canvas>
        <span className="avatar-stage-hint">Drag to turn</span>
        <button type="button" className="avatar-stage-caption" onClick={() => setAnim(anim === 'idle' ? 'walk' : 'idle')}>{anim === 'idle' ? 'Preview walk' : 'Stand still'}</button>
      </div>
      <div className="builder-panel">
        <div className="avatar-kind-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={value.kind === 'human'} className={value.kind === 'human' ? 'on' : ''} onClick={() => patch({ kind: 'human' })}>Human</button>
          <button type="button" role="tab" aria-selected={value.kind === 'animal'} className={value.kind === 'animal' ? 'on' : ''} onClick={() => patch({ kind: 'animal' })}>Animal</button>
        </div>
        {value.kind === 'animal' ? (
          <div className="builder-controls">
            <div className="character-grid" aria-label="Choose an animal">
              {ANIMALS.map((a) => <button key={a.id} type="button" aria-pressed={value.animal === a.id} className={value.animal === a.id ? 'on' : ''} style={{ '--accent': a.accent } as React.CSSProperties} onClick={() => patch({ animal: a.id })}><span>{a.emoji}</span><small>{a.name}</small>{value.animal === a.id && <Icon name="check" size={13} />}</button>)}
            </div>
            <Swatches label="Fur colour" colors={['#e9a23b', '#2b2b2b', '#9a9a9a', '#f3e9d2', '#c27a3a', '#ff6b57', '#3f9a63', '#8fa3b5', '#5a4a6e', '#c9b79c']} value={value.hairColor} onChange={(c) => patch({ hairColor: c })} />
            <Swatches label="Clothes" colors={CLOTHES_COLORS} value={value.clothesColor} onChange={(c) => patch({ clothesColor: c })} />
          </div>
        ) : (
          <div className="builder-controls">
            <div className="builder-category-tabs">
              {(['presets', 'hair', 'clothes', 'extras'] as const).map((t) => <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
            </div>
            {tab === 'presets' && (
              <div className="character-grid human-grid" aria-label="Choose a human">
                {HUMAN_PRESETS.map((p) => <button key={p.id} type="button" onClick={() => patch(p.patch)}><span style={{ background: p.patch.skin }} className="preset-face">{p.patch.hijab ? '🧕' : p.patch.gender === 'female' ? '👩' : '👨'}</span><small>{p.name}</small></button>)}
              </div>
            )}
            {tab === 'presets' && (<>
              <Options label="Gender" options={[{ id: 'female', label: 'Female' }, { id: 'male', label: 'Male' }]} value={value.gender} onChange={(g) => patch({ gender: g })} />
              <Swatches label="Skin" colors={SKIN_TONES} value={value.skin} onChange={(c) => patch({ skin: c })} />
            </>)}
            {tab === 'hair' && (<>
              <Options label="Hair style" options={HAIR_STYLES} value={value.hair} onChange={(h) => patch({ hair: h, hijab: false })} />
              <Swatches label="Hair colour" colors={HAIR_COLORS} value={value.hairColor} onChange={(c) => patch({ hairColor: c })} />
              <fieldset className="builder-fieldset"><legend>Hijab</legend><div className="builder-options"><button type="button" className={value.hijab ? 'on' : ''} onClick={() => patch({ hijab: !value.hijab })}>{value.hijab ? 'On' : 'Off'}</button></div></fieldset>
              {value.hijab && <Swatches label="Hijab colour" colors={CLOTHES_COLORS} value={value.hijabColor} onChange={(c) => patch({ hijabColor: c })} />}
            </>)}
            {tab === 'clothes' && (<>
              <Swatches label="Top colour" colors={CLOTHES_COLORS} value={value.top} onChange={(c) => patch({ top: c })} />
              <Options label="Bottom style" options={BOTTOM_STYLES} value={value.bottomStyle} onChange={(b) => patch({ bottomStyle: b })} />
              <Swatches label="Bottom colour" colors={CLOTHES_COLORS} value={value.bottom} onChange={(c) => patch({ bottom: c })} />
            </>)}
            {tab === 'extras' && (
              <fieldset className="builder-fieldset"><legend>Accessories</legend>
                <div className="builder-options">
                  <button type="button" className={value.glasses ? 'on' : ''} onClick={() => patch({ glasses: !value.glasses })}>Glasses</button>
                  <button type="button" className={value.beard ? 'on' : ''} onClick={() => patch({ beard: !value.beard })}>Beard</button>
                </div>
              </fieldset>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
