import { Link } from "@tanstack/react-router";
import { Droplet } from "lucide-react";
import type { Article } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StudyPill({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-card-2 px-2.5 py-1 text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ArticleCover({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      crossOrigin="anonymous"
    />
  );
}

export function EditionCard({
  cover,
  title,
  dateLabel,
  kicker,
  href,
}: {
  cover: string
  title: string
  dateLabel: string
  kicker?: string
  href: string
}) {
  return (
    <Link to={href} className="block">
      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="aspect-[16/10] overflow-hidden">
          <ArticleCover src={cover} alt="" />
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2">
        <Droplet className="mt-1 size-5 shrink-0 text-teal" strokeWidth={2.2} />
        <div>
          {kicker && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              {kicker}
            </p>
          )}
          <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-fg">
            {title}
          </h3>
          <p className="mt-1.5 text-sm text-muted">{dateLabel}</p>
        </div>
      </div>
    </Link>
  );
}

export function ArticleRow({
  article,
  minutes,
  completed,
}: {
  article: Article
  minutes?: boolean
  completed?: boolean
}) {
  return (
    <Link
      to="/artigo/$id"
      params={{ id: article.id }}
      className="flex gap-3 rounded-2xl bg-card p-2.5"
    >
      <div className="size-[72px] shrink-0 overflow-hidden rounded-xl">
        <ArticleCover src={article.cover} alt="" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-[15px] font-semibold leading-snug">{article.title}</p>
        <p className="mt-1 truncate text-xs text-muted">
          {article.studyType} · {article.journal} {article.year}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StudyPill>{article.evidenceLevel}</StudyPill>
          {minutes && <StudyPill>{article.minutes} min</StudyPill>}
          {completed && <StudyPill className="text-teal">Lido</StudyPill>}
        </div>
      </div>
    </Link>
  );
}

export function CatalogCard({ article }: { article: Article }) {
  return (
    <Link to="/artigo/$id" params={{ id: article.id }} className="block pb-6">
      <div className="overflow-hidden rounded-2xl">
        <div className="aspect-[16/10] overflow-hidden bg-card">
          <ArticleCover src={article.cover} alt="" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className="flex gap-2 text-[20px] font-semibold leading-snug tracking-tight">
          <Droplet className="mt-0.5 size-5 shrink-0 text-teal" />
          <span>{article.title}</span>
        </h3>
        <p className="mt-1.5 pl-7 text-sm text-muted">
          {new Date(article.publishedAt + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <div className="mt-2 flex items-center gap-2 pl-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            <Droplet className="size-3 text-teal" />
            {article.studyType}
          </span>
        </div>
      </div>
    </Link>
  );
}
