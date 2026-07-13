"use client";

import { useEffect, useMemo, useState } from "react";
import { getLiffProfile } from "@/lib/liff";
import { STATUS_OPTIONS, STATUS_LABEL_TH, STATUS_STYLES } from "@/lib/request-status";

type AdminRequestItem = {
  id: string;
  requestNo: string;
  fullName: string;
  applicantType: string;
  nationalId: string;
  phone: string;
  email: string;
  district: string;
  subdistrict: string;
  addressDetail: string;
  installationType: string;
  meterSize: string;
  customerType: string;
  documents: string;
  attachmentUrls: string[];
  latitude?: number;
  longitude?: number;
  status: string;
  submittedAt: string;
};

type LoadState = "loading" | "ready" | "forbidden" | "error";

export default function AdminPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [items, setItems] = useState<AdminRequestItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Returns "forbidden" if the caller isn't in the AdminRoles list, otherwise the
  // authoritative item list from the server. Shared by the initial load and by
  // changeStatus's re-sync after a failed update.
  async function fetchItems(uid: string): Promise<AdminRequestItem[] | "forbidden"> {
    const res = await fetch(`/api/admin/requests?lineUserId=${encodeURIComponent(uid)}`);
    if (res.status === 403) return "forbidden";
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      throw new Error(b?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    }
    const data = await res.json();
    return data.items ?? [];
  }

  useEffect(() => {
    async function run() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า LIFF ID (NEXT_PUBLIC_LIFF_ID)");

        const profile = await getLiffProfile(liffId);
        if (!profile) return; // liff.login() is redirecting the page

        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);

        const result = await fetchItems(profile.userId);
        if (result === "forbidden") {
          setLoadState("forbidden");
          return;
        }
        setItems(result);
        setLoadState("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        setLoadState("error");
      }
    }
    run();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.requestNo.toLowerCase().includes(q) ||
        item.nationalId.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  async function changeStatus(id: string, status: string) {
    setSavingId(id);
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, status } : it)));
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.message ?? "อัปเดตสถานะไม่สำเร็จ");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ");
      // The update may have actually reached the server even though this request
      // failed/timed out client-side — re-sync with the server's real state
      // instead of guessing at a rollback value.
      try {
        const fresh = await fetchItems(lineUserId);
        if (fresh !== "forbidden") setItems(fresh);
      } catch {
        // Refetch failed too — leave the optimistic UI state as-is.
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-xl font-bold text-navy-deep">จัดการคำร้องขอใช้น้ำประปา</h1>
        {displayName && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <span>💬</span> เข้าสู่ระบบด้วย LINE: {displayName}
          </p>
        )}

        {loadState === "loading" && (
          <p className="mt-8 text-center text-sm text-slate-400">กำลังโหลดข้อมูล…</p>
        )}

        {loadState === "forbidden" && (
          <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            ไม่มีสิทธิ์เข้าถึงหน้านี้ — บัญชี LINE นี้ไม่ได้อยู่ในรายชื่อผู้ดูแลระบบ
          </div>
        )}

        {loadState === "error" && (
          <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMsg}</div>
        )}

        {loadState === "ready" && (
          <>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                className="field-input sm:flex-1"
                placeholder="ค้นหาชื่อ, เบอร์โทร, เลขบัตร, เลขที่คำร้อง"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="field-select sm:w-56"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">ทุกสถานะ</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL_TH[s]}</option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              พบ {filteredItems.length} จาก {items.length} คำร้อง
            </p>

            {filteredItems.length === 0 ? (
              <div className="mt-10 flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aqua/40 text-2xl">
                  💧
                </div>
                <p className="text-sm text-slate-500">ไม่พบคำร้องที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredItems.map((item) => (
                  <div key={item.id} className="rounded-card border border-slate-200 bg-white p-4 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {item.requestNo && (
                          <p className="font-display text-xs font-semibold tracking-wide text-navy/70">
                            {item.requestNo}
                          </p>
                        )}
                        <p className="font-medium text-navy-deep">{item.fullName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.phone}
                          {item.nationalId ? ` · ${item.nationalId}` : ""}
                        </p>
                      </div>

                      <select
                        className={`rounded-pill border-0 px-3 py-1.5 text-xs font-semibold ${
                          STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-500"
                        } ${savingId === item.id ? "opacity-50" : ""}`}
                        value={item.status}
                        disabled={savingId === item.id}
                        onChange={(e) => changeStatus(item.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL_TH[s]}</option>
                        ))}
                      </select>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {[item.district, item.subdistrict].filter(Boolean).join(" / ")}
                      {item.addressDetail ? ` · ${item.addressDetail}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.customerType}
                      {item.installationType ? ` · ${item.installationType}` : ""}
                      {item.meterSize ? ` · ${item.meterSize}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      ยื่นเมื่อ{" "}
                      {new Date(item.submittedAt).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>

                    {item.attachmentUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.attachmentUrls.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-aqua/30 px-2.5 py-1 text-xs font-medium text-navy-deep hover:bg-aqua/50"
                          >
                            📎 เอกสาร {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
