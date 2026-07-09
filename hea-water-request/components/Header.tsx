import { HeaLogo } from "./HeaLogo";

const navItems = [
  { label: "หน้าหลัก", href: "#", icon: "home" },
  { label: "ขอใช้น้ำประปา", href: "#", icon: "doc", active: true },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30">
      {/* Top identity bar */}
      <div className="bg-gradient-to-r from-navy-deep to-navy px-6 py-3 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <HeaLogo onDark />
          <span className="hidden rounded-pill bg-white/10 px-4 py-1.5 text-sm font-medium text-white sm:inline-block">
            ขอใช้น้ำประปา
          </span>
        </div>
      </div>

      {/* Secondary nav */}
      <nav className="bg-navy-deep/95 px-6 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-6xl gap-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                item.active
                  ? "border-aqua-sky text-white"
                  : "border-transparent text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="text-base leading-none">
                {item.icon === "home" ? "⌂" : "📄"}
              </span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
