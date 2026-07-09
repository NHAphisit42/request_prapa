"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { THAI_ADDRESS, PWA_BRANCHES } from "@/lib/thai-address";
import { getLiffProfile } from "@/lib/liff";

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
type ApplicantType = "individual" | "juristic";
type InstallationType = "permanent" | "temporary";
type MeterSize = "half" | "one" | "two" | "temporary" | "extend" | "other";

const METER_SIZE_OPTIONS: { value: MeterSize; label: string }[] = [
  { value: "half", label: "1/2 นิ้ว" },
  { value: "one", label: "1 นิ้ว" },
  { value: "two", label: "2 นิ้ว" },
  { value: "temporary", label: "ขอติดตั้งชั่วคราว" },
  { value: "extend", label: "ขอขยายเขตท่อเมน" },
  { value: "other", label: "อื่นๆ" },
];

const CUSTOMER_TYPE_GROUPS: { title: string; options: string[] }[] = [
  {
    title: "ประเภทที่ 1",
    options: ["บ้านพักอาศัย", "อื่นๆ"],
  },
  {
    title: "ประเภทที่ 2",
    options: [
      "ห้องเช่า/บ้านเช่า",
      "ที่ดินว่างเปล่า",
      "ร้านค้า / ธุรกิจครัวเรือน / อาคารพาณิชย์",
      "โรงแรมขนาดเล็ก",
      "หน่วยงานราชการ / รัฐวิสาหกิจ",
      "อื่นๆ",
    ],
  },
  {
    title: "ประเภทที่ 3",
    options: ["ธุรกิจขนาดใหญ่", "โรงแรมขนาดใหญ่", "โรงงาน/อุตสาหกรรม", "บริษัท (มหาชน)", "อื่นๆ"],
  },
];

const DOCUMENT_CHECKLIST = [
  "สำเนาบัตรประชาชน",
  "สำเนาทะเบียนบ้าน",
  "หนังสือมอบอำนาจ",
  "สำเนาโฉนดที่ดิน หรือ สัญญาเช่าซื้อ",
  "หนังสือยินยอมจากเจ้าของที่ดิน",
  "หนังสือรับรองบริษัท",
];

