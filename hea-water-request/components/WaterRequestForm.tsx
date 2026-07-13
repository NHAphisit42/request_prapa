"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  PHUKET_PROVINCE_NAME,
  THALANG_DISTRICT_NAME,
  ALLOWED_SUBDISTRICTS,
  PWA_BRANCHES,
} from "@/lib/thai-address";
import { isValidThaiNationalId } from "@/lib/national-id";
import { getLiffProfile } from "@/lib/liff";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file — keep well under Graph's simple-upload ceiling

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

const CUSTOMER_TYPE_GROUPS: { title: string; accent: string; options: string[] }[] = [
  {
    title: "ประเภทที่ 1",
    accent: "bg-aqua/60 text-navy-deep",
    options: ["บ้านพักอาศัย", "อื่นๆ"],
  },
  {
    title: "ประเภทที่ 2",
    accent: "bg-sage/60 text-sage-olive",
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
    accent: "bg-navy/10 text-navy",
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

type FieldErrors = {
  fullName?: string;
  nationalId?: string;
  phone?: string;
  subdistrict?: string;
  location?: string;
};

export function WaterRequestForm({ onClose }: { onClose?: () => void } = {}) {
  // Applicant
  const [fullName, setFullName] = useState("");
  const [applicantType, setApplicantType] = useState<ApplicantType>("individual");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Address — this deployment only serves Phuket / Thalang district, so province and
  // district are locked instead of user-selectable. Only the two served ตำบล are offered.
  const provinceName = PHUKET_PROVINCE_NAME;
  const districtName = THALANG_DISTRICT_NAME;
  const branch = PWA_BRANCHES[0]; // fixed, no longer user-selectable
  const [subdistrictName, setSubdistrictName] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  // Installation details
  const [installationType, setInstallationType] = useState<InstallationType>("permanent");
  const [meterSize, setMeterSize] = useState<MeterSize>("half");
  const [meterSizeOther, setMeterSizeOther] = useState("");
  const [nearbyPlace, setNearbyPlace] = useState("");

  // Customer type (single choice across all groups)
  const [customerType, setCustomerType] = useState("");
  const [customerTypeOther, setCustomerTypeOther] = useState("");

  // Documents — each ticked item gets its own file-attach slot.
  const [checkedDocs, setCheckedDocs] = useState<string[]>([]);
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  const [fileError, setFileError] = useState("");

  // Map
  const [point, setPoint] = useState<LatLng | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [requestNo, setRequestNo] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

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

  // Juristic registration numbers use a different checksum than personal national IDs,
  // so only enforce the mod-11 check for individual applicants.
  const nationalIdValid =
    applicantType === "juristic"
      ? /^\d{13}$/.test(nationalId)
      : isValidThaiNationalId(nationalId);

  const fieldErrors: FieldErrors = {};
  if (!fullName.trim()) fieldErrors.fullName = "กรุณาระบุชื่อ-นามสกุล";
  if (!nationalIdValid) {
    fieldErrors.nationalId =
      applicantType === "juristic"
        ? "กรุณาระบุเลขนิติบุคคลให้ครบ 13 หลัก"
        : "เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  }
  if (!phone.trim()) fieldErrors.phone = "กรุณาระบุเบอร์โทรศัพท์";
  if (!subdistrictName) fieldErrors.subdistrict = "กรุณาเลือกตำบล/แขวง";
  if (!point) fieldErrors.location = "กรุณากำหนดตำแหน่งติดตั้งบนแผนที่";

  const isValid = Object.keys(fieldErrors).length === 0 && !fileError;

  useEffect(() => {
    if (attemptedSubmit && Object.keys(fieldErrors).length > 0) {
      errorSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    // Only scroll at the moment a submit attempt is made, not on every keystroke afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptedSubmit]);

  function toggleDoc(doc: string) {
    setCheckedDocs((prev) => {
      if (prev.includes(doc)) {
        setDocFiles((files) => {
          const next = { ...files };
          delete next[doc];
          return next;
        });
        return prev.filter((d) => d !== doc);
      }
      return [...prev, doc];
    });
  }

  function handleDocFiles(doc: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setFileError(`ไฟล์ "${tooBig.name}" มีขนาดเกิน 10MB กรุณาเลือกไฟล์ใหม่`);
      return;
    }
    setFileError("");
    setDocFiles((prev) => ({ ...prev, [doc]: files }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!isValid) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const payload = {
        fullName,
        applicantType,
        nationalId,
        phone,
        email,
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
      };

      // Prefix each file with its document label so the attachment is traceable
      // back to the checklist item it belongs to once it lands in SharePoint.
      const attachedFiles = checkedDocs.flatMap((doc) =>
        (docFiles[doc] ?? []).map((f) => new File([f], `${doc} - ${f.name}`, { type: f.type }))
      );

      // multipart/form-data so attached files ride along with the JSON payload —
      // do NOT set a Content-Type header, the browser fills in the multipart boundary.
      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      attachedFiles.forEach((f) => formData.append("files", f, f.name));

      const res = await fetch("/api/submit-request", {
        method: "POST",
        body: formData,
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

      {attemptedSubmit && Object.keys(fieldErrors).length > 0 && (
        <div
          ref={errorSummaryRef}
          className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm text-rose-700"
        >
          <p className="font-semibold">กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งคำขอ:</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            {Object.values(fieldErrors).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

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
          <Field
            label="ชื่อ-นามสกุล"
            required
            error={attemptedSubmit ? fieldErrors.fullName : undefined}
          >
            <input
              className={`field-input ${
                attemptedSubmit && fieldErrors.fullName ? "border-rose-400" : ""
              }`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
            />
          </Field>
          <Field
            label={applicantType === "juristic" ? "เลขนิติบุคคล" : "เลขบัตรประชาชน"}
            required
            error={
              attemptedSubmit || nationalId.length === 13 ? fieldErrors.nationalId : undefined
            }
          >
            <input
              className={`field-input ${
                (attemptedSubmit || nationalId.length === 13) && fieldErrors.nationalId
                  ? "border-rose-400"
                  : ""
              }`}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="13 หลัก"
              inputMode="numeric"
            />
          </Field>
          <Field label="เบอร์โทรศัพท์" required error={attemptedSubmit ? fieldErrors.phone : undefined}>
            <input
              className={`field-input ${
                attemptedSubmit && fieldErrors.phone ? "border-rose-400" : ""
              }`}
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

      {/* Section 2 — Location */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="2" title="กำหนดตำแหน่งที่ต้องการติดตั้ง" />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="จังหวัด" required>
            <input className="field-input bg-slate-50" value={provinceName} disabled readOnly />
          </Field>
          <Field label="อำเภอ/เขต" required>
            <input className="field-input bg-slate-50" value={districtName} disabled readOnly />
          </Field>
          <Field
            label="ตำบล/แขวง"
            required
            error={attemptedSubmit ? fieldErrors.subdistrict : undefined}
          >
            <select
              className={`field-select ${
                attemptedSubmit && fieldErrors.subdistrict ? "border-rose-400" : ""
              }`}
              value={subdistrictName}
              onChange={(e) => setSubdistrictName(e.target.value)}
            >
              <option value="">กรุณาเลือก...</option>
              {ALLOWED_SUBDISTRICTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <Field label="ที่อยู่ (บ้านเลขที่ / หมู่ / ซอย / ถนน)">
            <input
              className="field-input"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="เช่น 123/45 หมู่ 6 ซอยสุขุมวิท 71"
            />
          </Field>
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
            คลิกที่ปุ่มกำหนดจุดติดตั้งแล้วคลิกเลือกตำแหน่งที่แผนที่ หรือกด “ใช้ตำแหน่งปัจจุบัน”
          </p>
          <LocationMap value={point} onChange={setPoint} />
          {attemptedSubmit && fieldErrors.location && (
            <p className="mt-2 text-xs text-rose-600">{fieldErrors.location}</p>
          )}
        </div>
      </section>

      {/* Section 3 — Customer type */}
      <section className="rounded-card border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <SectionHeading step="3" title="ประเภทผู้ใช้น้ำ" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {CUSTOMER_TYPE_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <span
                className={`inline-block rounded-pill px-3 py-1 text-xs font-semibold ${group.accent}`}
              >
                {group.title}
              </span>
              <div className="mt-3 flex flex-col gap-2">
                {group.options.map((opt) => {
                  const checked = customerType === opt;
                  return (
                    <label
                      key={opt}
                      className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy has-[:focus-visible]:ring-offset-2 ${
                        checked
                          ? "border-navy bg-white font-medium text-navy-deep shadow-field"
                          : "border-transparent bg-white/60 text-slate-600 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="customerType"
                        checked={checked}
                        onChange={() => setCustomerType(opt)}
                        // Full-size + opacity-0 instead of sr-only: a near-zero-size focus
                        // target makes mobile browsers auto-zoom to it on tap, which is what
                        // caused the "screen freezes white" bug reported on the LINE in-app browser.
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          checked ? "border-navy bg-navy" : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {opt}
                    </label>
                  );
                })}
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
        <p className="mb-4 text-sm text-slate-500">ติ๊กเลือกเอกสารที่มี แล้วแนบไฟล์ของเอกสารนั้นได้ทันที</p>
        <div className="space-y-3">
          {DOCUMENT_CHECKLIST.map((doc) => {
            const checked = checkedDocs.includes(doc);
            const files = docFiles[doc] ?? [];
            return (
              <div
                key={doc}
                className={`rounded-xl border px-4 py-3 transition ${
                  checked ? "border-navy/30 bg-aqua/10" : "border-slate-200 bg-white"
                }`}
              >
                <label className="flex items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
                    checked={checked}
                    onChange={() => toggleDoc(doc)}
                  />
                  <span className={checked ? "font-medium text-navy-deep" : ""}>{doc}</span>
                </label>

                {checked && (
                  <div className="mt-3 pl-6">
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocFiles(doc, e.target.files)}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-aqua/50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy-deep hover:file:bg-aqua/70"
                    />
                    {files.length > 0 && (
                      <ul className="mt-1.5 list-inside list-disc text-xs text-slate-500">
                        {files.map((f) => (
                          <li key={f.name}>{f.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">ไฟล์ละไม่เกิน 10MB</p>
        {fileError && <p className="mt-1 text-xs text-rose-600">{fileError}</p>}
      </section>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
        {status === "error" && (
          <p className="text-sm text-rose-600 sm:mr-auto">{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={status === "submitting"}
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
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`field-label ${required ? "field-required" : ""}`}>{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
