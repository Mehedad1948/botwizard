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
        d="M0 10C0 4.47715 4.47715 0 10 0H182.5C185.9 0 187.1 1.05 188.05 4.15C188.9 6.95 190.75 8 194 8H212C215.25 8 217.1 6.95 217.95 4.15C218.9 1.05 220.1 0 223.5 0H396C401.523 0 406 4.47715 406 10V15H0V10Z"
        fill="white"
      />
    </svg>
  );
}
