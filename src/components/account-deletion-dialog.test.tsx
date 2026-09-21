// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionDialog } from "./account-deletion-dialog";

afterEach(cleanup);

describe("AccountDeletionDialog", () => {
  it("does not delete on opening and cancel keeps the account untouched", async () => {
    const onDelete = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<AccountDeletionDialog open onCancel={onCancel} onDelete={onDelete} />);

    expect(screen.getByRole("dialog", { name: "Excluir conta permanentemente?" })).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("requires deliberate confirmation and calls deletion once on double-submit", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onDelete = vi.fn(() => pending);
    const user = userEvent.setup();
    render(<AccountDeletionDialog open onCancel={vi.fn()} onDelete={onDelete} />);

    const finalButton = screen.getByRole("button", { name: "Excluir minha conta" });
    expect((finalButton as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Digite EXCLUIR para continuar"), "EXCLUIR");
    fireEvent.click(finalButton);
    fireEvent.click(finalButton);

    expect(onDelete).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Excluindo…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    finish();
  });

  it("shows a non-technical retryable error without reporting success", async () => {
    const user = userEvent.setup();
    render(
      <AccountDeletionDialog
        open
        onCancel={vi.fn()}
        onDelete={vi.fn().mockRejectedValue(new Error("internal service-role detail"))}
      />,
    );

    await user.type(screen.getByLabelText("Digite EXCLUIR para continuar"), "EXCLUIR");
    await user.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível excluir sua conta agora. Tente novamente.",
    );
    expect(screen.queryByText(/service-role/)).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Excluir minha conta" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
