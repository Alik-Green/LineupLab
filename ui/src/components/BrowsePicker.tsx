import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Search, Star } from 'lucide-react';
import clsx from 'clsx';
import type { PickerOption } from './ui';
import { Modal } from './ui';
import { ValImage } from '../lib/images';

/** Compact current-value trigger; the full choice grid lives in an accessible dialog. */
export function BrowsePicker({ label, value, options, onChange, allLabel, kind = 'picker', size = 'md', disabled, searchable, header, favoriteIds, onToggleFavorite, className, square }: {
  label: string; value: string; options: PickerOption[]; onChange(id: string): void; allLabel: string;
  kind?: string; size?: 'md' | 'lg'; disabled?: boolean; searchable?: boolean; header?: ReactNode;
  favoriteIds?: string[]; onToggleFavorite?(id: string): void; className?: string; square?: boolean;
}) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);
  const current = options.find(o => o.id === value);
  const currentName = current?.name ?? allLabel;
  const shown = options.filter(o => !query || o.name.toLowerCase().includes(query.toLowerCase()) || o.sublabel?.toLowerCase().includes(query.toLowerCase()));
  const choose = (id: string) => { onChange(id); setOpen(false); };
  const lower = label.toLowerCase();
  return <div className={clsx('ll-browse-picker', square && 'll-browse-picker--square', className)}>
    <button type="button" className="ll-browse-picker__trigger" aria-label={`Choose ${lower}`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen(true)}>
      <span className="ll-browse-picker__thumb">{current?.icon ? <ValImage src={current.icon} alt="" kind={kind} className="ll-browse-picker__img" imgClassName="ll-browse-picker__img" /> : <span className="ll-browse-picker__all" aria-hidden>{value ? currentName.slice(0, 2) : 'All'}</span>}</span>
      <span className="ll-browse-picker__text"><small>{label}</small><strong>{disabled ? 'Select an agent' : currentName}</strong></span>
      <ChevronDown size={16} aria-hidden />
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Choose ${lower}`}>
      <div className="ll-browse-picker__dialog">
        {header}
        {searchable && <div className="ll-agent-search ll-browse-picker__search"><Search size={14} /><input aria-label={`Search ${lower}`} placeholder={`Search ${lower}`} value={query} onChange={e => setQuery(e.target.value)} /></div>}
        <div role="listbox" aria-label={label} className={clsx('ll-browse-picker__grid', `ll-browse-picker__grid--${size}`)}>
          <button type="button" role="option" aria-selected={value === ''} className={clsx('ll-picker-tile ll-picker-tile--all', value === '' && 'is-selected')} onClick={() => choose('')}><span>{allLabel}</span></button>
          {shown.map(o => {
            const fav = favoriteIds?.includes(o.id) ?? false;
            const tile = <button type="button" role="option" aria-selected={value === o.id} disabled={o.disabled} title={o.name} className={clsx('ll-picker-tile', value === o.id && 'is-selected')} onClick={() => choose(o.id)}>
              <ValImage src={o.icon} alt={o.name} kind={kind} className="ll-picker-tile__img" imgClassName="ll-picker-tile__img" fallbackLabel={o.name.slice(0, 2)} />
              <span className="ll-picker-tile__label">{o.name}</span>{o.sublabel && <small>{o.sublabel}</small>}
            </button>;
            return onToggleFavorite ? <div key={o.id} className={clsx('ll-agent-tile', value === o.id && 'is-selected')}>{tile}<button type="button" className="ll-agent-fav" aria-label={`${fav ? 'Unpin' : 'Pin'} ${o.name}`} onClick={() => onToggleFavorite(o.id)}><Star size={14} fill={fav ? 'currentColor' : 'none'} /></button></div> : <div key={o.id} className="ll-browse-picker__cell">{tile}</div>;
          })}
        </div>
        {shown.length === 0 && <p className="ll-muted">No matches. Clear the search or choose another role.</p>}
      </div>
    </Modal>
  </div>;
}
