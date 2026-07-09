# HEA — แบบฟอร์มขอใช้น้ำประปา

Next.js 14 (App Router) + Tailwind CSS. UI สไตล์ตาม `HEA_Brand_Guidelines.pdf`
(Navy #3C549A / Aqua #C1E7F2 / Sage #CEE2BA, ฟอนต์ Prompt) จำลองโครงจากฟอร์ม
"ขอใช้น้ำประปา" ของการประปาส่วนภูมิภาค (จังหวัด/อำเภอ/ตำบล + แผนที่ปักหมุด)

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env.local   # แล้วกรอกค่าตามหัวข้อ SharePoint ด้านล่าง
npm run dev
```

เปิด http://localhost:3000

## โครงสร้างโปรเจกต์

```
app/
  layout.tsx            โหลดฟอนต์ Prompt (ตรงตาม Brand Guideline)
  page.tsx              หน้าแรก: Header + ฟอร์ม
  api/submit-request/   API route → เขียนข้อมูลลง SharePoint list
components/
  Header.tsx             แถบบนสีกรมท่า + เมนู
  HeaLogo.tsx             โลโก้ (วาดเป็น SVG ตามสัดส่วนสี 3 วง)
  LocationMap.tsx         แผนที่ Leaflet ปักหมุด/พิมพ์ lat-lng
  WaterRequestForm.tsx    ฟอร์มหลักทั้งหมด + validate + submit
lib/
  thai-address.ts         โหลดข้อมูลจังหวัด/อำเภอ/ตำบลเต็ม 77 จังหวัดจาก thai-address-data.json
  thai-address-data.json  ข้อมูลที่ trim แล้ว (ที่มา: kongvut/thai-province-data, MIT license)
```

## เชื่อมต่อ SharePoint (ผ่าน Microsoft Graph)

ฟอร์มนี้ไม่ได้เขียนลง SharePoint โดยตรงจากฝั่ง client (ไม่ปลอดภัย — client secret
จะรั่วไปกับ browser) แต่ยิงไปที่ `POST /api/submit-request` ซึ่งรันบนเซิร์ฟเวอร์
แล้วค่อยเรียก Microsoft Graph ให้เขียนแถวใหม่ลง SharePoint List

ขั้นตอนตั้งค่า:

1. **สร้าง SharePoint List** ชื่อ เช่น `WaterRequests` พร้อมคอลัมน์:
   `Title`(ชื่อ-นามสกุล), `NationalID`, `Phone`, `Email`, `Province`, `District`,
   `Subdistrict`, `PWABranch`, `AddressDetail`, `Latitude`(Number), `Longitude`(Number),
   `SubmittedAt`(Date), `Status`(Choice: New/In Review/Approved/Rejected)
2. **ลงทะเบียนแอปใน Entra ID (Azure AD)** → App registrations → New registration
   - เพิ่ม API permission: `Sites.ReadWrite.All` (Application, ไม่ใช่ Delegated) แล้วกด Grant admin consent
   - สร้าง Client secret เก็บไว้
3. คัดลอกค่าใส่ `.env.local` ตาม `.env.example`
4. Deploy ขึ้น hosting ที่รัน Node server ได้ (Vercel / Azure App Service / IIS+Node) —
   **ห้าม** deploy เป็น static export เพราะ API route ต้องมี server runtime

## ข้อจำกัดที่ตั้งใจไว้ (ต้องทำต่อก่อนขึ้นจริง)

- ยังไม่มีการอัปโหลดเอกสารแนบ (สำเนาบัตร ปชช., ทะเบียนบ้าน) — ดูข้อเสนอแนะด้านล่าง
- ยังไม่มีระบบยืนยันตัวตนผู้ยื่นคำขอ (OTP/อีเมลยืนยัน)
- `PWA_BRANCHES` ใน `lib/thai-address.ts` ยังเป็นรายชื่อตัวอย่าง — ควรแทนด้วยรายชื่อ กปภ.สาขาจริงทั้งหมด และถ้าเป็นไปได้ให้ผูกกับจังหวัด/อำเภอ เพื่อกรอง dropdown อัตโนมัติ

## ข้อเสนอแนะเพิ่มเติม

ดูคำตอบในแชทสำหรับรายละเอียด — สรุปสั้น ๆ:

1. อัปโหลดเอกสารแนบ (สำเนาบัตร ปชช./ทะเบียนบ้าน) → เก็บใน SharePoint document library ที่ผูกกับ List item
2. ยืนยันตัวตนก่อนส่งฟอร์ม (OTP ทาง SMS หรือ magic link ทางอีเมล) กันสแปม/ข้อมูลปลอม
3. ระบบติดตามสถานะคำขอ (เลขที่คำขอ + หน้าค้นหาสถานะ) ให้ผู้ยื่นกลับมาเช็คได้
4. อีเมล/LINE Notify แจ้งเจ้าหน้าที่ทันทีที่มีคำขอใหม่ (Power Automate เชื่อมกับ SharePoint list ง่ายที่สุด)
5. Validate เลขบัตร ปชช. ด้วย checksum จริง (ตอนนี้เช็คแค่ความยาว 13 หลัก)
6. reCAPTCHA / rate limiting บน API route กันบอทยิงฟอร์ม
7. Audit log และสิทธิ์เจ้าหน้าที่ (Power Apps หรือหน้า admin แยก) สำหรับตรวจ/อนุมัติคำขอ
