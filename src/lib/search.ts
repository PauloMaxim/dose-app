import { ARTICLE_TAGS } from "./content";
import type { Article } from "./types";

type Node =
  | { op: "term"; value: string }
  | { op: "and" | "or"; left: Node; right: Node }
  | { op: "not"; child: Node };

type Token =
  | { kind: "term"; value: string }
  | { kind: "and" | "or" | "not" | "lparen" | "rparen" };

const OP_MAP: Record<string, Token["kind"]> = {
  AND: "and",
  E: "and",
  OR: "or",
  OU: "or",
  OUR: "or",
  NOT: "not",
  NAO: "not",
  NÃO: "not",
  NO: "not",
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function articleBlob(a: Article): string {
  const tags = ARTICLE_TAGS[a.id] ?? [];
  return fold(
    [
      a.title,
      a.subtitle,
      a.journal,
      a.studyType,
      a.specialty,
      a.pmid ?? "",
      a.year,
      a.sourceLabel,
      a.synopsis,
      a.tldr,
      a.study,
      a.results,
      a.limitations,
      a.practice,
      a.learned,
      tags.join(" "),
    ].join(" "),
  );
}

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  const src = raw.trim();
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (ch === `"` || ch === "“" || ch === "”") {
      i += 1;
      let buf = "";
      while (i < src.length && src[i] !== `"` && src[i] !== "”") {
        buf += src[i];
        i += 1;
      }
      if (i < src.length) i += 1;
      if (buf.trim()) tokens.push({ kind: "term", value: fold(buf.trim()) });
      continue;
    }
    let buf = "";
    while (i < src.length && !/\s/.test(src[i]!) && src[i] !== "(" && src[i] !== ")") {
      buf += src[i];
      i += 1;
    }
    const op = OP_MAP[buf.toUpperCase()];
    if (op === "and" || op === "or" || op === "not") tokens.push({ kind: op });
    else tokens.push({ kind: "term", value: fold(buf) });
  }
  return tokens;
}

function parse(tokens: Token[]): Node | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseOr(): Node | null {
    let left = parseAnd();
    if (!left) return null;
    while (peek()?.kind === "or") {
      take();
      const right = parseAnd();
      if (!right) break;
      left = { op: "or", left, right };
    }
    return left;
  }

  function parseAnd(): Node | null {
    let left = parseNot();
    if (!left) return null;
    while (peek() && peek()!.kind !== "or" && peek()!.kind !== "rparen") {
      if (peek()!.kind === "and") take();
      if (peek()?.kind === "or" || peek()?.kind === "rparen") break;
      const right = parseNot();
      if (!right) break;
      left = { op: "and", left, right };
    }
    return left;
  }

  function parseNot(): Node | null {
    if (peek()?.kind === "not") {
      take();
      const child = parseNot();
      if (!child) return { op: "term", value: "" };
      return { op: "not", child };
    }
    return parsePrimary();
  }

  function parsePrimary(): Node | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === "lparen") {
      take();
      const inner = parseOr();
      if (peek()?.kind === "rparen") take();
      return inner;
    }
    if (t.kind === "term") {
      take();
      return { op: "term", value: t.value };
    }
    take();
    return parsePrimary();
  }

  return parseOr();
}

function evalNode(node: Node, blob: string): boolean {
  switch (node.op) {
    case "term":
      return node.value.length === 0 ? true : blob.includes(node.value);
    case "and":
      return evalNode(node.left, blob) && evalNode(node.right, blob);
    case "or":
      return evalNode(node.left, blob) || evalNode(node.right, blob);
    case "not":
      return !evalNode(node.child, blob);
  }
}

export function matchQuery(a: Article, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const tokens = tokenize(q);
  if (tokens.length === 0) return true;
  const ast = parse(tokens);
  if (!ast) return true;
  return evalNode(ast, articleBlob(a));
}
