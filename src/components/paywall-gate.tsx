import { Link } from "@tanstack/react-router";
import { Mascot, STETH_LOOK } from "@/components/mascot";
import { Button } from "@/components/ui/button";

export function PaywallGate({
  title,
  line,
  teaser,
}: {
  title: string
  line: string
  teaser?: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {teaser && (
        <div className="pointer-events-none min-h-0 flex-1 overflow-hidden opacity-40 blur-[6px]" aria-hidden>
          {teaser}
        </div>
      )}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg/55 px-6 text-center">
        <Mascot mood="happy" streak={4} size={108} look={STETH_LOOK} />
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-teal">Dose+</p>
        <h1 className="mt-1 max-w-[18ch] text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-muted">{line}</p>
        <Button asChild size="lg" className="mt-5 w-full max-w-[280px]">
          <Link to="/planos">Assinar Dose+</Link>
        </Button>
      </div>
    </main>
  );
}

export function PaywallBanner({ title, line }: { title: string; line: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-4 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{line}</p>
      <Button asChild size="sm" className="mt-3">
        <Link to="/planos">Assinar Dose+</Link>
      </Button>
    </div>
  );
}
