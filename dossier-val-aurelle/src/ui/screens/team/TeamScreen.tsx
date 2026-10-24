/**
 * Revue de l'équipe (route '/equipe'): worksheets of the team to review, in
 * rework or accepted, work of the members, briefings (plan J5 §8, §17).
 * Placeholder until the team lot (J5c).
 */
import { PageHeader } from '../../components/ui';
import { Placeholder } from '../../components/Placeholder';

export function TeamScreen() {
  return (
    <div>
      <PageHeader title="Revue de l’équipe" description="Feuilles de travail préparées par l’équipe : revue, renvois motivés, consignes aux membres." />
      <Placeholder>La revue des feuilles de l’équipe n’est pas encore ouverte dans cette version du dossier.</Placeholder>
    </div>
  );
}
