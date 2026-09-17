import { useId } from "react";
import { DEFAULT_LOOK } from "@/lib/outfits";
import type { ClothesId, HatId, MascotLook, ShoesId, WardrobeSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lúmen: cabeça + tronco. Roupa só no corpo; chapéu na cabeça. */

export type MascotMood = "hungry" | "waiting" | "happy" | "sleepy" | "legend";

interface MascotProps {
  mood: MascotMood
  streak: number
  look?: MascotLook
  size?: number
  fed?: boolean
  still?: boolean
  className?: string
}

export function mascotCopy(mood: MascotMood, name: string): { title: string; body: string } {
  switch (mood) {
    case "hungry":
      return { title: `${name} está com fome`, body: "A edição de hoje ainda está aberta." };
    case "sleepy":
      return { title: `${name} ainda espera a ronda`, body: "A dose de hoje não foi lida. Uma edição curta fecha o dia." };
    case "happy":
      return { title: `${name} já recebeu a dose`, body: "Meta cumprida. Volte amanhã — o hábito é o que acumula." };
    case "legend":
      return { title: `${name} está em ofensiva longa`, body: "Sequência estável. Não quebre a cadeia por um dia frouxo." };
    default:
      return { title: `${name} espera a ronda`, body: "Abra a edição de hoje quando tiver os 10–15 minutos." };
  }
}

export function mascotName(): string {
  return "Lúmen";
}

const BODY = "M30 78C30 62 43 54 60 54C77 54 90 62 90 78C90 102 78 118 60 118C42 118 30 102 30 78Z";
const HEAD = "M26 46C26 26 41 12 60 12C79 12 94 26 94 46C94 64 80 74 60 74C40 74 26 64 26 46Z";

const WRAP_FILL: Partial<Record<ClothesId, string>> = {
  coat: "#FFFEF8",
  scrubs: "#3BB8A4",
  hoodie: "#4A5D78",
  vest: "#243044",
  gala: "#1C1C24",
};

export const STETH_LOOK: MascotLook = {
  clothes: "stethoscope",
  hat: "none",
  shoes: "none",
};

export function Mascot({
  mood,
  streak,
  look = DEFAULT_LOOK,
  size = 112,
  fed,
  still,
  className,
}: MascotProps) {
  const uid = useId().replace(/:/g, "");
  const sleepy = mood === "sleepy";
  const hungry = mood === "hungry";
  const happy = mood === "happy" || mood === "legend";
  const glow = streak >= 30 || mood === "legend" || look.hat === "crown" || look.hat === "halo";
  const hideTufts = look.hat === "beanie" || look.hat === "scrubcap";

  return (
    <div
      className={cn("relative", fed && "mascot-fed", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className={cn(
          "mascot-stage",
          !still && hungry && "mascot-hungry",
          !still && happy && "mascot-happy",
          still && "mascot-still",
        )}
      >
        <svg viewBox="0 0 120 128" width={size} height={size} fill="none">
          <defs>
            <clipPath id={`${uid}-body`}>
              <path d={BODY} />
            </clipPath>
          </defs>
          {glow && (
            <ellipse cx="60" cy="70" rx="50" ry="54" fill="none" stroke="#2EE6C5" strokeWidth="8" opacity="0.12" />
          )}
          <ellipse cx="60" cy="122" rx="18" ry="3.4" fill="#000" opacity="0.16" />
          <g className="mascot-body-g">
            {look.shoes === "wings" && <Wings />}
            {look.clothes === "hoodie" && <HoodieBack />}
            {look.clothes === "scarf" && <ScarfBack />}
            <path d={BODY} fill="#E8B86A" />
            <ellipse cx="60" cy="92" rx="16" ry="18" fill="#F6E2B4" />
            <BodyWrap look={look} clip={`url(#${uid}-body)`} />
            <g clipPath={`url(#${uid}-body)`}>
              <ClothesDetails look={look} />
            </g>
            <path d={HEAD} fill="#F0C98A" />
            {!hideTufts && (
              <>
                <ellipse cx="36" cy="16" rx="8" ry="10" fill="#F0C98A" transform="rotate(-28 36 16)" />
                <ellipse cx="84" cy="16" rx="8" ry="10" fill="#F0C98A" transform="rotate(28 84 16)" />
                <ellipse cx="36" cy="16" rx="3.4" ry="5" fill="#E09A3E" transform="rotate(-28 36 16)" />
                <ellipse cx="84" cy="16" rx="3.4" ry="5" fill="#E09A3E" transform="rotate(28 84 16)" />
              </>
            )}
            {look.clothes === "scarf" && <Scarf />}
            <Shoes look={look} />
            <g className="mascot-face-g">
              <OwlFace sleepy={sleepy} hungry={hungry} />
            </g>
            {look.clothes === "bowtie" && <Bowtie />}
            {look.clothes === "stethoscope" && <Stethoscope />}
            <Hats look={look} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function OwlFace({ sleepy, hungry }: { sleepy: boolean; hungry: boolean }) {
  return (
    <g>
      <ellipse cx="36" cy="54" rx="7" ry="4.5" fill="#F0A07A" opacity="0.55" />
      <ellipse cx="84" cy="54" rx="7" ry="4.5" fill="#F0A07A" opacity="0.55" />
      <ellipse cx="44" cy="44" rx="14" ry="15" fill="#FFFEF8" />
      <ellipse cx="76" cy="44" rx="14" ry="15" fill="#FFFEF8" />
      {!sleepy && (
        <>
          <ellipse className="mascot-eye" cx="45" cy="46" rx="6" ry="6.8" fill="#1A1A1E" />
          <ellipse className="mascot-eye mascot-eye-r" cx="75" cy="46" rx="6" ry="6.8" fill="#1A1A1E" />
          <circle cx="47" cy="43" r="2" fill="#fff" />
          <circle cx="77" cy="43" r="2" fill="#fff" />
        </>
      )}
      {sleepy && (
        <>
          <path d="M34 46c7 6 14 6 20 0" stroke="#1A1A1E" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M66 46c7 6 14 6 20 0" stroke="#1A1A1E" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      <path
        d="M55 54c2 8 8 8 10 0 1-4.5-12-4.5-10 0Z"
        fill={hungry ? "#D9783A" : "#F0A04A"}
      />
    </g>
  );
}

function Wings() {
  return (
    <g>
      <path d="M32 70C12 54-4 72 8 98c8 14 22 12 28-2 4-12 2-20-4-26Z" fill="#F8DEA8" />
      <path d="M28 76C14 64 4 80 12 96c6 10 16 8 20-2 2-8 0-14-4-18Z" fill="#E8C078" />
      <path d="M10 94c4 10 14 14 22 6" fill="#F5C518" />
      <path d="M22 80c-8 6-10 18-4 26M26 84c-6 8-6 18-1 24M30 86c-4 8-4 16 0 22" stroke="#D4A04A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M88 70c20-16 36 2 24 28-8 14-22 12-28-2-4-12-2-20 4-26Z" fill="#F8DEA8" />
      <path d="M92 76c14-12 24 4 16 20-6 10-16 8-20-2-2-8 0-14 4-18Z" fill="#E8C078" />
      <path d="M110 94c-4 10-14 14-22 6" fill="#F5C518" />
      <path d="M98 80c8 6 10 18 4 26M94 84c6 8 6 18 1 24M90 86c4 8 4 16 0 22" stroke="#D4A04A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function BodyWrap({ look, clip }: { look: MascotLook; clip: string }) {
  const color = WRAP_FILL[look.clothes];
  if (!color) return null;
  const vneck = look.clothes === "scrubs" || look.clothes === "gala" || look.clothes === "vest";
  return (
    <g clipPath={clip}>
      <path d={BODY} fill={color} />
      {vneck && <path d="M44 58L60 78 76 58" fill="#E8B86A" />}
    </g>
  );
}

function HoodieBack() {
  return (
    <path
      d="M34 62c6-8 14-12 26-12s20 4 26 12c-4 6-14 10-26 10S38 68 34 62Z"
      fill="#3E5168"
    />
  );
}

function ClothesDetails({ look }: { look: MascotLook }) {
  switch (look.clothes) {
    case "coat":
      return (
        <g>
          <path d="M44 62L52 78M76 62L68 78" stroke="#E6DFD2" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M52 78q8-3 16 0" stroke="#E6DFD2" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="60" cy="88" r="1.8" fill="#C4BDB0" />
          <circle cx="60" cy="97" r="1.8" fill="#C4BDB0" />
          <circle cx="60" cy="106" r="1.8" fill="#C4BDB0" />
          <rect x="68" y="92" width="12" height="9" rx="1.6" fill="none" stroke="#D4CFC4" strokeWidth="1.4" />
          <path d="M68 95h12" stroke="#D4CFC4" strokeWidth="1.2" />
          <path d="M36 86v20M84 86v20" stroke="#EDE6D8" strokeWidth="1.2" opacity="0.8" />
        </g>
      );
    case "scrubs":
      return (
        <g>
          <path d="M50 64l10 16 10-16" fill="#2A9A88" />
          <rect x="40" y="92" width="14" height="9" rx="1.6" fill="#2A9A88" />
          <path d="M40 95h14" stroke="#248778" strokeWidth="1.1" />
          <path d="M70 94h12" stroke="#2A9A88" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 84v22M84 84v22" stroke="#2A9A88" strokeWidth="1.2" opacity="0.7" />
        </g>
      );
    case "hoodie":
      return (
        <g>
          <rect x="44" y="90" width="32" height="16" rx="6" fill="#3A4C64" />
          <path d="M44 98h32" stroke="#33455C" strokeWidth="1.2" />
          <path d="M52 70v18M68 70v18" stroke="#F0C98A" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="52" cy="70" r="1.4" fill="#F0C98A" />
          <circle cx="68" cy="70" r="1.4" fill="#F0C98A" />
          <path d="M38 108h44" stroke="#3A4C64" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      );
    case "vest":
      return (
        <g>
          <path d="M60 68v38" stroke="#2EE6C5" strokeWidth="2" />
          <path d="M46 86h7M67 86h7" stroke="#1A2436" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="40" y="92" width="10" height="8" rx="1.4" fill="#1A2436" />
          <rect x="70" y="92" width="10" height="8" rx="1.4" fill="#1A2436" />
          <path d="M42 72v36M78 72v36" stroke="#2EE6C5" strokeWidth="1.2" opacity="0.5" />
        </g>
      );
    case "gala":
      return (
        <g>
          <path d="M48 64l12 22 12-22" fill="#FAFBFF" />
          <path d="M44 66L52 80M76 66L68 80" stroke="#2A2A32" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="60" cy="92" r="2.1" fill="#F5C518" />
          <circle cx="60" cy="102" r="1.5" fill="#F5C518" />
          <path d="M38 88v20M82 88v20" stroke="#2A2A32" strokeWidth="1.2" opacity="0.5" />
        </g>
      );
    default:
      return null;
  }
}

function Bowtie() {
  return (
    <g>
      <ellipse cx="46" cy="72" rx="11" ry="7" fill="#1A1A1E" />
      <ellipse cx="74" cy="72" rx="11" ry="7" fill="#1A1A1E" />
      <ellipse cx="46" cy="72" rx="6" ry="3.2" fill="#2A2A30" />
      <ellipse cx="74" cy="72" rx="6" ry="3.2" fill="#2A2A30" />
      <rect x="54" y="66.5" width="12" height="11" rx="2.5" fill="#0A0A0B" />
      <rect x="57" y="69" width="6" height="6" rx="1.2" fill="#2A2A30" />
    </g>
  );
}

function Stethoscope() {
  return (
    <g strokeLinecap="round">
      <circle cx="28" cy="44" r="4.4" fill="#D5DEE2" stroke="#9AA8AE" strokeWidth="1.1" />
      <circle cx="92" cy="44" r="4.4" fill="#D5DEE2" stroke="#9AA8AE" strokeWidth="1.1" />
      <circle cx="28" cy="44" r="1.8" fill="#2EE6C5" />
      <circle cx="92" cy="44" r="1.8" fill="#2EE6C5" />
      <path d="M28 48c-6 14 2 28 18 32" stroke="#D5DEE2" strokeWidth="2.4" fill="none" />
      <path d="M92 48c6 14-2 28-18 32" stroke="#D5DEE2" strokeWidth="2.4" fill="none" />
      <circle cx="60" cy="86" r="6" fill="#D5DEE2" stroke="#9AA8AE" strokeWidth="1.2" />
      <circle cx="60" cy="86" r="3.2" fill="#2EE6C5" />
    </g>
  );
}

function ScarfBack() {
  return (
    <path
      d="M32 64Q60 80 88 64"
      stroke="#C43B3A"
      strokeWidth="7"
      fill="none"
      strokeLinecap="round"
    />
  );
}

function Scarf() {
  return (
    <g>
      <path
        d="M32 66Q60 82 88 66"
        stroke="#E24B4A"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M74 76c2 16 2 26 1 34" stroke="#E24B4A" strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M84 74c3 14 3 24 2 30" stroke="#C43B3A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M71 94h7M72 100h6M81 92h6M82 98h5" stroke="#FAFBFF" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function Shoes({ look }: { look: MascotLook }) {
  const id = look.shoes;
  if (id === "none") {
    return (
      <g>
        <ellipse cx="48" cy="118" rx="7.5" ry="3.6" fill="#E09A3E" />
        <ellipse cx="72" cy="118" rx="7.5" ry="3.6" fill="#E09A3E" />
      </g>
    );
  }
  const fill =
    id === "clogs" ? "#2EE6C5"
    : id === "loafers" ? "#8B5A2B"
    : id === "boots" ? "#3A2E26"
    : id === "gold" || id === "wings" ? "#F5C518"
    : "#FAFBFF";
  const tall = id === "boots" || id === "socks";
  return (
    <g>
      <ellipse cx="48" cy={tall ? 114 : 118} rx="8.5" ry={tall ? 5.5 : 3.6} fill={fill} />
      <ellipse cx="72" cy={tall ? 114 : 118} rx="8.5" ry={tall ? 5.5 : 3.6} fill={fill} />
      {id === "sneakers" && (
        <>
          <path d="M40 118h16" stroke="#2EE6C5" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M64 118h16" stroke="#2EE6C5" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M41 116h6M65 116h6" stroke="#D8D8DE" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "clogs" && (
        <>
          <circle cx="44" cy="116.5" r="0.9" fill="#1A8F7C" />
          <circle cx="48" cy="116.5" r="0.9" fill="#1A8F7C" />
          <circle cx="68" cy="116.5" r="0.9" fill="#1A8F7C" />
          <circle cx="72" cy="116.5" r="0.9" fill="#1A8F7C" />
        </>
      )}
      {id === "loafers" && (
        <>
          <path d="M42 116h12M66 116h12" stroke="#6A4220" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {id === "boots" && (
        <>
          <path d="M42 110h12M66 110h12" stroke="#2A2018" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {id === "socks" && (
        <>
          <path d="M41 113h14" stroke="#3B8BFF" strokeWidth="1.4" />
          <path d="M65 113h14" stroke="#3B8BFF" strokeWidth="1.4" />
          <path d="M41 116h14" stroke="#3B8BFF" strokeWidth="1.2" opacity="0.6" />
          <path d="M65 116h14" stroke="#3B8BFF" strokeWidth="1.2" opacity="0.6" />
        </>
      )}
      {id === "gold" && (
        <>
          <path d="M42 116h12M66 116h12" stroke="#FFF4C2" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function Hats({ look }: { look: MascotLook }) {
  switch (look.hat) {
    case "glasses":
      return (
        <g>
          <circle cx="44" cy="44" r="13" stroke="#1A1A1E" strokeWidth="2.3" fill="#2EE6C5" fillOpacity="0.08" />
          <circle cx="76" cy="44" r="13" stroke="#1A1A1E" strokeWidth="2.3" fill="#2EE6C5" fillOpacity="0.08" />
          <path d="M57 44h6" stroke="#1A1A1E" strokeWidth="2.3" />
        </g>
      );
    case "scrubcap":
      return <path d="M28 22c4-14 16-20 32-20s28 6 32 20c-8 6-18 9-32 9s-24-3-32-9Z" fill="#B9E6DE" />;
    case "beanie":
      return (
        <g>
          <path d="M28 24c2-14 14-20 32-20s30 6 32 20c-8-3-18-5-32-5s-24 2-32 5Z" fill="#3B8BFF" />
          <path d="M28 22h64" stroke="#2A6BD6" strokeWidth="7" strokeLinecap="round" />
        </g>
      );
    case "bow":
      return (
        <g>
          <ellipse cx="46" cy="12" rx="12" ry="8" fill="#3B8BFF" />
          <ellipse cx="74" cy="12" rx="12" ry="8" fill="#3B8BFF" />
          <circle cx="60" cy="12" r="4.2" fill="#2A6BD6" />
        </g>
      );
    case "headmirror":
      return (
        <g>
          <path d="M30 32q30-12 60 0" stroke="#C9C4B8" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <circle cx="60" cy="26" r="9" fill="#E8F4FA" stroke="#C9C4B8" strokeWidth="2" />
          <circle cx="60" cy="26" r="3.2" fill="none" stroke="#8A8A90" strokeWidth="1.8" />
        </g>
      );
    case "crown":
      return <path d="M32 10l8 10 20-14 20 14 8-10-3 16H35Z" fill="#F5C518" />;
    case "halo":
      return <ellipse cx="60" cy="6" rx="22" ry="6" fill="none" stroke="#F5C518" strokeWidth="3" />;
    default:
      return null;
  }
}

export function SlotGlyph({ slot, id }: { slot: WardrobeSlot; id: string }) {
  return (
    <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
      {slot === "hat" && <GlyphHat id={id as HatId} />}
      {slot === "clothes" && <GlyphClothes id={id as ClothesId} />}
      {slot === "shoes" && <GlyphShoes id={id as ShoesId} />}
    </svg>
  );
}

function GlyphHat({ id }: { id: HatId }) {
  switch (id) {
    case "none":
      return <circle cx="24" cy="24" r="10" stroke="#636366" strokeWidth="1.8" fill="none" strokeDasharray="3 3" />;
    case "glasses":
      return (
        <g fill="none" stroke="#2A2A32" strokeWidth="2.4">
          <circle cx="15" cy="24" r="9" />
          <circle cx="33" cy="24" r="9" />
          <path d="M6 22l-3-2M42 22l3-2" strokeLinecap="round" />
        </g>
      );
    case "scrubcap":
      return <path d="M8 30c2-16 10-22 16-22s14 6 16 22c-6 4-26 4-32 0Z" fill="#B9E6DE" />;
    case "beanie":
      return (
        <g>
          <path d="M8 34c2-20 10-26 16-26s14 6 16 26H8Z" fill="#3B8BFF" />
          <rect x="8" y="30" width="32" height="8" rx="4" fill="#2A6BD6" />
        </g>
      );
    case "bow":
      return (
        <g>
          <ellipse cx="12" cy="24" rx="10" ry="8" fill="#3B8BFF" />
          <ellipse cx="36" cy="24" rx="10" ry="8" fill="#3B8BFF" />
          <rect x="20" y="16" width="8" height="16" rx="2" fill="#2A6BD6" />
        </g>
      );
    case "headmirror":
      return (
        <g>
          <path d="M8 18h32" stroke="#C9C4B8" strokeWidth="5" strokeLinecap="round" />
          <circle cx="24" cy="28" r="12" fill="#E8F4FA" stroke="#C9C4B8" strokeWidth="2.4" />
          <circle cx="24" cy="28" r="4.5" fill="none" stroke="#8A8A90" strokeWidth="2" />
        </g>
      );
    case "crown":
      return <path d="M6 36l6-20 8 12 4-16 4 16 8-12 6 20Z" fill="#F5C518" />;
    case "halo":
      return <ellipse cx="24" cy="24" rx="16" ry="8" fill="none" stroke="#F5C518" strokeWidth="3" />;
    default:
      return null;
  }
}

function GlyphClothes({ id }: { id: ClothesId }) {
  switch (id) {
    case "none":
      return <path d="M16 8h16l8 10v22H8V18Z" stroke="#636366" strokeWidth="1.8" fill="none" strokeDasharray="3 3" />;
    case "bowtie":
      return (
        <g>
          <ellipse cx="12" cy="24" rx="10" ry="8" fill="#1A1A1E" />
          <ellipse cx="36" cy="24" rx="10" ry="8" fill="#1A1A1E" />
          <rect x="20" y="16" width="8" height="16" rx="2" fill="#0A0A0B" />
        </g>
      );
    case "stethoscope":
      return (
        <g fill="none" stroke="#C9C4B8" strokeWidth="2.6" strokeLinecap="round">
          <path d="M14 8c-8 10-6 22 6 26" />
          <path d="M34 8c8 10 6 22-6 26" />
          <circle cx="24" cy="38" r="7" fill="#2EE6C5" stroke="#C9C4B8" />
        </g>
      );
    case "coat":
      return (
        <g>
          <path d="M10 10h8l4 8h4l4-8h8l6 10v24H4V20Z" fill="#F7F4EE" />
          <path d="M18 10l6 14 6-14" fill="#EDE8DC" />
          <circle cx="24" cy="30" r="1.6" fill="#C4BDB0" />
          <circle cx="24" cy="36" r="1.6" fill="#C4BDB0" />
        </g>
      );
    case "scrubs":
      return (
        <g>
          <path d="M10 14h8l6 10 6-10h8l6 8v20H4V22Z" fill="#3BB8A4" />
          <path d="M18 14l6 12 6-12" fill="#2A9A88" />
        </g>
      );
    case "hoodie":
      return (
        <g>
          <path d="M14 18c4-12 16-12 20 0v22H14Z" fill="#4A5D78" />
          <path d="M12 16c4-14 20-14 24 0-8-6-16-6-24 0Z" fill="#44556E" />
        </g>
      );
    case "vest":
      return (
        <g>
          <path d="M14 10h6v30c-6 0-10-4-12-12V18Z" fill="#243044" />
          <path d="M34 10h-6v30c6 0 10-4 12-12V18Z" fill="#243044" />
          <path d="M20 12v26M28 12v26" stroke="#2EE6C5" strokeWidth="1.6" />
        </g>
      );
    case "scarf":
      return (
        <g>
          <path d="M8 16c8-8 24-8 32 0 4 5-4 8-12 6-6-2-14-2-20 0-8 2-4-2 0-6Z" fill="#E24B4A" />
          <path d="M28 22c2 10 4 18 3 24" stroke="#C43B3A" strokeWidth="8" strokeLinecap="round" />
          <path d="M26 28v10M32 30v10" stroke="#FAFBFF" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "gala":
      return (
        <g>
          <path d="M10 10h8l4 8h4l4-8h8l6 10v24H4V20Z" fill="#1C1C24" />
          <path d="M18 12l6 16 6-16" fill="#FAFBFF" />
        </g>
      );
    default:
      return null;
  }
}

function GlyphShoes({ id }: { id: ShoesId }) {
  switch (id) {
    case "none":
      return <ellipse cx="24" cy="30" rx="14" ry="8" stroke="#636366" strokeWidth="1.8" fill="none" strokeDasharray="3 3" />;
    case "sneakers":
      return (
        <g>
          <path d="M6 30c0-8 8-12 22-12h8c4 0 8 4 8 8v8H8c-1 0-2-2-2-4Z" fill="#FAFBFF" />
          <path d="M12 28h20" stroke="#2EE6C5" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case "clogs":
      return <path d="M6 28c0-8 10-12 24-12h8c5 0 8 5 8 9v9H8c-1 0-2-3-2-6Z" fill="#2EE6C5" />;
    case "loafers":
      return <path d="M6 30c0-8 10-12 22-12h8c5 0 8 4 8 8v8H8c-1 0-2-2-2-4Z" fill="#8B5A2B" />;
    case "boots":
      return <path d="M16 6h14v20l12 16H8l8-16Z" fill="#3A2E26" />;
    case "socks":
      return <path d="M18 6c10 0 14 8 14 22 0 12-20 12-20 0 0-10 2-22 6-22Z" fill="#FAFBFF" />;
    case "gold":
      return <path d="M6 30c0-8 10-12 22-12h8c5 0 8 4 8 8v8H8c-1 0-2-2-2-4Z" fill="#F5C518" />;
    case "wings":
      return (
        <g>
          <path d="M4 16c14-14 22-4 22 10-14-2-20 6-22-10Z" fill="#F8DEA8" />
          <path d="M8 20c8-8 14-2 14 8" fill="#E8C078" />
          <path d="M6 24c4 6 10 8 14 2" fill="#F5C518" />
          <path d="M16 34c0-6 8-10 18-10h6c4 0 6 3 6 6v6H16c-1 0-2-1-2-2Z" fill="#F5C518" />
        </g>
      );
    default:
      return null;
  }
}

export function deriveMood(opts: {
  goalMetToday: boolean
  streak: number
  hour: number
}): MascotMood {
  if (opts.streak >= 30 && opts.goalMetToday) return "legend";
  if (opts.goalMetToday) return "happy";
  if (opts.hour >= 21) return "sleepy";
  if (opts.streak === 0) return "hungry";
  return "waiting";
}
