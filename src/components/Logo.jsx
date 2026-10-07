/**
 * Official PenShift Brand Logo
 * Styled with native 'Syne' Google Font (800 ExtraBold) + Pen Nib Emblem
 * Available in 'light' (navy Pen) or 'dark' (pure white Pen)
 */
export function Logo({ variant = 'light', size = 'default', className = '' }) {
  const isDark = variant === 'dark';

  const iconSizes = {
    sm: 'h-6 w-auto',
    default: 'h-8 sm:h-9 w-auto',
    lg: 'h-10 sm:h-12 w-auto',
    xl: 'h-14 sm:h-16 w-auto',
  }[size] || 'h-8 sm:h-9 w-auto';

  const textSizes = {
    sm: 'text-xl',
    default: 'text-2xl sm:text-[27px]',
    lg: 'text-3xl sm:text-[34px]',
    xl: 'text-4xl sm:text-[46px]',
  }[size] || 'text-2xl sm:text-[27px]';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none brand-logo ${className}`}>
      <img
        src="/penshift-icon.png"
        alt="PenShift"
        className={`${iconSizes} object-contain shrink-0`}
      />
      <span className={`brand-logo-text brand-logo-${size} font-display font-extrabold tracking-[-0.035em] ${textSizes} leading-none flex items-center`}>
        <span className={isDark ? 'text-white' : 'text-slate-950'}>Pen</span>
        <span className={isDark 
          ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent' 
          : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent'}>
          Shift
        </span>
      </span>
    </div>
  );
}

export default Logo;
