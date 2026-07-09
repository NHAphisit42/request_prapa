"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { THAI_ADDRESS, PWA_BRANCHES } from "@/lib/thai-address";

// Leaflet touches `window`, so the map must be client-only with SSR disabled.
const LocationMap = dynamic(
  () => import("./LocationMap").then((m) => m.LocationMap),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function MapSkeleton() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-card border border-slate-200 bg-slate-50 text-sm text-slate-400">
      กำลังโหลดแผนที่…
    </div>
  );
}

type LatLng = { lat: number; lng: number };
type Status = "idle" | "submitting" | "success" | "error";

export function WaterRequestForm() {
  // Applicant
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Cascading address
  const [provinceName, setProvinceName] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [subdistrictName, setSubdistrictName] = useState("");
  const [branch, setBranch] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  // Map
  const [point, setPoint] = useState<LatLng | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const province = useMemo(
    () => THAI_ADDRESS.find((p) => p.name === provinceName),
    [provinceName]
  );
  const district = useMemo(
    () => province?.districts.find((d) => d.name === districtName),
    [province, districtName]
  );

  const isValid =
    fullName.trim() &&
    nationalId.trim().length === 13 &&
    phone.trim() &&
    provinceName &&
    districtName &&
    subdistrictName &&
    branch &&
    point;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/submit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          nationalId,
          phone,
          email,
          province: provinceName,
          district: districtName,
          subdistrict: subdistrictName,
          branch,
          addressDetail,
          latitude: point?.lat,
          longitude: point?.lng,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message ?? "ส่งคำขอไม่สำเร็จ");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-sage-olive/30 bg-sage/30 p-10 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navy text-2xl text-white">
          ✓
        </div>
        <h2 className="font-display text-xl font-bold text-navy-deep">
          ส่งคำขอใช้น้ำประปาเรียบร้อยแล้ว
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          ข้อมูลของท่านถูกบันทึกลงระบบแล้ว เจ้าหน้าที่จะติดต่อกลับภายใน 3–5 วันทำการ
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-navy px-6 py-2.5 text-sm font-medium text-white transition hover:bg-navy-deep"
        >
          ส่งคำขอใหม่
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Notice banner, matching reference layout */}
      <div className="flex items-start gap-3 rounded-xl bg-aqua/40 px-5 py-3.5 text-sm text-navy-deep">
        <span className="mt-0.5 text-base">ℹ️</span>
        <p>กรุณากรอกข้อมูลผู้ขอใช้บริการและตรวจสอบพื้นที่ที่ต้องการขอใช้น้ำ เพื่อความสะดวกในการรับบริการ</p>
      </div>

      {/* Section 1 — Applicant */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="1" title="ข้อมูลผู้ขอใช้บริการ" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="ชื่อ-นามสกุล" required>
            <input
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
            />
          </Field>
          <Field label="เลขบัตรประชาชน" required>
            <input
              className="field-input"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="13 หลัก"
              inputMode="numeric"
            />
          </Field>
          <Field label="เบอร์โทรศัพท์" required>
            <input
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08X-XXX-XXXX"
              inputMode="tel"
            />
          </Field>
          <Field label="อีเมล">
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
        </div>
      </section>

      {/* Section 2 — Location, mirrors the reference form */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="2" title="กำหนดตำแหน่งที่ต้องการติดตั้ง" />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="จังหวัด" required>
            <select
              className="field-select"
              value={provinceName}
              onChange={(e) => {
                setProvinceName(e.target.value);
                setDistrictName("");
                setSubdistrictName("");
              }}
            >
              <option value="">กรุณาเลือก...</option>
              {THAI_ADDRESS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="อำเภอ/เขต" required>
            <select
              className="field-select"
              value={districtName}
              disabled={!province}
              onChange={(e) => {
                setDistrictName(e.target.value);
                setSubdistrictName("");
              }}
            >
              <option value="">กรุณาเลือก...</option>
              {province?.districts.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="ตำบล/แขวง" required>
            <select
              className="field-select"
              value={subdistrictName}
              disabled={!district}
              onChange={(e) => setSubdistrictName(e.target.value)}
            >
              <option value="">กรุณาเลือก...</option>
              {district?.subdistricts.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="กปภ.สาขา" required>
            <select
              className="field-select"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">กรุณาเลือก...</option>
              {PWA_BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="ที่อยู่ (บ้านเลขที่ / หมู่ / ซอย / ถนน)">
              <input
                className="field-input"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="เช่น 123/45 หมู่ 6 ซอยสุขุมวิท 71"
              />
            </Field>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-500">
            คลิกที่ปุ่มกำหนดจุดติดตั้งแล้วคลิกเลือกตำแหน่งที่แผนที่
          </p>
          <LocationMap value={point} onChange={setPoint} />
        </div>
      </section>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
        {status === "error" && (
          <p className="text-sm text-rose-600 sm:mr-auto">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={!isValid || status === "submitting"}
          className="w-full rounded-xl bg-navy px-8 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-navy-deep disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          {status === "submitting" ? "กำลังบันทึกข้อมูล…" : "ส่งคำขอใช้น้ำประปา"}
        </button>
      </div>
    </form>
  );
}

function SectionHeading({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
        {step}
      </span>
      <h2 className="font-display text-lg font-bold text-navy-deep">{title}</h2>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`field-label ${required ? "field-required" : ""}`}>{label}</label>
      {children}
    </div>
  );
}
