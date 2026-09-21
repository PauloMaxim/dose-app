import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type AccountDeletionDialogProps = {
  open: boolean;
  onCancel: () => void;
  onReauthenticate: (password: string) => Promise<boolean>;
  onDelete: () => Promise<void>;
};

export function AccountDeletionDialog({
  open,
  onCancel,
  onReauthenticate,
  onDelete,
}: AccountDeletionDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

  if (!open) return null;

  async function confirmDeletion() {
    if (submissionInFlight.current) return;
    if (confirmation !== "EXCLUIR") {
      setError("Digite EXCLUIR para confirmar a exclusão permanente.");
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const passwordMatches = await onReauthenticate(password);
      if (!passwordMatches) {
        setError("A senha atual não confere. A conta não foi excluída.");
        submissionInFlight.current = false;
        setSubmitting(false);
        return;
      }
      await onDelete();
    } catch {
      setError("Não foi possível excluir sua conta agora. Tente novamente.");
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  function cancel() {
    if (submissionInFlight.current) return;
    setPassword("");
    setConfirmation("");
    setError("");
    onCancel();
  }

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-deletion-title"
        aria-describedby="account-deletion-description"
        className="w-full max-w-md rounded-3xl border border-danger/40 bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-danger/15">
            <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
          </div>
          <div>
            <h2 id="account-deletion-title" className="text-lg font-semibold">
              Excluir conta permanentemente?
            </h2>
            <p
              id="account-deletion-description"
              className="mt-1 text-sm leading-relaxed text-muted"
            >
              Você perderá o acesso à conta e os dados associados sujeitos à exclusão serão
              removidos. Esta ação é permanente e não equivale a sair nem a limpar o cache local.
            </p>
          </div>
        </div>

        <label htmlFor="account-deletion-password" className="mt-5 block text-sm font-medium">
          Senha atual
        </label>
        <input
          id="account-deletion-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none ring-danger focus:ring-2"
        />
        <label htmlFor="account-deletion-confirmation" className="mt-4 block text-sm font-medium">
          Digite EXCLUIR para continuar
        </label>
        <input
          id="account-deletion-confirmation"
          autoComplete="off"
          value={confirmation}
          disabled={submitting}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-2 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none ring-danger focus:ring-2"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="mt-5 w-full bg-danger text-on-accent"
          disabled={submitting || !password || confirmation !== "EXCLUIR"}
          onClick={() => void confirmDeletion()}
        >
          {submitting ? "Excluindo…" : "Excluir minha conta"}
        </Button>
        <button
          type="button"
          className="mt-2 h-11 w-full text-sm font-medium text-muted"
          disabled={submitting}
          onClick={cancel}
        >
          Cancelar
        </button>
      </section>
    </div>
  );
}
