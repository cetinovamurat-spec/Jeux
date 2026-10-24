/** Desk: audit team, hours budget by member and firm supervisors (§4.5, §4.6, §10.9). */
import type { Difficulty } from '../../../game/state';
import { formatPercent } from '../../../engine/format';
import { useCase } from '../../app/context';
import { useHoursUsed } from '../../app/hooks';
import { useGame } from '../../app/store';
import { Badge, Card, cx } from '../../components/ui';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { assistant: 'Assistant', senior: 'Senior', manager: 'Manager' };

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return `${words[0]!.slice(0, 1)}${words[words.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
      {initials(name)}
    </span>
  );
}

/** Hours in the French format, as in the top bar (« 12,5 h »). */
function hours(h: number): string {
  return `${h.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
}

interface MemberHours {
  id: string;
  name: string;
  role: string;
  allotted: number;
  used: number;
  left: number;
}

function MemberRow({ member: m }: { member: MemberHours }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="px-3 py-1.5 text-left font-normal">
        <div className="flex items-center gap-2">
          <Avatar name={m.name} />
          <div className="min-w-0">
            <p className={cx('leading-tight', m.id === 'senior' && 'font-semibold')}>{m.name}</p>
            <p className="line-clamp-2 text-xs leading-tight text-muted" title={m.role}>
              {m.role}
            </p>
          </div>
        </div>
      </th>
      <td className="num px-1.5 py-1.5">{hours(m.allotted)}</td>
      <td className="num px-1.5 py-1.5 text-muted">{hours(m.used)}</td>
      <td className="num px-3 py-1.5">{hours(m.left)}</td>
    </tr>
  );
}

export function TeamCard() {
  const c = useCase();
  const difficulty = useGame((s) => s.game.difficulty);
  const gp = c.params.game;
  const budget = gp.budgetHours[difficulty];
  const ceiling = Math.round(budget * (1 + gp.overrunTolerancePct / 100));
  const used = useHoursUsed();
  const all = gp.team.map((m) => {
    const allotted = m.hoursByDifficulty[difficulty];
    const spent = used.byMember[m.id];
    return { ...m, allotted, used: spent, left: allotted - spent };
  });
  // Sofia's hours are a separate envelope: the mission budget (top bar, partner's arbitration) is the rest of the team.
  const members = all.filter((m) => m.id !== 'sofia');
  const envelopes = all.filter((m) => m.id === 'sofia');
  const allotted = members.reduce((acc, m) => acc + m.allotted, 0);
  const total = { allotted, used: used.team, left: allotted - used.team };
  const usedPct = budget > 0 ? total.used / budget : 0;

  return (
    <Card title="Équipe et budget" actions={<Badge tone="muted">Niveau {DIFFICULTY_LABEL[difficulty]}</Badge>}>
      <table className="w-full text-sm">
        <caption className="sr-only">Heures allouées, consommées et restantes par membre de l’équipe</caption>
        <thead>
          <tr className="whitespace-nowrap border-b border-line text-xs text-muted">
            <th scope="col" className="px-3 py-1.5 text-left font-medium">
              Membre
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium">
              Allouées
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium">
              Consommées
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">
              Restantes
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </tbody>
        <tbody>
          <tr className="border-b border-line bg-sunken font-semibold">
            <th scope="row" className="px-3 py-1.5 text-left">
              Total de l’équipe
            </th>
            <td className="num px-1.5 py-1.5">{hours(total.allotted)}</td>
            <td className="num px-1.5 py-1.5">{hours(total.used)}</td>
            <td className="num px-3 py-1.5">{hours(total.left)}</td>
          </tr>
        </tbody>
        {envelopes.length > 0 && (
          <tbody>
            <tr>
              <th scope="colgroup" colSpan={4} className="px-3 pb-0.5 pt-2 text-left text-xs font-medium text-muted">
                Enveloppe distincte (hors budget de la mission)
              </th>
            </tr>
            {envelopes.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </tbody>
        )}
      </table>

      <div className="space-y-1.5 px-3 py-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span>Budget de la mission</span>
          <span className="font-mono font-semibold">{hours(budget)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span>Dépassement toléré</span>
          <span className="text-right font-mono">
            {formatPercent(gp.overrunTolerancePct / 100, 0)} <span className="text-xs text-muted">(jusqu’à {hours(ceiling)})</span>
          </span>
        </div>
        <div
          role="meter"
          aria-label="Consommation du budget"
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={total.used}
          aria-valuetext={`${hours(total.used)} consommées sur ${hours(budget)}`}
          className="relative mt-1 h-2 rounded bg-sunken"
        >
          <div className={cx('h-2 rounded', total.used > ceiling ? 'bg-ko' : total.used > budget ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, (total.used / ceiling) * 100)}%` }} />
          <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 bg-ink/70" style={{ left: `${(budget / ceiling) * 100}%` }} title={`Budget : ${hours(budget)}`} />
        </div>
        <p className="text-xs text-muted">
          {hours(total.used)} consommées ({formatPercent(usedPct, 0)} du budget). Au-delà de la tolérance, l’associée impose un arbitrage ; un dépassement non justifié par un risque documenté entame sa confiance.
        </p>
      </div>

      <div className="border-t border-line px-3 py-2.5">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Encadrement – {gp.firmName}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {gp.firm.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <Avatar name={f.name} />
              <span className="min-w-0">
                <span className="block leading-tight">{f.name}</span>
                <span className="block text-xs leading-tight text-muted">{f.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
