/** Desk: shortcuts to every screen (designer screens in designer mode). */
import { Link } from 'react-router';
import { useDesigner } from '../../app/hooks';
import { NAV } from '../../app/routes';
import { Badge, Card, Kbd } from '../../components/ui';

export function ShortcutsCard() {
  const designer = useDesigner();
  const items = NAV.filter((n) => n.to !== '/' && (designer || !n.designerOnly));
  return (
    <Card
      title="Accès rapides"
      className="@container"
      actions={
        <span className="text-xs text-muted">
          Palette de commandes : <Kbd>Ctrl K</Kbd>
        </span>
      }
    >
      <ul className="grid gap-2 p-3 @lg:grid-cols-2">
        {items.map((n) => (
          <li key={n.to}>
            <Link to={n.to} className="flex h-full flex-col rounded-md border border-line px-3 py-2 hover:border-accent/60 hover:bg-accent-soft">
              <span className="flex items-center gap-2 text-sm font-semibold text-accent">
                {n.label}
                {n.designerOnly && <Badge tone="warn">Concepteur</Badge>}
              </span>
              <span className="mt-0.5 text-xs text-muted">{n.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
