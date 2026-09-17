import type {
  ClothesId,
  HatId,
  MascotLook,
  ShoesId,
  WardrobeSlot,
} from "./types";

export const DEFAULT_LOOK: MascotLook = {
  clothes: "none",
  hat: "none",
  shoes: "none",
};

export interface WardrobeItem<Id extends string = string> {
  id: Id
  slot: WardrobeSlot
  name: string
  blurb: string
  need: number
  premium?: boolean
}

export const CLOTHES: Array<WardrobeItem<ClothesId>> = [
  { id: "none", slot: "clothes", name: "Sem roupa", blurb: "Visual de fábrica.", need: 0 },
  { id: "bowtie", slot: "clothes", name: "Gravata borboleta", blurb: "1 artigo.", need: 1 },
  { id: "stethoscope", slot: "clothes", name: "Estetoscópio", blurb: "4 artigos.", need: 4 },
  { id: "coat", slot: "clothes", name: "Jaleco", blurb: "7 artigos.", need: 7 },
  { id: "scrubs", slot: "clothes", name: "Pijama cirúrgico", blurb: "10 artigos.", need: 10 },
  { id: "hoodie", slot: "clothes", name: "Moletom da ronda", blurb: "13 artigos.", need: 13 },
  { id: "vest", slot: "clothes", name: "Colete", blurb: "16 artigos.", need: 16 },
  { id: "scarf", slot: "clothes", name: "Cachecol", blurb: "19 artigos.", need: 19 },
  { id: "gala", slot: "clothes", name: "Traje de gala", blurb: "Premium · 21 artigos.", need: 21, premium: true },
];

export const HATS: Array<WardrobeItem<HatId>> = [
  { id: "none", slot: "hat", name: "Sem chapéu", blurb: "Cabeça livre.", need: 0 },
  { id: "glasses", slot: "hat", name: "Óculos de ronda", blurb: "2 artigos.", need: 2 },
  { id: "scrubcap", slot: "hat", name: "Touca cirúrgica", blurb: "5 artigos.", need: 5 },
  { id: "beanie", slot: "hat", name: "Gorro", blurb: "8 artigos.", need: 8 },
  { id: "bow", slot: "hat", name: "Laço", blurb: "11 artigos.", need: 11 },
  { id: "headmirror", slot: "hat", name: "Espelho de frente", blurb: "14 artigos.", need: 14 },
  { id: "crown", slot: "hat", name: "Coroa", blurb: "17 artigos.", need: 17 },
  { id: "halo", slot: "hat", name: "Halo", blurb: "Premium · 20 artigos.", need: 20, premium: true },
];

export const SHOES: Array<WardrobeItem<ShoesId>> = [
  { id: "none", slot: "shoes", name: "Descalço", blurb: "Pés no chão.", need: 0 },
  { id: "sneakers", slot: "shoes", name: "Tênis", blurb: "3 artigos.", need: 3 },
  { id: "clogs", slot: "shoes", name: "Crocs de plantão", blurb: "6 artigos.", need: 6 },
  { id: "loafers", slot: "shoes", name: "Mocassim", blurb: "9 artigos.", need: 9 },
  { id: "boots", slot: "shoes", name: "Bota", blurb: "12 artigos.", need: 12 },
  { id: "socks", slot: "shoes", name: "Meias altas", blurb: "15 artigos.", need: 15 },
  { id: "gold", slot: "shoes", name: "Sapatos dourados", blurb: "18 artigos.", need: 18 },
  { id: "wings", slot: "shoes", name: "Asas", blurb: "Premium · 23 artigos.", need: 23, premium: true },
];

export const WARDROBE_SECTIONS: Array<{
  slot: WardrobeSlot
  title: string
  items: WardrobeItem[]
}> = [
  { slot: "clothes", title: "Roupas", items: CLOTHES },
  { slot: "hat", title: "Chapéus", items: HATS },
  { slot: "shoes", title: "Sapatos", items: SHOES },
];

export function isUnlocked(need: number, readCount: number): boolean {
  return readCount >= need;
}

/** Converte o look antigo (um `outfit` só) para chapéu + roupa + sapato. */
export function migrateLook(profile: {
  look?: Partial<MascotLook> | null
  outfit?: string | null
} | undefined): MascotLook {
  const ids = {
    clothes: new Set(CLOTHES.map((i) => i.id)),
    hat: new Set(HATS.map((i) => i.id)),
    shoes: new Set(SHOES.map((i) => i.id)),
  };
  const look = profile?.look;
  if (look && (look.clothes || look.hat || look.shoes)) {
    return {
      clothes: ids.clothes.has(look.clothes as ClothesId) ? (look.clothes as ClothesId) : "none",
      hat: ids.hat.has(look.hat as HatId) ? (look.hat as HatId) : "none",
      shoes: ids.shoes.has(look.shoes as ShoesId) ? (look.shoes as ShoesId) : "none",
    };
  }
  switch (profile?.outfit) {
    case "glasses":
      return { clothes: "none", hat: "glasses", shoes: "none" };
    case "stethoscope":
      return { clothes: "stethoscope", hat: "none", shoes: "none" };
    case "bowtie":
      return { clothes: "bowtie", hat: "none", shoes: "none" };
    case "coat":
      return { clothes: "coat", hat: "none", shoes: "none" };
    case "crown":
      return { clothes: "none", hat: "crown", shoes: "none" };
    default:
      return { ...DEFAULT_LOOK };
  }
}
