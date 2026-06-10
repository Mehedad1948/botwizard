import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type PageSectionProps = ComponentPropsWithoutRef<"section"> & {
  reverse?: boolean;
};

type PageSectionSlotProps = ComponentPropsWithoutRef<"div">;

function PageSectionRoot({
  reverse = false,
  className,
  children,
  ...props
}: PageSectionProps) {
  return (
    <section
      className={cn(
        "landing-page-section",
        reverse && "landing-page-section-reverse",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

function PageSectionImage({
  className,
  children,
  ...props
}: PageSectionSlotProps) {
  return (
    <div
      className={cn("landing-page-section-image", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function PageSectionContent({
  className,
  children,
  ...props
}: PageSectionSlotProps) {
  return (
    <div
      className={cn("landing-page-section-content", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export const PageSection = Object.assign(PageSectionRoot, {
  Image: PageSectionImage,
  Content: PageSectionContent,
});
