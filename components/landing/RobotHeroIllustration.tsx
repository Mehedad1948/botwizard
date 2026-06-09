import Image from "next/image";

export function RobotHeroIllustration() {
  return (
    <div className="landing-robot-group relative w-[min(68vw,17rem)] sm:w-[min(48vw,22rem)] lg:w-[min(30vw,27rem)] xl:w-[30rem]">
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
        src="/sparkles.png"
        alt=""
        aria-hidden="true"
        width={419}
        height={588}
        sizes="(max-width: 640px) 17vw, (max-width: 1024px) 12vw, 8vw"
        className="landing-sparkle-float absolute right-0 top-[16%] h-auto w-[24%] object-contain"
      />
    </div>
  );
}
