import React from 'react';

interface MiniD20ButtonProps {
  onClick: () => void;
  ariaLabel: string;
  label?: string;
  variant?: 'default' | 'crimson' | 'brass' | 'subtle';
  size?: 'sm' | 'md';
  iconOnly?: boolean;
  className?: string;
  title?: string;
  testId?: string;
}

export const MiniD20Button: React.FC<MiniD20ButtonProps> = ({
  onClick,
  ariaLabel,
  label,
  variant = 'default',
  size = 'sm',
  iconOnly,
  className = '',
  title,
  testId,
}) => {
  const isIconOnly = iconOnly ?? label === undefined;

  const variantClass = {
    default: 'd20-roll-btn--default',
    crimson: 'd20-roll-btn--crimson',
    brass: 'd20-roll-btn--brass',
    subtle: 'd20-roll-btn--subtle',
  }[variant];

  const sizeClasses = isIconOnly
    ? size === 'md'
      ? 'w-10 h-10 p-0'
      : 'w-9 h-9 md:w-8 md:h-8 p-0'
    : size === 'md'
      ? 'min-h-[40px] min-w-[40px] px-2.5 gap-1.5 text-sm'
      : 'min-h-[34px] min-w-[34px] md:min-h-[30px] md:min-w-[30px] px-1.5 gap-1 text-xs';

  const iconSizeClass = isIconOnly
    ? size === 'md'
      ? 'w-5 h-5 shrink-0'
      : 'w-[18px] h-[18px] shrink-0'
    : size === 'md'
      ? 'w-4 h-4 shrink-0'
      : 'w-3.5 h-3.5 shrink-0';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      data-testid={testId ?? 'mini-d20-btn'}
      className={`d20-roll-btn ${variantClass} inline-flex items-center justify-center rounded border font-mono font-semibold tabular-nums transition-colors cursor-pointer select-none shrink-0 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E55353] focus-visible:ring-offset-1 ${sizeClasses} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={isIconOnly ? '1.9' : '1.75'}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconSizeClass}
        aria-hidden="true"
      >
        <polygon points="12 2 21 7.2 21 16.8 12 22 3 16.8 3 7.2 12 2" />
        <polygon points="12 6.5 17.5 15.2 6.5 15.2 12 6.5" strokeWidth="1.35" />
        <line x1="12" y1="2" x2="12" y2="6.5" strokeWidth="1.25" />
        <line x1="21" y1="7.2" x2="17.5" y2="15.2" strokeWidth="1.25" />
        <line x1="3" y1="7.2" x2="6.5" y2="15.2" strokeWidth="1.25" />
        <line x1="12" y1="22" x2="17.5" y2="15.2" strokeWidth="1.25" />
        <line x1="12" y1="22" x2="6.5" y2="15.2" strokeWidth="1.25" />
      </svg>
      {!isIconOnly && label !== undefined && <span className="leading-none">{label}</span>}
    </button>
  );
};
