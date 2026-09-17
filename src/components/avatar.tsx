import { Camera } from "lucide-react";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = 48,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-elevated", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-sm font-semibold">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

export function AvatarEdit({
  name,
  src,
  onPick,
}: {
  name: string
  src?: string | null
  onPick: (dataUrl: string) => void
}) {
  return (
    <label className="relative inline-block cursor-pointer">
      <Avatar name={name} src={src} size={56} />
      <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-card ring-2 ring-bg">
        <Camera className="size-3 text-muted" />
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") onPick(reader.result);
          };
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}
