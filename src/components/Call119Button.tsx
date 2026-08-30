export function Call119Button({
  variant = 'primary',
}: {
  variant?: 'primary' | 'outline';
}) {
  return (
    <a
      className={`call119 call119--${variant}`}
      href="tel:119"
      aria-label="119 응급전화 걸기"
    >
      119 전화
    </a>
  );
}
