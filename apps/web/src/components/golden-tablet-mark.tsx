// Shared journal brand; the legacy export name keeps existing consumers stable.
export function GoldenTabletMark({ className }: { className?: string }) {
  return (
    <img src="/brand/golden-fehu-v5-128.png" width={128} height={128} alt="Логотип журнала The Golden Tablet" className={`object-contain ${className??'size-7'}`} draggable={false}/>
  );
}
