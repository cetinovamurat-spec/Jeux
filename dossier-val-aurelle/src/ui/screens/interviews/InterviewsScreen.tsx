/**
 * Entretiens (route '/entretiens', '/entretiens/:personne'): the people of the
 * client, their mood and availability, the sessions (plan J5 §5, §6, §17).
 * Placeholder until the interviews lot (J5b).
 */
import { PageHeader } from '../../components/ui';
import { Placeholder } from '../../components/Placeholder';

export function InterviewsScreen() {
  return (
    <div>
      <PageHeader title="Entretiens" description="Entretiens avec la direction et les services de l’entité : questions, pièces présentées, comptes rendus à corroborer." />
      <Placeholder>Les entretiens ne sont pas encore ouverts dans cette version du dossier.</Placeholder>
    </div>
  );
}
