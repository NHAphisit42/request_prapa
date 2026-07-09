import { Header } from "@/components/Header";
import { WaterRequestForm } from "@/components/WaterRequestForm";

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

      {/* Form */}
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <WaterRequestForm />
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-xs text-slate-400 sm:px-10">
        HYDRO ENTERPRISE AND AQUA DESIGN CO., LTD. · info@hea.co.th · www.hea.co.th
      </footer>
    </main>
  );
}
