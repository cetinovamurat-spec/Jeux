/**
 * Mémo réglementaire (route '/memo'): standards, texts and methods of
 * reference, searchable (plan J5 §12, §17). Placeholder until the memo lot
 * (J5d).
 */
import { PageHeader } from '../../components/ui';
import { Placeholder } from '../../components/Placeholder';

export function MemoScreen() {
  return (
    <div>
      <PageHeader title="Mémo réglementaire" description="Normes d’exercice professionnel, textes applicables aux organismes de logement social et méthodes du cabinet." />
      <Placeholder>Le mémo réglementaire n’est pas encore disponible dans cette version du dossier.</Placeholder>
    </div>
  );
}
