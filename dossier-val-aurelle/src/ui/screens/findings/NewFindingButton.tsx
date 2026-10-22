/**
 * « Créer un constat » from the object being looked at (owned by J4d): opens
 * the finding form pre-filled with the seed (cycle, objects, evidence,
 * amount) in a dialog, and offers the one-click capture of a question
 * (plan J4 J4-11). Used by the GED, the FEC, the general ledger, the balance,
 * the statements, the worksheets, the samples, the recalculations and the
 * confirmations.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { captureQuestion, draftFromSeed, type FindingDraft, type FindingSeed } from '../../../game/findings';
import { useCase } from '../../app/context';
import { useGame } from '../../app/store';
import { Button, cx } from '../../components/ui';
import { FindingDialog } from './FindingDialog';
import { FindingForm } from './FindingForm';

const NOTICE_MS = 6000;

/** `tabIndex`: -1 inside a row of a table that is not its Tab stop (DataTable). */
export function NewFindingButton({ seed, compact, tabIndex }: { seed: FindingSeed; compact?: boolean; tabIndex?: number }) {
  const c = useCase();
  const act = useGame((s) => s.act);
  const [draft, setDraft] = useState<FindingDraft | null>(null);
  /** The form holds unsaved input: the dialog asks before closing. */
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ id: string; what: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);
  const about = seed.label ? ` : ${seed.label}` : '';
  const open = () => {
    setDirty(false);
    setDraft(draftFromSeed(seed, c.params, 'finding', useGame.getState().game.samples));
  };
  const question = () => {
    act((s) => captureQuestion(s, seed, c.params)[0]);
    const id = useGame.getState().game.findings.items.at(-1)?.id;
    if (id) setNotice({ id, what: 'Question' });
  };
  const small = compact ? 'px-1.5 py-0 text-xs' : undefined;
  return (
    <span
      className={cx('inline-flex items-center gap-1', compact ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap')}
      // the host may be a clickable row (balance, tables): the buttons act on their own
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <Button className={small} tabIndex={tabIndex} onClick={open} aria-haspopup="dialog" aria-label={`Créer un constat${about}`} title={`Créer un constat${about}`}>
        Constat…
      </Button>
      <Button className={cx(small)} tabIndex={tabIndex} onClick={question} aria-label={`Noter une question en un clic${about}`} title={`Noter une question en un clic${about}`}>
        {compact ? '?' : 'Question'}
      </Button>
      <span aria-live="polite" className="text-xs">
        {notice &&
          (compact ? (
            <Link to={`/constats?constat=${encodeURIComponent(notice.id)}`} className="text-ok underline-offset-2 hover:underline" title={notice.what === 'Question' ? `Question ${notice.id} notée : ouvrir` : `Constat ${notice.id} enregistré : ouvrir`}>
              ✓ {notice.id}
              <span className="sr-only">{notice.what === 'Question' ? ` : question ${notice.id} notée` : ` : constat ${notice.id} enregistré`}</span>
            </Link>
          ) : (
            <>
              {notice.what === 'Question' ? `Question ${notice.id} notée` : `Constat ${notice.id} enregistré`}{' '}
              <Link to={`/constats?constat=${encodeURIComponent(notice.id)}`} className="text-accent underline-offset-2 hover:underline">
                ouvrir
              </Link>
            </>
          ))}
      </span>
      {draft && (
        <FindingDialog title="Nouveau constat" dirty={dirty} onClose={() => setDraft(null)}>
          <FindingForm
            initial={draft}
            {...(seed.label ? { context: seed.label } : {})}
            onDirtyChange={setDirty}
            onDone={(id) => {
              setDraft(null);
              const saved = id ? useGame.getState().game.findings.items.find((f) => f.id === id) : undefined;
              if (saved) setNotice({ id: saved.id, what: saved.status === 'question' ? 'Question' : 'Constat' });
            }}
          />
        </FindingDialog>
      )}
    </span>
  );
}
