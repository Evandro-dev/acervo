import { useState } from "react";
import { Calendar } from "lucide-react";
import { ProtectedImage } from "@/components/ui/protected-image";
import { cn } from "@/lib/utils";

type EventCoverThumbProps = {
  cover?: string;
  title: string;
  className?: string;
  iconClassName?: string;
};

export function EventCoverThumb({
  cover,
  title,
  className,
  iconClassName,
}: EventCoverThumbProps) {
  const [failedCover, setFailedCover] = useState<string>();
  const hasImageError = cover === failedCover;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand text-primary-foreground",
        className,
      )}
    >
      {cover && !hasImageError ? (
        <ProtectedImage
          src={cover}
          alt={`Imagem do evento ${title}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedCover(cover)}
        />
      ) : (
        <Calendar className={cn("h-7 w-7", iconClassName)} />
      )}
    </div>
  );
}
