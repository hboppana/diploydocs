import { cn } from "../lib/utils";

export function Logo({
  size = 16,
  className,
  invert = false,
}: {
  size?: number;
  className?: string;
  /** When the logo sits on a dark/brand background, invert the dark pixels to white. */
  invert?: boolean;
}) {
  return (
    <img
      src="/logo.png"
      alt="Diploy"
      width={size}
      height={size}
      className={cn(
        "shrink-0 select-none",
        invert && "[filter:invert(1)_brightness(2)]",
        className
      )}
      draggable={false}
    />
  );
}