export function WaterRequestForm({ onClose }: { onClose?: () => void } = {}) {
  // Applicant
  const [fullName, setFullName] = useState("");
  const [applicantType, setApplicantType] = useState<ApplicantType>("individual");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");

  // Cascading address
  const [provinceName, setProvinceName] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [subdistrictName, setSubdistrictName] = useState("");
  const [branch, setBranch] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  // Installation details
  const [installationType, setInstallationType] = useState<InstallationType>("permanent");
  const [meterSize, setMeterSize] = useState<MeterSize>("half");
  const [meterSizeOther, setMeterSizeOther] = useState("");
  const [nearbyPlace, setNearbyPlace] = useState("");

  // Customer type (single choice across all groups)
  const [customerType, setCustomerType] = useState("");
  const [customerTypeOther, setCustomerTypeOther] = useState("");

  // Documents
  const [checkedDocs, setCheckedDocs] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Map
  const [point, setPoint] = useState<LatLng | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [requestNo, setRequestNo] = useState("");

  // LINE profile (silently captured via LIFF so we know who submitted the request)
  const [lineUserId, setLineUserId] = useState("");
  const [lineDisplayName, setLineDisplayName] = useState("");

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return; // running outside LIFF context (e.g. local dev without env var) — skip silently
    getLiffProfile(liffId)
      .then((profile) => {
        if (!profile) return; // liff.login() is redirecting the page
        setLineUserId(profile.userId);
        setLineDisplayName(profile.displayName);
      })
      .catch((err) => {
        console.warn("LIFF profile unavailable:", err);
      });
  }, []);

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

  function toggleDoc(doc: string) {
    setCheckedDocs((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
    );
  }

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
          applicantType,
          nationalId,
          phone,
          email,
          lineId,
          province: provinceName,
          district: districtName,
          subdistrict: subdistrictName,
          branch,
          addressDetail,
          installationType,
          meterSize: meterSize === "other" ? meterSizeOther : meterSize,
          nearbyPlace,
          customerType: customerType === "อื่นๆ" ? customerTypeOther : customerType,
          documents: checkedDocs,
          latitude: point?.lat,
          longitude: point?.lng,
          lineUserId,
          lineDisplayName,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message ?? "ส่งคำขอไม่สำเร็จ");
      const data = await res.json();
      setRequestNo(data.requestNo ?? "");
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
        {requestNo && (
          <p className="mt-2 inline-block rounded-pill bg-white px-4 py-1.5 font-display text-sm font-semibold tracking-wide text-navy shadow-field">
            เลขที่คำร้อง: {requestNo}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          ข้อมูลของท่านถูกบันทึกลงระบบแล้ว เจ้าหน้าที่จะติดต่อกลับภายใน 3–5 วันทำการ
        </p>
        <button
          onClick={() => (onClose ? onClose() : window.location.reload())}
          className="mt-6 rounded-xl bg-navy px-6 py-2.5 text-sm font-medium text-white transition hover:bg-navy-deep"
        >
          {onClose ? "ปิดหน้าต่าง" : "ส่งคำขอใหม่"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Notice banner */}
      <div className="flex items-start gap-3 rounded-xl bg-aqua/40 px-5 py-3.5 text-sm text-navy-deep">
        <span className="mt-0.5 text-base">ℹ️</span>
        <p>กรุณากรอกข้อมูลผู้ขอใช้บริการและตรวจสอบพื้นที่ที่ต้องการขอใช้น้ำ เพื่อความสะดวกในการรับบริการ</p>
      </div>

      {lineDisplayName && (
        <div className="flex items-center gap-2 rounded-xl bg-sage/30 px-4 py-2 text-xs font-medium text-sage-olive">
          <span>💬</span>
          เข้าสู่ระบบด้วย LINE: {lineDisplayName}
        </div>
      )}

      {/* Section 1 — Applicant */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="1" title="ข้อมูลผู้ขอใช้บริการ" />

        <div className="mb-5">
          <span className="field-label">ประเภทผู้ขอใช้บริการ</span>
          <div className="mt-2 flex gap-6">
            <RadioOption
              name="applicantType"
              checked={applicantType === "individual"}
              onChange={() => setApplicantType("individual")}
              label="บุคคลธรรมดา"
            />
            <RadioOption
              name="applicantType"
              checked={applicantType === "juristic"}
              onChange={() => setApplicantType("juristic")}
              label="นิติบุคคล"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="ชื่อ-นามสกุล" required>
            <input
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
            />
          </Field>
          <Field label={applicantType === "juristic" ? "เลขนิติบุคคล" : "เลขบัตรประชาชน"} required>
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
          <Field label="LINE ID">
            <input
              className="field-input"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="เช่น @heawater"
            />
          </Field>
        </div>
      </section>

      {/* Section 2 — Location */}
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

        {/* Installation type */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <span className="field-label">แบบการติดตั้ง</span>
            <div className="mt-2 flex gap-6">
              <RadioOption
                name="installationType"
                checked={installationType === "permanent"}
                onChange={() => setInstallationType("permanent")}
                label="ถาวร"
              />
              <RadioOption
                name="installationType"
                checked={installationType === "temporary"}
                onChange={() => setInstallationType("temporary")}
                label="ชั่วคราว"
              />
            </div>
          </div>
          <div>
            <span className="field-label">สถานที่ใกล้เคียง</span>
            <input
              className="field-input mt-2"
              value={nearbyPlace}
              onChange={(e) => setNearbyPlace(e.target.value)}
              placeholder="สถานที่ใกล้เคียงจุดติดตั้ง"
            />
          </div>
        </div>

        <div className="mt-6">
          <span className="field-label">รูปแบบการติดตั้ง / ขนาดมิเตอร์</span>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
            {METER_SIZE_OPTIONS.map((opt) => (
              <RadioOption
                key={opt.value}
                name="meterSize"
                checked={meterSize === opt.value}
                onChange={() => setMeterSize(opt.value)}
                label={opt.label}
              />
            ))}
          </div>
          {meterSize === "other" && (
            <input
              className="field-input mt-3"
              value={meterSizeOther}
              onChange={(e) => setMeterSizeOther(e.target.value)}
              placeholder="ระบุรูปแบบการติดตั้ง"
            />
          )}
        </div>

        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-500">
            คลิกที่ปุ่มกำหนดจุดติดตั้งแล้วคลิกเลือกตำแหน่งที่แผนที่
          </p>
          <LocationMap value={point} onChange={setPoint} />
        </div>
      </section>

      {/* Section 3 — Customer type */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="3" title="ประเภทผู้ใช้น้ำ" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {CUSTOMER_TYPE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-sm font-semibold text-navy-deep">{group.title}</p>
              <div className="flex flex-col gap-2.5">
                {group.options.map((opt) => (
                  <RadioOption
                    key={opt}
                    name="customerType"
                    checked={customerType === opt}
                    onChange={() => setCustomerType(opt)}
                    label={opt}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {customerType === "อื่นๆ" && (
          <input
            className="field-input mt-4"
            value={customerTypeOther}
            onChange={(e) => setCustomerTypeOther(e.target.value)}
            placeholder="ระบุประเภทผู้ใช้น้ำ"
          />
        )}
      </section>

      {/* Section 4 — Documents */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="4" title="แนบเอกสาร" />
        <p className="mb-4 text-sm text-slate-500">ติ๊กเลือกว่ามีเอกสารประเภทใดบ้าง</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DOCUMENT_CHECKLIST.map((doc) => (
            <label key={doc} className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
                checked={checkedDocs.includes(doc)}
                onChange={() => toggleDoc(doc)}
              />
              {doc}
            </label>
          ))}
        </div>

        <div className="mt-5">
          <label className="field-label">แนบรูปภาพหรือไฟล์ PDF (อัพโหลดได้หลายไฟล์)</label>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setAttachedFiles(Array.from(e.target.files ?? []))}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-aqua/50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy-deep hover:file:bg-aqua/70"
          />
          {attachedFiles.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
              {attachedFiles.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          )}
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

function RadioOption({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-slate-300 text-navy focus:ring-navy"
      />
      {label}
    </label>
  );
}
