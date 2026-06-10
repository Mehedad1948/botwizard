import { cn } from "@/lib/utils";

export function LandingNotch({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("block w-full shrink-0", className)}
      viewBox="0 0 406 15"
      fill="none"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 10C0 4.47715 4.47715 0 10 0H178.4C182.48 0 183.92 1.05 185.06 4.15C186.08 6.95 188.3 8 192.2 8H213.8C217.7 8 219.92 6.95 220.94 4.15C222.08 1.05 223.52 0 227.6 0H396C401.523 0 406 4.47715 406 10V15H0V10Z"
        fill="white"
      />
    </svg>
  );
}
