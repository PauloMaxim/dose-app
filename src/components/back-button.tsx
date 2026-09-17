import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BackButton({
  to = "/",
  params,
  search,
  className,
}: {
  to?: string
  params?: Record<string, string>
  search?: Record<string, string>
  className?: string
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() =>
        void navigate({
          to: to as never,
          params: params as never,
          search: search as never,
        })
      }
      className={cn(
        "flex size-11 items-center justify-center text-fg",
        className,
      )}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
