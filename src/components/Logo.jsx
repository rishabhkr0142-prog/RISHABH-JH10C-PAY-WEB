import Image from "next/image";
import Link from "next/link";

/**
 * Unified Logo Component for RISHABH JH10C PAY WEB
 *
 * @param {Object} props
 * @param {'icon' | 'full' | 'combo'} [props.variant='icon'] - 'icon' (square crown+R), 'full' (crown+R+text banner), 'combo' (icon + styled brand text)
 * @param {number} [props.size] - Width/height in pixels
 * @param {boolean} [props.priority=false] - For above-the-fold images like navbar
 * @param {string} [props.className=''] - Additional container classes
 * @param {string} [props.textClassName=''] - Additional text classes for combo/showText
 * @param {boolean} [props.showText=false] - Show text next to icon
 * @param {string} [props.subtext='PAY WEB'] - Subtitle badge next to logo
 * @param {string} [props.href] - Optional link URL (e.g. '/')
 */
export default function Logo({
  variant = "icon",
  size,
  priority = false,
  className = "",
  textClassName = "",
  showText = false,
  subtext = "PAY WEB",
  href,
}) {
  // Determine sizing defaults
  const iconSize = size || (variant === "full" ? 220 : 36);
  const iconSrc = iconSize <= 128 ? "/logo-icon-128.png" : "/logo-icon.png";

  const renderVisual = () => {
    if (variant === "full") {
      return (
        <div
          className={`relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-2 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_35px_rgba(255,255,255,0.08)] ${className}`}
        >
          <Image
            src="/logo.png"
            alt="RISHABH JH10C logo"
            width={iconSize}
            height={iconSize}
            priority={priority}
            className="h-auto w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      );
    }

    if (variant === "combo" || showText) {
      return (
        <div className={`group flex items-center gap-3 ${className}`}>
          <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black p-1 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:border-white/25 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <Image
              src={iconSrc}
              alt="RISHABH JH10C logo"
              width={iconSize}
              height={iconSize}
              priority={priority}
              className="rounded-lg object-contain"
            />
          </div>
          <div className={`flex flex-col text-left ${textClassName}`}>
            <span className="font-sans text-sm font-extrabold tracking-tight text-white transition-colors duration-200 group-hover:text-neutral-200">
              RISHABH JH10C
            </span>
            {subtext && (
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-400 group-hover:text-neutral-300">
                {subtext}
              </span>
            )}
          </div>
        </div>
      );
    }

    // Default 'icon' variant
    return (
      <div
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black p-1 shadow-md transition-all duration-300 hover:scale-105 hover:border-white/25 hover:shadow-[0_0_20px_rgba(255,255,255,0.12)] ${className}`}
        style={{ width: iconSize, height: iconSize }}
      >
        <Image
          src={iconSrc}
          alt="RISHABH JH10C logo"
          width={iconSize - 6}
          height={iconSize - 6}
          priority={priority}
          className="rounded-lg object-contain"
        />
      </div>
    );
  };

  if (href) {
    return (
      <Link href={href} className="inline-block outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        {renderVisual()}
      </Link>
    );
  }

  return renderVisual();
}
