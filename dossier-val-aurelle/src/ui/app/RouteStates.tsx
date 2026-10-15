/** Route states in French: designer-only screens, unknown address, unexpected error. */
import type { ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { useDesigner } from './hooks';

function Notice({ title, children, inShell = true }: { title: string; children: ReactNode; inShell?: boolean }) {
  return (
    <div role="alert" className="mx-auto max-w-2xl rounded-lg border border-line bg-panel px-6 py-6 text-sm">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="mt-1 text-muted">{children}</div>
      {inShell ? (
        <Link to="/" className="mt-4 inline-block text-accent underline-offset-2 hover:underline">
          Revenir au bureau
        </Link>
      ) : (
        <a href="#/" className="mt-4 inline-block text-accent underline-offset-2 hover:underline">
          Revenir au bureau
        </a>
      )}
    </div>
  );
}

/** Renders its children only in designer mode (control screens: clean world, correction key). */
export function DesignerOnly({ children }: { children: ReactNode }) {
  const designer = useDesigner();
  if (designer) return <>{children}</>;
  return <Notice title="Écran réservé au mode concepteur">Cet écran sert à la mise au point du dossier et n’est pas accessible pendant la partie.</Notice>;
}

export function NotFound() {
  return <Notice title="Page introuvable">L’adresse demandée ne correspond à aucun écran du dossier.</Notice>;
}

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Error of a screen, shown inside the shell (navigation stays available). */
export function ScreenError() {
  const error = useRouteError();
  return (
    <Notice title="Une erreur est survenue">
      <p>L’écran n’a pas pu être affiché. Vos travaux sont enregistrés ; vous pouvez revenir au bureau ou recharger la page.</p>
      <p className="mt-2 font-mono text-xs">{errorText(error)}</p>
    </Notice>
  );
}

/** Error of the shell itself (rendered without it). */
export function RootError() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <Notice title="Une erreur est survenue" inShell={false}>
        <p>L’application n’a pas pu être affichée. Vos travaux sont enregistrés ; rechargez la page.</p>
        <p className="mt-2 font-mono text-xs">{errorText(error)}</p>
      </Notice>
    </div>
  );
}
