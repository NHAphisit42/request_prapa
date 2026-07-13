export type RequestStatus = "New" | "In Progress" | "Completed" | "Rejected";

export const STATUS_OPTIONS: RequestStatus[] = ["New", "In Progress", "Completed", "Rejected"];

export const STATUS_LABEL_TH: Record<string, string> = {
  New: "รอดำเนินการ",
  "In Progress": "กำลังดำเนินการ",
  Completed: "เสร็จสมบูรณ์",
  Rejected: "ปฏิเสธ",
};

export const STATUS_STYLES: Record<string, string> = {
  New: "bg-aqua/50 text-navy-deep",
  "In Progress": "bg-navy/10 text-navy",
  Completed: "bg-sage/50 text-sage-olive",
  Rejected: "bg-rose-100 text-rose-600",
};
