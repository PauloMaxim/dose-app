export async function copyText(
  value: string,
  visible?: HTMLTextAreaElement | HTMLInputElement | null,
): Promise<boolean> {
  if (visible) {
    try {
      visible.focus();
      visible.select();
      const ok = document.execCommand("copy");
      if (ok) return true;
    } catch {
      /* continue */
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* iframe / permission */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function sharePayload(parts: {
  title: string
  subtitle?: string
  sourceLabel?: string
  sourceUrl?: string
}): string {
  return [parts.title, parts.subtitle, parts.sourceLabel, parts.sourceUrl]
    .filter(Boolean)
    .join("\n");
}
