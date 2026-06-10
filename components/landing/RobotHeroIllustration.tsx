"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type DeviceNavigator = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

export function RobotHeroIllustration() {
  const illustrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const deviceNavigator = navigator as DeviceNavigator;
    const connection = deviceNavigator.connection;
    const hasLimitedMemory =
      typeof deviceNavigator.deviceMemory === "number" &&
      deviceNavigator.deviceMemory <= 4;
    const hasLimitedCpu =
      typeof deviceNavigator.hardwareConcurrency === "number" &&
      deviceNavigator.hardwareConcurrency <= 4;
    const hasSlowConnection =
      connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";

    if (hasLimitedMemory || hasLimitedCpu || hasSlowConnection) {
      illustrationRef.current?.classList.add("landing-effects-disabled");
    }
  }, []);

  return (
    <div
      ref={illustrationRef}
      className="landing-robot-group relative w-[min(68vw,17rem)] sm:w-[min(48vw,22rem)] lg:w-[min(30vw,27rem)] xl:w-[30rem]"
    >
      <Image
        src="/bot-wizard.png"
        alt="ربات جادویی BotWizard"
        width={882}
        height={882}
        preload
        sizes="(max-width: 640px) 68vw, (max-width: 1024px) 48vw, 30vw"
        className="landing-robot-float h-auto w-full object-contain"
      />
      <Image
        src="/Telegram_blue_icon.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        sizes="(max-width: 640px) 10vw, (max-width: 1024px) 8vw, 4.5vw"
        className="landing-platform-orbit landing-platform-orbit-telegram absolute -right-[1%] top-[22%] z-10 h-auto w-[15%] object-contain"
      />
      <Image
        src="/Bale_logo.png"
        alt=""
        aria-hidden="true"
        width={1280}
        height={1280}
        sizes="(max-width: 640px) 8vw, (max-width: 1024px) 7vw, 3.5vw"
        className="landing-platform-orbit landing-platform-orbit-bale absolute right-[14%] top-[42%] z-30 h-auto w-[12%] object-contain"
      />
      <Image
        src="/sparkles.png"
        alt=""
        aria-hidden="true"
        width={419}
        height={588}
        sizes="(max-width: 640px) 17vw, (max-width: 1024px) 12vw, 8vw"
        className="landing-sparkle-float absolute right-0 top-[16%] z-20 h-auto w-[24%] object-contain"
      />
    </div>
  );
}
