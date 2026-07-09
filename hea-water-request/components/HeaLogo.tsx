export function HeaLogo({
  size = 44,
  onDark = false,
}: {
  size?: number;
  onDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="50" cy="50" r="40" fill="none" stroke="#CEE2BA" strokeWidth="9" strokeDasharray="180 90" strokeDashoffset="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#C1E7F2" strokeWidth="9" strokeDasharray="130 220" strokeDashoffset="-95" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#3C549A" strokeWidth="9" strokeDasharray="90 260" strokeDashoffset="-215" />
        <circle cx="50" cy="18" r="5" fill="#7BCCDF" />
        <path
          d="M50 32 C62 48, 68 58, 68 68 A18 18 0 0 1 32 68 C32 58, 38 48, 50 32 Z"
          fill="#FFFFFF"
        />
      </svg>
      <div className={onDark ? "text-white" : "text-navy-deep"}>
        <p className="font-display text-[13px] font-bold uppercase leading-tight tracking-wide">
          Hydro Enterprise
          <br />
          and Aqua Design
        </p>
        <p className={`text-[10px] leading-tight ${onDark ? "text-aqua" : "text-navy/70"}`}>
          บริษัท ไฮโดรเอ็นเตอร์ไพร์ส แอนด์ อะควอดีซายน์ จำกัด
        </p>
      </div>
    </div>
  );
}
