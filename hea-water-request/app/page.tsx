import Link from "next/link";
import { Header } from "@/components/Header";
import { WaterRequestModal } from "@/components/WaterRequestModal";

export default function Home() {
  return (
    <main className="min-h-screen bg-offwhite">
      <Header />

      {/* Hero strip */}
      <div className="bg-gradient-to-br from-aqua/60 via-offwhite to-sage/40 px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-navy/60">
            Water Solutions · Precision · Design · Sustainability
          </p>
          <h1 className="font-display text-2xl font-bold text-navy-deep sm:text-3xl">
            แบบฟอร์มขอใช้น้ำประปา
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            กรอกข้อมูลผู้ขอใช้บริการและกำหนดตำแหน่งติดตั้งบนแผนที่ ระบบจะบันทึกคำขอของท่านเข้าสู่ฐานข้อมูลกลางโดยอัตโนมัติ
          </p>
        </div>
      </div>

      {/* CTA card — opens the request form in a modal */}
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <div className="flex flex-col items-center gap-5 rounded-card border border-slate-200 bg-white px-6 py-14 text-center shadow-soft sm:px-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aqua/50 text-2xl">
            💧
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-navy-deep">
              พร้อมยื่นคำขอใช้น้ำประปาแล้วหรือยัง?
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-slate-500">
              กดปุ่มด้านล่างเพื่อกรอกข้อมูลผู้ขอใช้บริการและกำหนดตำแหน่งติดตั้งบนแผนที่
            </p>
          </div>
          <WaterRequestModal />
          <Link
            href="/status"
            className="text-sm font-medium text-navy underline-offset-4 hover:underline"
          >
            ดูสถานะคำร้องของฉัน →
          </Link>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-xs text-slate-400 sm:px-10">
        HYDRO ENTERPRISE AND AQUA DESIGN CO., LTD. · info@hea.co.th · www.hea.co.th
      </footer>
    </main>
  );
}
