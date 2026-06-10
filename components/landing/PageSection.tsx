import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cn } from "@/lib/utils";

type PageSectionProps = ComponentPropsWithoutRef<"section"> & {
  reverse?: boolean;
  stackIndex?: number;
};

type PageSectionSlotProps = ComponentPropsWithoutRef<"div">;

type PageSectionStyle = CSSProperties & {
  "--landing-section-stack": number;
};

function PageSectionRoot({
  reverse = false,
  stackIndex = 0,
  className,
  children,
  style,
  ...props
}: PageSectionProps) {
  const sectionStyle: PageSectionStyle = {
    ...style,
    "--landing-section-stack": stackIndex,
  };

  return (
    <section
      className={cn(
        "landing-page-section max-w-full max-w-dvw",
        reverse && "landing-page-section-reverse",
        className,
      )}
      style={sectionStyle}
      {...props}
    >
      <div className="landing-page-section-inner">{children}</div>
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
