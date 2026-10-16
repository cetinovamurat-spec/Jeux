/**
 * Planification (route '/planification', optional '?onglet=seuils|risques|programme'):
 * materiality, risk assessment and work programme (plan J4 §6). Each tab is
 * validated by an explicit action; the desk checklist and the clock read the
 * validations.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { formatDateFr } from '../../../engine/dates';
import { useGame } from '../../app/store';
import { PageHeader, tabId, tabPanelId, Tabs } from '../../components/ui';
import { MaterialityTab } from './MaterialityTab';
import { ProgramTab } from './ProgramTab';
import { RisksTab } from './RisksTab';

type TabKey = 'seuils' | 'risques' | 'programme';
const TAB_STEP: Record<TabKey, 'materiality' | 'risks' | 'program'> = { seuils: 'materiality', risques: 'risks', programme: 'program' };
const ID_PREFIX = 'planification';

function parseTab(v: string | null): TabKey {
  return v === 'risques' || v === 'programme' ? v : 'seuils';
}

export function PlanningScreen() {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('onglet'));
  const validated = useGame((s) => s.game.planning.validated);
  const tabsRef = useRef<HTMLDivElement>(null);

  // the focus follows the selected tab when it moves with the arrow keys
  useEffect(() => {
    const list = tabsRef.current;
    if (list?.contains(document.activeElement)) list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [tab]);

  const go = (t: TabKey) => {
    const p = new URLSearchParams(params);
    if (t === 'seuils') p.delete('onglet');
    else p.set('onglet', t);
    setParams(p, { replace: true });
  };
  const label = (t: TabKey, text: string) => {
    const on = validated[TAB_STEP[t]];
    return (
      <span className="inline-flex items-center gap-1.5">
        {text}
        <span aria-hidden className={on ? 'text-ok' : 'text-muted'}>
          {on ? '☑' : '☐'}
        </span>
        <span className="sr-only">{on ? ` (validé le ${formatDateFr(on)})` : ' (à valider)'}</span>
      </span>
    );
  };

  return (
    <div>
      <PageHeader title="Planification" description="Seuils de signification, évaluation des risques et programme de travail. Chaque étape se valide explicitement ; l’associée relit la planification avant l’intérim." />
      <div ref={tabsRef}>
        <Tabs
          value={tab}
          onChange={go}
          label="Étapes de la planification"
          idPrefix={ID_PREFIX}
          items={[
            { id: 'seuils', label: label('seuils', 'Seuils') },
            { id: 'risques', label: label('risques', 'Risques') },
            { id: 'programme', label: label('programme', 'Programme') },
          ]}
        />
      </div>
      <section id={tabPanelId(ID_PREFIX)} role="tabpanel" aria-labelledby={tabId(ID_PREFIX, tab)} className="pt-4">
        {tab === 'seuils' && <MaterialityTab />}
        {tab === 'risques' && <RisksTab />}
        {tab === 'programme' && <ProgramTab />}
      </section>
    </div>
  );
}
