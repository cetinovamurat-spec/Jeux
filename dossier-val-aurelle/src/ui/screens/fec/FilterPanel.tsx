/**
 * Filter form of the FEC explorer (first tab of the criteria panel), bound to
 * the FecQuery of the view store. Every field applies at once: the results are
 * computed in a deferred render, so typing stays fluid.
 */
import type { ReactNode } from 'react';
import { formatDateFr } from '../../../engine/dates';
import { FEC_FIELDS } from '../../../engine/fec';
import { formatEuro } from '../../../engine/format';
import type { Cents } from '../../../engine/money';
import type { FecIndex, FecQuery } from '../../../game/fec-query';
import { Button, Checkbox, cx, Select, TextInput } from '../../components/ui';
import { useFecView } from './fecStore';

export interface FilterPanelProps {
  index: FecIndex;
  /** Full label of each journal code. */
  journalLabels: ReadonlyMap<string, string>;
  /** Function of each user of the accounting software. */
  roles: ReadonlyMap<string, string>;
  /** Multiples offered by the round-amount filter (cents). */
  roundMultiples: readonly Cents[];
  /** Opens the saved-queries tab with the name field focused. */
  onSaveRequest: () => void;
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Label part before the dash: 'Quittancement – interface…' → 'Quittancement'. */
function shortLabel(label: string): string {
  return label.split(' – ')[0] ?? label;
}

function Field({ label, htmlFor, children }: { label: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Group({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className="mb-1 text-xs font-medium text-muted">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Checkbox drawn as a chip (journals, users). */
function ChipCheckbox({ checked, onChange, title, children }: { checked: boolean; onChange: () => void; title?: string; children: ReactNode }) {
  return (
    <label
      title={title}
      className={cx(
        'inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent',
        checked ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line hover:bg-sunken',
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span aria-hidden className={cx('inline-flex size-3 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none', checked ? 'border-accent bg-accent text-panel' : 'border-muted')}>
        {checked ? '✓' : ''}
      </span>
      {children}
    </label>
  );
}

const WEEKEND_LABELS: Readonly<Record<FecQuery['weekend'], string>> = {
  none: 'Aucun filtre',
  entry: 'Datées un week-end',
  validation: 'Validées un week-end',
  either: 'L’un ou l’autre',
};

export function FilterPanel({ index, journalLabels, roles, roundMultiples, onSaveRequest }: FilterPanelProps) {
  const view = useFecView();
  const q = view.query;
  const minInvalid = !!view.minText.trim() && q.minAmount === null;
  const maxInvalid = !!view.maxText.trim() && q.maxAmount === null;
  const rareInvalid = view.rareOn && !(Number.isInteger(Number(view.rareText)) && Number(view.rareText) >= 1);
  // Selected values absent from this year's FEC stay visible so that they can be unticked.
  const journals = [...new Set([...index.journals, ...q.journals])].sort();
  const users = [...new Set([...index.users, ...q.users])].sort();

  return (
    <form onSubmit={(e) => e.preventDefault()} aria-label="Filtres du FEC" className="@container">
      <div className="grid gap-x-5 gap-y-3 p-3 @2xl:grid-cols-2 @4xl:grid-cols-4">
        {/* selection of lines */}
        <div className="min-w-0 space-y-2">
          <Group legend="Journaux">
            <div className="flex flex-wrap gap-1">
              {journals.map((j) => {
                const label = journalLabels.get(j) ?? j;
                const absent = !index.journals.includes(j);
                return (
                  <ChipCheckbox key={j} checked={q.journals.includes(j)} onChange={() => view.patch({ journals: toggle(q.journals, j) })} title={absent ? `${label} (absent de l’exercice)` : label}>
                    <span className="font-mono font-semibold">{j}</span>
                    <span>{shortLabel(label)}</span>
                    <span className="sr-only">{` – ${label}`}</span>
                  </ChipCheckbox>
                );
              })}
            </div>
          </Group>
          <Field label="Comptes (débuts de numéro)" htmlFor="fec-accounts">
            <TextInput id="fec-accounts" value={view.accountsText} onChange={(e) => view.setAccountsText(e.target.value)} placeholder="Ex. 4687 70" inputMode="numeric" autoComplete="off" spellCheck={false} className="w-full font-mono" title="Plusieurs préfixes séparés par des espaces ou des virgules" />
          </Field>
          <Field label="Compte auxiliaire contient" htmlFor="fec-aux">
            <TextInput id="fec-aux" value={q.aux} onChange={(e) => view.patch({ aux: e.target.value })} autoComplete="off" spellCheck={false} placeholder="Numéro ou nom du tiers" className="w-full" />
          </Field>
        </div>

        {/* labels and amounts */}
        <div className="min-w-0 space-y-2">
          <Field label="Mots-clés" htmlFor="fec-keywords">
            <TextInput id="fec-keywords" type="search" value={q.keywords} onChange={(e) => view.patch({ keywords: e.target.value })} placeholder="Libellé, pièce, intitulé…" title="Tous les mots doivent figurer dans le libellé, la référence de pièce ou l’intitulé du compte (sans tenir compte des accents)" autoComplete="off" spellCheck={false} className="w-full" />
          </Field>
          <Group legend="Montant de la ligne (€, débit ou crédit)">
            <div className="grid grid-cols-2 gap-1.5">
              <TextInput
                aria-label="Montant minimum en euros"
                placeholder="minimum"
                inputMode="decimal"
                autoComplete="off"
                value={view.minText}
                onChange={(e) => view.setAmountText('min', e.target.value)}
                aria-invalid={minInvalid}
                className={cx('w-full min-w-0 text-right font-mono', minInvalid && 'border-ko')}
              />
              <TextInput
                aria-label="Montant maximum en euros"
                placeholder="maximum"
                inputMode="decimal"
                autoComplete="off"
                value={view.maxText}
                onChange={(e) => view.setAmountText('max', e.target.value)}
                aria-invalid={maxInvalid}
                className={cx('w-full min-w-0 text-right font-mono', maxInvalid && 'border-ko')}
              />
            </div>
            {(minInvalid || maxInvalid) && (
              <p role="alert" className="mt-0.5 text-[11px] leading-snug text-ko">
                Montant non reconnu : saisissez un nombre (virgule décimale acceptée).
              </p>
            )}
          </Group>
          <Field label="Montants ronds" htmlFor="fec-round">
            <Select id="fec-round" value={String(q.roundMultiple)} onChange={(e) => view.patch({ roundMultiple: Number(e.target.value) })} className="w-full">
              <option value="0">Aucun filtre</option>
              {roundMultiples.map((m) => (
                <option key={m} value={String(m)}>
                  Multiples de {formatEuro(m, 0)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* dates */}
        <div className="min-w-0 space-y-2">
          <Group legend="Date d’écriture (du – au)">
            <div className="grid grid-cols-2 gap-1.5">
              <TextInput type="date" aria-label="Date d’écriture : du" value={q.entryFrom} max={q.entryTo || undefined} onChange={(e) => view.patch({ entryFrom: e.target.value })} className="w-full min-w-0 px-1 text-xs" />
              <TextInput type="date" aria-label="Date d’écriture : au" value={q.entryTo} min={q.entryFrom || undefined} onChange={(e) => view.patch({ entryTo: e.target.value })} className="w-full min-w-0 px-1 text-xs" />
            </div>
          </Group>
          <Group legend="Date de validation (du – au)">
            <div className="grid grid-cols-2 gap-1.5">
              <TextInput type="date" aria-label="Date de validation : du" value={q.validFrom} max={q.validTo || undefined} onChange={(e) => view.patch({ validFrom: e.target.value })} className="w-full min-w-0 px-1 text-xs" />
              <TextInput type="date" aria-label="Date de validation : au" value={q.validTo} min={q.validFrom || undefined} onChange={(e) => view.patch({ validTo: e.target.value })} className="w-full min-w-0 px-1 text-xs" />
            </div>
          </Group>
          <Checkbox id="fec-after-closing" label={`Validées après la clôture (${formatDateFr(index.closingDate)})`} checked={q.validatedAfterClosing} onChange={(v) => view.patch({ validatedAfterClosing: v })} />
          <Field label="Week-end" htmlFor="fec-weekend">
            <Select id="fec-weekend" value={q.weekend} onChange={(e) => view.patch({ weekend: e.target.value as FecQuery['weekend'] })} className="w-full">
              {(Object.keys(WEEKEND_LABELS) as FecQuery['weekend'][]).map((w) => (
                <option key={w} value={w}>
                  {WEEKEND_LABELS[w]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* users and entry tests */}
        <div className="min-w-0 space-y-2">
          <Group legend="Saisie par (utilisateur du logiciel)">
            <div className="flex flex-wrap gap-1">
              {users.map((u) => {
                const role = index.users.includes(u) ? roles.get(u) : 'absent de l’exercice';
                return (
                  <ChipCheckbox key={u} checked={q.users.includes(u)} onChange={() => view.patch({ users: toggle(q.users, u) })} title={role}>
                    <span className="font-mono">{u}</span>
                    {role && <span className="sr-only">{` – ${role}`}</span>}
                  </ChipCheckbox>
                );
              })}
            </div>
          </Group>
          <div>
            <Checkbox id="fec-rare" label="Couples de comptes rares" checked={view.rareOn} onChange={(v) => view.setRare(v)} />
            <div className="mt-0.5 flex items-center gap-1.5 pl-5 text-xs text-muted" title={`Couple compte débité → compte crédité, compté sur l’exercice hors à-nouveaux et écritures de plus de ${index.maxLinesForPairs} lignes`}>
              <label htmlFor="fec-rare-max">vus dans</label>
              <input
                id="fec-rare-max"
                type="number"
                min={1}
                step={1}
                value={view.rareText}
                onChange={(e) => view.setRare(view.rareOn, e.target.value)}
                aria-invalid={rareInvalid}
                className={cx('w-14 rounded-md border bg-panel px-1.5 py-0.5 text-right font-mono text-xs text-ink', rareInvalid ? 'border-ko' : 'border-line')}
              />
              <span>écriture(s) au plus</span>
            </div>
          </div>
          <Checkbox id="fec-missing-piece" label="Sans pièce justificative" checked={q.missingPiece} onChange={(v) => view.patch({ missingPiece: v })} />
          <div title="Toutes les lignes des écritures retenues, et pas seulement celles qui répondent aux filtres">
            <Checkbox id="fec-whole" label="Afficher les écritures complètes" checked={q.wholeEntries} onChange={(v) => view.patch({ wholeEntries: v })} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-1.5">
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted">
          « Saisi par » : champ interne du logiciel comptable, hors des {FEC_FIELDS.length} champs du FEC réglementaire (absent de l’export FEC, repris dans l’export CSV).
        </p>
        <Button variant="ghost" className="px-1.5 py-0 text-xs text-accent" onClick={onSaveRequest}>
          Enregistrer cette requête…
        </Button>
      </div>
    </form>
  );
}
