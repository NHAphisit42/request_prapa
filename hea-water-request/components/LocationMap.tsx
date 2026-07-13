"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker assets don't resolve under bundlers — rebuild a
// brand-navy pin instead of the default blue Leaflet marker.
const pinIcon = new L.DivIcon({
  className: "",
  html: `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 11.7 15.1 23.7 15.7 24.2.4.3.9.5 1.3.5s.9-.2 1.3-.5C18.9 40.7 34 28.7 34 17 34 7.6 26.4 0 17 0Z" fill="#3C549A"/>
    <circle cx="17" cy="17" r="7.5" fill="#FFFFFF"/>
  </svg>`,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
});

type LatLng = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 16, { duration: 0.8 });
  }, [position, map]);
  return null;
}

const DEFAULT_CENTER: LatLng = { lat: 13.7037, lng: 100.6084 }; // Bangkok / Phra Khanong area

export function LocationMap({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (p: LatLng | null) => void;
}) {
  const [placing, setPlacing] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const mapRef = useRef<L.Map | null>(null);

  const handlePick = (p: LatLng) => {
    onChange(p);
    setLatInput(p.lat.toFixed(6));
    setLngInput(p.lng.toFixed(6));
    setPlacing(false);
  };

  const handleSearchLatLng = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      onChange({ lat, lng });
    }
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่งปัจจุบัน");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่งของอุปกรณ์");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="field-label">latitude</label>
          <input
            className="field-input"
            placeholder="13.703700"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="field-label">longitude</label>
          <input
            className="field-input"
            placeholder="100.608400"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleSearchLatLng}
            className="h-[42px] rounded-xl bg-navy px-5 text-sm font-medium text-white shadow-field transition hover:bg-navy-deep"
          >
            ค้นหาและกำหนดจุด
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlacing((v) => !v)}
          className={`rounded-xl px-4 py-2 text-sm font-medium shadow-field transition ${
            placing
              ? "bg-navy-deep text-white"
              : "bg-navy text-white hover:bg-navy-deep"
          }`}
        >
          {placing ? "คลิกบนแผนที่เพื่อกำหนดจุด…" : "กำหนดจุดติดตั้ง"}
        </button>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-navy-deep shadow-field transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <span aria-hidden>📍</span>
          {locating ? "กำลังค้นหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setLatInput("");
            setLngInput("");
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-navy-deep shadow-field transition hover:bg-slate-50"
        >
          ล้างจุดติดตั้ง
        </button>
        <p className="w-full text-xs text-slate-500 sm:w-auto">
          คลิกที่ปุ่ม “กำหนดจุดติดตั้ง” แล้วคลิกเลือกตำแหน่งบนแผนที่ หรือกด “ใช้ตำแหน่งปัจจุบัน”
        </p>
        {locError && <p className="w-full text-xs text-rose-600">{locError}</p>}
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 shadow-soft">
        <MapContainer
          center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
          zoom={13}
          style={{ height: "420px", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {placing && <ClickHandler onPick={handlePick} />}
          {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
          <FlyTo position={value} />
        </MapContainer>
      </div>
    </div>
  );
}
