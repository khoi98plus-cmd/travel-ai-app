/** DUY GO — logic chính (mobile-first) */
const API_URL = (typeof window !== "undefined" &&
    (window.DUY_GO_API_BASE || window.TRAVEL_API_BASE)
    ? String(window.DUY_GO_API_BASE || window.TRAVEL_API_BASE).replace(/\/$/, "")
    : "https://dulichthuvi.onrender.com");

const DuyAppState = {
    lastQuery: "",
    lastTrip: null,
    lastItinerary: null,
    lastWeather: null,
    fxRateVndPerUsd: 25450,
    /** Khoảng cách bay ước lượng (km) giữa điểm khởi hành và điểm đến */
    lastFlightKm: null,
    lastOrigin: "Sài Gòn",
};

const PERIOD_META = {
    sang: { label: "Sáng", icon: "fa-sun", color: "bg-amber-400 text-amber-950" },
    trua: { label: "Trưa", icon: "fa-utensils", color: "bg-orange-400 text-white" },
    chieu: { label: "Chiều", icon: "fa-cloud-sun", color: "bg-sky-500 text-white" },
    toi: { label: "Tối", icon: "fa-moon", color: "bg-indigo-600 text-white" },
};

/** Tin nóng minh họa — Duy Alerts (ảnh loremflickr theo tag) */
const DUY_ALERT_ITEMS = [
    {
        title: "Tuyết rơi dày trên đỉnh đèo Hà Giang",
        sub: "Không khí lạnh sâu — Duy nhắc bạn áo siêu ấm, găng tay và kiểm tra tuyến trước khi lên đèo.",
        tag: "snow,mountain,vietnam",
    },
    {
        title: "Nắng gắt biển Phú Quốc mùa khô",
        sub: "UV cao — kem SPF 50+, nón rộng vành, nước uống đầy chai; tránh nắng giữa trưa.",
        tag: "beach,tropical,sun",
    },
    {
        title: "Sương mù Đà Lạt sáng sớm",
        sub: "Tầm nhìn hạn chế — lái nhẹ ga, bật đèn sương; có thể hoãn tour đèo nếu cần.",
        tag: "fog,forest,vietnam",
    },
];

const TRAVEL_PHRASES = [
    { vi: "Cho em hỏi giá được không ạ?", en: "Could you tell me the price, please?" },
    { vi: "Cho em xin bill / tính tiền.", en: "Check, please. / The bill, please." },
    { vi: "Chỗ này có wifi không ạ?", en: "Is there Wi‑Fi here?" },
    { vi: "Em bị lạc, nhờ anh chị chỉ giúp.", en: "I'm lost — could you help me?" },
    { vi: "Cảm ơn anh chị nhiều ạ!", en: "Thank you so much!" },
];

function escHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function parseJsonResponse(resp) {
    const text = await resp.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON không hợp lệ:", text.slice(0, 200));
        throw new Error("Phản hồi không phải JSON hợp lệ");
    }
}

function tripImageSeed(data, fallbackQuery) {
    return (data && (data.img_tag || data.place)) || fallbackQuery;
}

function tripCoverImageUrl(data, fallbackQuery) {
    const seed = tripImageSeed(data, fallbackQuery);
    if (typeof ImageEngine !== "undefined" && ImageEngine.loremUrl) {
        return ImageEngine.loremUrl(seed, 1600, 900);
    }
    const tags = String(seed || "vietnam")
        .toLowerCase()
        .replace(/[^a-z0-9\s,]/g, " ")
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 4)
        .join(",") || "vietnam,travel";
    return `https://loremflickr.com/1600/900/${tags}`;
}

function mapsSearchUrl(query) {
    const q = encodeURIComponent(String(query || "Việt Nam"));
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function getOriginInput() {
    const el = document.getElementById("origin-query");
    const v = el && el.value != null ? String(el.value).trim() : "";
    return v || "Sài Gòn";
}

function normalizePlaceName(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** Vé khứ hồi nội địa ước lượng theo km (tham khảo thị trường ~1,5–2,5tr cho tuyến trung bình). */
function estimateDomesticRoundTripVnd(km, tier) {
    const mult = tier === "eco" ? 0.88 : tier === "lux" ? 1.2 : 1;
    if (km == null || Number.isNaN(km)) {
        return Math.round(2000000 * mult);
    }
    if (km < 30) return 0;
    let base;
    if (km < 150) base = 950000 + km * 3500;
    else if (km < 450) base = 1300000 + (km - 150) * 2800;
    else if (km < 950) base = 1750000 + (km - 450) * 1100;
    else if (km < 2200) base = 2300000 + (km - 950) * 650;
    else base = 5200000;
    return Math.round(Math.min(Math.max(base * mult, 750000), 15000000));
}

/** Link tìm vé khứ hồi (Google Flights — hỗ trợ câu tự nhiên A → B). */
function buildRoundTripFlightUrl(origin, dest) {
    const o = String(origin || "Sài Gòn").trim();
    const d = String(dest || "Việt Nam").trim();
    const q = `Round trip flights from ${o} to ${d}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

async function refreshFlightEstimateForRoute(origin, destLabel, tier) {
    const o = String(origin || "Sài Gòn").trim();
    const d = String(destLabel || "").trim();
    DuyAppState.lastOrigin = o;
    if (!d || normalizePlaceName(o) === normalizePlaceName(d)) {
        DuyAppState.lastFlightKm = 0;
        return;
    }
    try {
        const [go, gd] = await Promise.all([geocodePlace(o), geocodePlace(d)]);
        if (go && gd) {
            DuyAppState.lastFlightKm = haversineKm(go.lat, go.lon, gd.lat, gd.lon);
        } else {
            DuyAppState.lastFlightKm = 520;
        }
    } catch {
        DuyAppState.lastFlightKm = 520;
    }
}

/** CID affiliate Agoda (có thể thay sau) — luôn đồng bộ mọi nút đặt phòng DUY GO */
const AGODA_AFFILIATE_CID = "1898905";

/**
 * Link tìm khách sạn Agoda theo điểm đến (ưu tiên tên EN nếu API trả place_en).
 * Cấu trúc: /search?q=...&cid=...
 */
function buildAgodaLink(data, query) {
    const dest = String((data && data.place_en) || query || (data && data.place) || "Việt Nam").trim();
    return `https://www.agoda.com/vi-vn/search?q=${encodeURIComponent(dest)}&cid=${AGODA_AFFILIATE_CID}`;
}

function setAffiliateLinks(data, query, originOverride) {
    const agodaLink = buildAgodaLink(data || {}, query || "");
    const destLabel = String((data && data.place) || query || "Việt Nam").trim();
    const placeForBooking = encodeURIComponent(destLabel);
    const originLabel = originOverride != null && String(originOverride).trim()
        ? String(originOverride).trim()
        : getOriginInput();
    const ag = document.getElementById("aff-agoda");
    const bk = document.getElementById("aff-booking");
    const fl = document.getElementById("aff-flights");
    if (ag) ag.href = agodaLink;
    if (bk) bk.href = `https://www.booking.com/searchresults.html?ss=${placeForBooking}&aid=304142`;
    if (fl) fl.href = buildRoundTripFlightUrl(originLabel, destLabel);
}

function inferPeriod(slot, index) {
    const p = String(slot.period || "").toLowerCase();
    if (PERIOD_META[p]) return p;
    const raw = String(slot.time || "");
    const m = raw.match(/(\d{1,2})\s*:\s*(\d{2})/);
    if (m) {
        let h = parseInt(m[1], 10);
        const ap = raw.toLowerCase();
        if (ap.includes("chiều") || ap.includes("chieu") || ap.includes("pm")) {
            if (h < 12) h += 12;
        }
        if (!Number.isNaN(h)) {
            if (h < 11) return "sang";
            if (h < 14) return "trua";
            if (h < 18) return "chieu";
            return "toi";
        }
    }
    return ["sang", "trua", "chieu", "toi"][Math.min(index, 3)];
}

function groupSlotsByPeriod(slots) {
    const order = ["sang", "trua", "chieu", "toi"];
    const buckets = { sang: [], trua: [], chieu: [], toi: [] };
    (slots || []).forEach((slot, i) => {
        if (!slot || typeof slot !== "object") return;
        const k = inferPeriod(slot, i);
        buckets[k].push(slot);
    });
    return order.map((key) => ({ key, slots: buckets[key], meta: PERIOD_META[key] }));
}

/** Timeline Pro: phương tiện, thời gian, đặc sản (từ API hoặc ẩn nếu không có). */
function slotProLinesHtml(slot) {
    const vehicle = slot.vehicle || slot.phuong_tien || "";
    const duration =
        slot.duration ||
        slot.eta ||
        (slot.duration_min != null && !Number.isNaN(Number(slot.duration_min))
            ? `${slot.duration_min} phút`
            : "");
    const food = slot.food || slot.specialty || slot.dac_san || "";
    if (!vehicle && !duration && !food) return "";
    const bits = [];
    if (vehicle) {
        bits.push(
            `<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-950 border border-amber-100/80"><i class="fa-solid fa-route text-amber-600"></i>${escHtml(vehicle)}</span>`
        );
    }
    if (duration) {
        bits.push(
            `<span class="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-950 border border-sky-100/80"><i class="fa-regular fa-clock text-sky-600"></i>${escHtml(duration)}</span>`
        );
    }
    if (food) {
        bits.push(
            `<span class="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-950 border border-rose-100/80"><i class="fa-solid fa-bowl-food text-rose-500"></i>${escHtml(food)}</span>`
        );
    }
    return `<div class="flex flex-wrap gap-2 mt-2">${bits.join("")}</div>`;
}

function clothingAdviceText(tempC, code) {
    const t = typeof tempC === "number" ? tempC : 26;
    const c = Number(code);
    let s = "";
    if (t >= 30) s = "Gợi ý trang phục: đồ cotton mỏng, sandal thoáng, mũ rộng vành.";
    else if (t >= 23) s = "Gợi ý trang phục: áo thun + quần dài nhẹ; mang thêm áo khoác mỏng buổi tối.";
    else s = "Gợi ý trang phục: áo ấm, khăn cổ, giày kín — trời mát/lạnh Duy ôm team!";
    if (!Number.isNaN(c) && c > 50 && c < 78) s += " Nên kẹp thêm ô gấp trong balo.";
    return s;
}

function renderDuyAlerts() {
    const root = document.getElementById("duy-alerts-root");
    if (!root) return;
    root.innerHTML = DUY_ALERT_ITEMS.map((item) => {
        const img =
            typeof ImageEngine !== "undefined" && ImageEngine.loremUrl
                ? ImageEngine.loremUrl(item.tag, 560, 340)
                : `https://loremflickr.com/560/340/${encodeURIComponent(item.tag)}`;
        return `
      <article class="shrink-0 w-[min(88vw,320px)] card-duy overflow-hidden border border-amber-300/35 bg-white/95 shadow-lg">
        <div class="relative h-40 overflow-hidden">
          <img src=${JSON.stringify(img)} alt="" class="w-full h-full object-cover" loading="lazy">
          <span class="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-800 to-rose-700 text-amber-100 px-2.5 py-1 rounded-full shadow">Duy Alerts</span>
        </div>
        <div class="p-4 text-left">
          <h3 class="font-black text-stone-900 text-sm leading-snug">${escHtml(item.title)}</h3>
          <p class="text-xs text-stone-600 mt-2 leading-relaxed">${escHtml(item.sub)}</p>
        </div>
      </article>`;
    }).join("");
}

function tryFillOriginFromGeolocation() {
    if (!navigator.geolocation) return;
    const input = document.getElementById("origin-query");
    if (!input) return;
    const current = String(input.value || "").trim();
    if (current && current !== "Sài Gòn") return;
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                const r = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
                );
                if (!r.ok) return;
                const j = await r.json();
                const label = [j.city, j.locality, j.principalSubdivision].filter(Boolean)[0];
                if (label) {
                    input.value = label;
                    DuyAppState.lastOrigin = label;
                    setAffiliateLinks(DuyAppState.lastTrip || {}, DuyAppState.lastQuery || "Việt Nam", label);
                }
            } catch {
                /* ignore */
            }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
}

async function geocodePlace(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=vi&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const r0 = j.results && j.results[0];
    if (!r0) return null;
    return { lat: r0.latitude, lon: r0.longitude, label: r0.name };
}

async function fetchWeather(lat, lon) {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const r = await fetch(u);
    if (!r.ok) return null;
    return r.json();
}

function weatherCodeLabel(code) {
    const c = Number(code);
    if (c === 0) return "Trời quang, Duy mách: mang nón!";
    if (c <= 3) return "Ít mây — ảnh ngoài trời đẹp lắm.";
    if (c <= 48) return "Sương mù nhẹ — lái xe cẩn thận nha.";
    if (c <= 67) return "Có mưa — nhớ ô và dép chống trơn.";
    if (c <= 77) return "Tuyết / mưa đá — check đường trước khi đi.";
    if (c <= 82) return "Mưa rào — tranh thủ cafe trong nhà.";
    return "Thời tiết “drama” — Duy ôm team đi chỗ an toàn thôi!";
}

function mergePackingHints(apiHints, tempC, wcode, place) {
    const base = Array.isArray(apiHints) ? [...apiHints] : [];
    const mustHave = ["Giấy tờ tùy thân (CCCD / hộ chiếu)", "Sạc dự phòng & cáp điện thoại"];
    const low = typeof tempC === "number" ? tempC : 28;
    if (low >= 32) base.unshift("Kem chống nắng SPF cao + nước uống đầy chai");
    if (low <= 22) base.unshift("Áo khoác mỏng / khăn choàng");
    if (String(place).toLowerCase().includes("biển") || String(place).toLowerCase().includes("phú quốc")) {
        base.push("Kính bơi, dép xỏ ngón, túi chống nước cho điện thoại");
    }
    if (wcode != null && Number(wcode) > 50) base.push("Ô gấp gọn trong balo");
    const merged = [...mustHave, ...base];
    return [...new Set(merged.map((x) => String(x).trim()))].slice(0, 12);
}

function budgetRows(days, tier) {
    const d = Math.max(1, parseInt(days, 10) || 1);
    const mult = tier === "eco" ? 0.65 : tier === "lux" ? 1.45 : 1;
    const perNightRoom = Math.round(850000 * mult);
    const perDayEat = Math.round(450000 * mult);
    const perDayMove = Math.round(200000 * mult);
    const tickets = Math.round(300000 * d * mult * 0.4);
    const nights = Math.max(1, d - 1);
    const roomTotal = perNightRoom * nights;
    const eat = perDayEat * d;
    const move = perDayMove * d;
    const km = typeof DuyAppState.lastFlightKm === "number" ? DuyAppState.lastFlightKm : null;
    const flightRt = estimateDomesticRoundTripVnd(km, tier);
    const total = roomTotal + eat + move + tickets + flightRt;
    const rows = [
        { k: "Phòng (ước lượng)", v: roomTotal, icon: "fa-bed" },
        { k: "Ăn uống", v: eat, icon: "fa-bowl-food" },
        { k: "Di chuyển nội địa", v: move, icon: "fa-bus" },
        { k: "Vé tham quan / show", v: tickets, icon: "fa-ticket" },
        {
            k: "Vé máy bay khứ hồi (ước lượng)",
            v: flightRt,
            icon: "fa-plane",
            hint:
                km != null && km < 30
                    ? "Hai điểm rất gần — Duy khuyên xe/xe khách thay vì bay."
                    : km != null
                      ? `Theo khoảng cách ~${Math.round(km)} km (nội địa).`
                      : "Chưa có tuyến — Duy đang dùng mức trung bình nội địa; bấm Tìm với Duy để cập nhật.",
        },
        { k: "Tổng dự kiến", v: total, icon: "fa-wallet", bold: true },
    ];
    return rows;
}

function formatVnd(n) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

function renderWeatherCard(place, weatherJson) {
    const el = document.getElementById("weather-card");
    if (!el) return;
    const cw = weatherJson && weatherJson.current_weather;
    if (!cw) {
        el.innerHTML = `<p class="font-bold text-stone-800">Duy chưa dò được thời tiết — vẫn cứ Vi Vu, nhớ coi app thời tiết trước khi đi nha!</p>`;
        return;
    }
    const t = cw.temperature;
    const code = cw.weathercode;
    const tip = weatherCodeLabel(code);
    const outfit = clothingAdviceText(t, code);
    el.innerHTML = `
        <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
                <p class="text-[10px] font-black uppercase text-red-800 tracking-widest">Dự báo · Duy nhắc bạn</p>
                <p class="text-lg font-black text-stone-900 mt-1">${escHtml(place)}</p>
                <p class="text-4xl font-black bg-gradient-to-r from-red-700 to-rose-500 bg-clip-text text-transparent mt-2">${t}°C</p>
            </div>
            <div class="text-right max-w-xs">
                <p class="text-sm font-semibold text-stone-700">${escHtml(tip)}</p>
            </div>
        </div>
        <p class="text-xs text-stone-600 mt-4 pt-4 border-t border-amber-100/80 leading-relaxed"><i class="fa-solid fa-shirt text-amber-600 mr-2"></i>${escHtml(outfit)}</p>`;
}

function renderPackingCard(hints) {
    const el = document.getElementById("packing-card");
    if (!el) return;
    const uid = Date.now().toString(36);
    const items = (hints || []).map(
        (h, i) => `<li class="flex gap-3 items-start">
            <input type="checkbox" class="mt-1 h-4 w-4 rounded border-rose-300 text-rose-500 focus:ring-rose-400" id="pack-${uid}-${i}">
            <label for="pack-${uid}-${i}" class="flex gap-2 cursor-pointer select-none">
                <i class="fa-solid fa-suitcase-rolling text-rose-400 mt-0.5 shrink-0"></i>
                <span>${escHtml(h)}</span>
            </label>
        </li>`
    ).join("");
    el.innerHTML = `
        <p class="text-[10px] font-black uppercase text-red-900/80 tracking-widest mb-2">Checklist thông minh · Duy nhắc bạn</p>
        <ul class="space-y-2 text-sm font-medium text-stone-800">${items || "<li>Duy nhắc bạn mang balo nhẹ — thêm gì tùy vibe chuyến đi!</li>"}</ul>`;
}

function renderBudgetCard(days, tier) {
    const el = document.getElementById("budget-card");
    if (!el) return;
    const rows = budgetRows(days, tier);
    const body = rows
        .map((r) => {
            const hintBlock = r.hint
                ? `<p class="text-[10px] text-slate-400 mt-0.5 pl-7 leading-snug">${escHtml(r.hint)}</p>`
                : "";
            return `
        <div class="py-2 border-b border-slate-100 last:border-0 ${r.bold ? "font-black text-rose-600 text-base pt-3" : "text-sm"}">
            <div class="flex justify-between items-center gap-2">
            <span class="flex items-center gap-2 text-slate-700">
                <i class="fa-solid ${r.icon} text-slate-400 w-5 text-center"></i> ${escHtml(r.k)}
            </span>
            <span>${formatVnd(r.v)}</span>
            </div>${hintBlock}
        </div>`;
        })
        .join("");
    const origin = escHtml(getOriginInput());
    el.innerHTML = `
        <p class="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">Ngân sách dự kiến (${escHtml(String(days))} ngày)</p>
        <p class="text-xs text-slate-500 mb-3">Khởi hành: <strong>${origin}</strong> · Duy tính sơ theo mức <strong>${tier === "eco" ? "tiết kiệm" : tier === "lux" ? "xả láng" : "tiêu chuẩn"}</strong> — chỉ mang tính tham khảo.</p>
        ${body}`;
}

function renderPhotoSpots(spots, place) {
    const el = document.getElementById("photo-spots-list");
    if (!el) return;
    const list = Array.isArray(spots) && spots.length ? spots : [
        { name: `View panorama gần ${place}`, tip: "Chụm khung 0.5x, để 1/3 trời + 2/3 mặt đất.", maps_query: place },
    ];
    el.innerHTML = list.map((s) => {
        const mq = s.maps_query || place;
        const href = mapsSearchUrl(mq);
        return `
        <div class="card-duy bg-white/80 border border-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex-1 min-w-0">
                <p class="font-black text-slate-900">${escHtml(s.name)}</p>
                <p class="text-sm text-slate-600 mt-1">${escHtml(s.tip)}</p>
            </div>
            <a href="${escHtml(href)}" target="_blank" rel="noopener" class="shrink-0 inline-flex items-center gap-2 text-rose-600 font-bold text-sm">
                <i class="fa-solid fa-location-dot"></i> Maps
            </a>
        </div>`;
    }).join("");
}

function fillDrawerSafety(tips) {
    const ul = document.getElementById("drawer-safety-list");
    if (!ul) return;
    const arr = Array.isArray(tips) && tips.length ? tips : [
        "Không khoe tiền mặt ở chỗ đông.",
        "Giữ bản photo CCCD trong điện thoại.",
    ];
    ul.innerHTML = arr.map((t) => `<li>${escHtml(t)}</li>`).join("");
}

function fillPhrases() {
    const ul = document.getElementById("phrase-list");
    if (!ul) return;
    ul.innerHTML = TRAVEL_PHRASES.map((p) => `
        <li class="border-b border-slate-100 pb-2 last:border-0">
            <span class="font-bold text-slate-900">${escHtml(p.vi)}</span>
            <span class="block text-xs text-slate-500 mt-0.5 italic">${escHtml(p.en)}</span>
        </li>`).join("");
}

function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToItinerary() {
    const sec = document.getElementById("section-itinerary");
    if (sec && !sec.classList.contains("hidden")) {
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        alert("Duy chưa có timeline — chọn số ngày rồi bấm “Duy dựng timeline Sáng–Tối” trước nha!");
    }
}

function setNavActive(btn) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.remove("text-rose-500", "nav-item-active");
        b.classList.add("text-slate-500");
    });
    btn.classList.add("text-rose-500", "nav-item-active");
    btn.classList.remove("text-slate-500");
}

function openDuyDrawer() {
    const d = document.getElementById("duy-drawer");
    const o = document.getElementById("duy-drawer-overlay");
    if (!d || !o) return;
    o.classList.remove("hidden");
    requestAnimationFrame(() => o.classList.remove("opacity-0"));
    d.classList.add("open");
}

function closeDuyDrawer() {
    const d = document.getElementById("duy-drawer");
    const o = document.getElementById("duy-drawer-overlay");
    if (d) d.classList.remove("open");
    if (o) {
        o.classList.add("opacity-0");
        setTimeout(() => o.classList.add("hidden"), 280);
    }
}

function updateBudgetFromSelects() {
    const days = document.getElementById("duration")?.value || "3";
    const tier = document.getElementById("budget")?.value || "mid";
    if (DuyAppState.lastTrip) {
        renderBudgetCard(days, tier);
    }
}

async function askAI() {
    const query = document.getElementById("query").value.trim();
    if (!query) return alert("Nhập điểm đến đi — Duy chờ bạn nè!");

    DuyAppState.lastWeather = null;

    const loading = document.getElementById("loading");
    const firstLook = document.getElementById("first-look-section");

    loading?.classList.remove("hidden");
    firstLook?.classList.add("hidden");

    try {
        const resp = await fetch(`${API_URL}/generate-trip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });

        const data = await parseJsonResponse(resp);
        if (!resp.ok) {
            const d = data.detail;
            const detailMsg = Array.isArray(d)
                ? d.map((x) => x.msg || JSON.stringify(x)).join("; ")
                : d;
            throw new Error(detailMsg || data.message || `Server ${resp.status}`);
        }

        DuyAppState.lastQuery = query;
        DuyAppState.lastTrip = data;

        const origin = getOriginInput();
        const tier = document.getElementById("budget")?.value || "mid";
        await refreshFlightEstimateForRoute(origin, data.place || query, tier);

        const imgUrl = tripCoverImageUrl(data, query);
        await renderLuxuryUI(data, imgUrl, query);

        geocodePlace(data.place || query)
            .then((geo) => {
                if (!geo) return null;
                return fetchWeather(geo.lat, geo.lon).then((w) => ({ w, label: geo.label }));
            })
            .then((pack) => {
                if (!pack || !pack.w) return;
                DuyAppState.lastWeather = pack.w;
                renderWeatherCard(pack.label || data.place, pack.w);
                const cw = pack.w.current_weather;
                const hints = mergePackingHints(
                    data.packing_hints,
                    cw && cw.temperature,
                    cw && cw.weathercode,
                    data.place || query
                );
                renderPackingCard(hints);
            })
            .catch(() => {
                renderWeatherCard(data.place || query, null);
            });
    } catch (e) {
        console.error(e);
        alert("Trục trặc tí — Duy vẫn dựng card cơ bản cho bạn!");
        const fallback = {
            place: query,
            desc: "Cùng Duy vi vu — điểm đến mới luôn có điều bất ngờ dễ thương!",
            cafe: "Một quán cafe tông ấm, ngồi bàn cạnh cửa sổ là auto chill.",
            img_tag: query,
            photo_spots: null,
            packing_hints: ["Balo nhỏ", "Sạc dự phòng", "Nón", "Nước suối"],
            safety_tips: ["Book xe qua app", "Giữ túi trước người"],
        };
        DuyAppState.lastTrip = fallback;
        const originFb = getOriginInput();
        const tierFb = document.getElementById("budget")?.value || "mid";
        await refreshFlightEstimateForRoute(originFb, query, tierFb);
        await renderLuxuryUI(fallback, tripCoverImageUrl(fallback, query), query);
        renderWeatherCard(query, null);
        renderPackingCard(fallback.packing_hints);
    } finally {
        loading?.classList.add("hidden");
    }
}

async function renderLuxuryUI(data, imgUrl, query) {
    const agodaLink = buildAgodaLink(data, query);

    const section = document.getElementById("first-look-section");
    const grid = document.getElementById("places-grid");
    const galleryRow = document.getElementById("gallery-row");
    const mapsBtn = document.getElementById("maps-link-btn");

    const ph = typeof ImageEngine !== "undefined" && ImageEngine.placeholderUrl
        ? ImageEngine.placeholderUrl(data.place || "")
        : tripCoverImageUrl(data, data.place || "");

    const seed = tripImageSeed(data, data.place || query);
    if (galleryRow && typeof ImageEngine !== "undefined" && ImageEngine.loremUrl) {
        const variants = ["", ",beach", ",food", ",city"].map((suffix) =>
            ImageEngine.loremUrl(String(seed) + suffix, 480, 320));
        galleryRow.innerHTML = variants
            .map(
                (url) => `
            <div class="shrink-0 w-56 sm:w-64 h-36 sm:h-40 rounded-2xl overflow-hidden border border-white shadow-md bg-slate-100">
                <img src=${JSON.stringify(url)} alt="" class="w-full h-full object-cover"
                     onerror="this.onerror=null;this.src=${JSON.stringify(ph)}">
            </div>`
            )
            .join("");
    }

    if (mapsBtn) mapsBtn.href = mapsSearchUrl(data.place || query);
    setAffiliateLinks(data, query, getOriginInput());

    const days = document.getElementById("duration")?.value || "3";
    const tier = document.getElementById("budget")?.value || "mid";

    const cw = DuyAppState.lastWeather && DuyAppState.lastWeather.current_weather;
    const hints = mergePackingHints(
        data.packing_hints,
        cw && cw.temperature,
        cw && cw.weathercode,
        data.place || query
    );
    renderPackingCard(hints);
    renderBudgetCard(days, tier);
    renderPhotoSpots(data.photo_spots, data.place || query);
    fillDrawerSafety(data.safety_tips);

    const wc = document.getElementById("weather-card");
    if (wc && !DuyAppState.lastWeather) {
        wc.innerHTML = `<p class="text-sm font-semibold text-stone-700"><i class="fa-solid fa-cloud-sun text-amber-600 mr-2 animate-pulse"></i>Duy nhắc bạn đợi tí — đang lấy thời tiết cho <strong>${escHtml(data.place || query)}</strong>…</p>`;
    }

    if (grid) {
        grid.innerHTML = `
            <div class="card-duy bg-white overflow-hidden border border-rose-100 flex flex-col">
                <div class="relative h-64 sm:h-80 overflow-hidden">
                   <img src=${JSON.stringify(imgUrl)} alt="" class="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                        onerror="this.onerror=null;this.src=${JSON.stringify(ph)}">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                   <span class="absolute bottom-4 left-4 text-white text-xs font-black uppercase tracking-widest bg-rose-500/90 px-3 py-1 rounded-full">Duy gợi ý nè</span>
                </div>
                <div class="p-6 sm:p-8 text-left space-y-4">
                    <h3 class="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">${escHtml(data.place)}</h3>
                    <p class="text-slate-600 leading-relaxed">“${escHtml(data.desc)}”</p>
                    <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 items-start">
                        <i class="fa-solid fa-mug-hot text-amber-500 text-xl mt-0.5"></i>
                        <div>
                            <p class="text-[10px] font-black uppercase text-amber-700 tracking-widest">Duy Thủ Thỉ</p>
                            <span class="font-bold text-slate-800">${escHtml(data.cafe)}</span>
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-500 text-center leading-snug">Ưu đãi dành riêng cho bạn khi đặt qua Duy Go</p>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <a href=${JSON.stringify(agodaLink)} target="_blank" rel="noopener sponsored"
                            class="flex-1 text-center font-black py-4 px-4 rounded-2xl text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-br from-[#288afa] to-[#0b67d7] border border-blue-400/30">
                            <i class="fa-solid fa-hotel mr-2"></i>Đặt khách sạn
                        </a>
                        <a href=${JSON.stringify(agodaLink)} target="_blank" rel="noopener sponsored"
                            class="flex-1 text-center font-black py-4 px-4 rounded-2xl text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-br from-rose-500 to-rose-700 border border-rose-400/40">
                            <i class="fa-solid fa-bed mr-2"></i>Tìm chỗ ở
                        </a>
                        <a href=${JSON.stringify(buildRoundTripFlightUrl(getOriginInput(), data.place || query))} target="_blank" rel="noopener sponsored"
                            class="flex-1 text-center font-black py-4 px-4 rounded-2xl text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-br from-sky-600 to-indigo-800 border border-amber-300/30">
                            <i class="fa-solid fa-plane mr-2 text-amber-200"></i>Săn vé khứ hồi
                        </a>
                    </div>
                </div>
            </div>`;
    }

    section?.classList.remove("hidden");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function generateFullTrip() {
    const query = document.getElementById("query").value.trim();
    const days = document.getElementById("duration").value;
    const loading = document.getElementById("loading");
    const itinerarySection = document.getElementById("section-itinerary");
    const itineraryDays = document.getElementById("itinerary-days");

    if (!query) {
        alert("Nhập điểm đến ở ô tìm kiếm trước — Duy mới dựng timeline được!");
        return;
    }

    loading?.classList.remove("hidden");

    try {
        const resp = await fetch(`${API_URL}/generate-full-itinerary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, days: parseInt(days, 10) }),
        });

        const data = await parseJsonResponse(resp);

        if (!resp.ok) {
            const d = data.detail;
            const detailMsg = Array.isArray(d)
                ? d.map((x) => x.msg || JSON.stringify(x)).join("; ")
                : d;
            throw new Error(detailMsg || data.message || `Server ${resp.status}`);
        }
        if (data.error) {
            alert(data.error);
            return;
        }
        if (!Array.isArray(data.itinerary)) {
            alert("Duy không nhận được lịch trình JSON hợp lệ.");
            return;
        }

        DuyAppState.lastItinerary = data.itinerary;

        if (data.itinerary.length && itineraryDays) {
            itineraryDays.innerHTML = data.itinerary.map((day) => {
                const slots = Array.isArray(day.slots) ? day.slots : [];
                const blocks = groupSlotsByPeriod(slots);
                const timeline = blocks
                    .filter((b) => b.slots.length)
                    .map((b) => {
                        const m = b.meta;
                        const rows = b.slots
                            .map(
                                (slot) => `
                            <div class="flex gap-3 pl-2 border-l-2 border-amber-200/90 py-3">
                                <div class="text-[10px] font-black text-red-700 shrink-0 w-14">${escHtml(slot.time || "")}</div>
                                <div class="min-w-0">
                                    <p class="font-bold text-stone-900">${escHtml(slot.activity)}</p>
                                    <p class="text-sm text-stone-600">${escHtml(slot.note)}</p>
                                    ${slotProLinesHtml(slot)}
                                    <p class="text-xs text-rose-700 font-semibold mt-2">💬 ${escHtml(slot.joke)}</p>
                                </div>
                            </div>`
                            )
                            .join("");
                        return `
                        <div class="relative">
                            <div class="flex items-center gap-3 mb-3">
                                <span class="w-10 h-10 rounded-2xl ${m.color} flex items-center justify-center shadow-md">
                                    <i class="fa-solid ${m.icon}"></i>
                                </span>
                                <span class="font-black text-lg text-slate-900">${m.label}</span>
                            </div>
                            <div class="space-y-1">${rows}</div>
                        </div>`;
                    })
                    .join("");

                const fallbackList = slots.length
                    ? slots
                          .map(
                              (slot) => `
                        <div class="flex gap-3 py-2 border-b border-stone-100">
                            <span class="text-xs font-black text-red-700">${escHtml(slot.time || "")}</span>
                            <div>
                                <p class="font-bold">${escHtml(slot.activity)}</p>
                                <p class="text-sm text-stone-600">${escHtml(slot.note)}</p>
                                ${slotProLinesHtml(slot)}
                            </div>
                        </div>`
                          )
                          .join("")
                    : "<p class='text-slate-500'>Chưa có slot — thử lại sau vài giây nha.</p>";

                return `
                <div class="card-duy bg-white border border-slate-100 p-6 sm:p-8 text-left space-y-6">
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Ngày ${escHtml(day.day)}</span>
                        <h4 class="text-xl sm:text-2xl font-black text-slate-900">“${escHtml(day.theme)}”</h4>
                    </div>
                    <div class="space-y-8">
                        ${timeline || `<div class="space-y-2">${fallbackList}</div>`}
                    </div>
                </div>`;
            }).join("");

            itinerarySection?.classList.remove("hidden");
            itinerarySection?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            alert("Lịch trình đang trống — Duy buồn quá, thử lại nhé!");
        }
    } catch (e) {
        console.error(e);
        alert("Duy dựng timeline chưa xong — kiểm tra mạng hoặc thử lại!");
    } finally {
        loading?.classList.add("hidden");
    }
}

function shareUrl() {
    return window.location.href.split("#")[0];
}

function shareText() {
    const t = DuyAppState.lastTrip;
    const q = DuyAppState.lastQuery;
    if (t && t.place) {
        return `Cùng Duy Vi Vu ${t.place}! ${t.desc || ""} — DUY GO ❤️`;
    }
    return `Cùng Duy Vi Vu cùng DUY GO! Đi đâu cũng được, miễn là đi cùng nhau! ❤️ ${q || ""}`;
}

function shareNative() {
    const payload = { title: "DUY GO", text: shareText(), url: shareUrl() };
    if (navigator.share) {
        navigator.share(payload).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${payload.text}\n${payload.url}`).then(
            () => alert("Duy đã copy link + lời nhắn vào clipboard rồi nha!"),
            () => alert(`${payload.text}\n${payload.url}`)
        );
    }
}

function shareToZalo() {
    const u = encodeURIComponent(shareUrl());
    window.open(`https://zalo.me/share?u=${u}`, "_blank", "noopener,noreferrer");
}

function shareToMessenger() {
    const u = encodeURIComponent(shareUrl());
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent || "");
    if (isMobile) {
        window.location.href = `fb-messenger://share?link=${u}`;
        setTimeout(() => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "_blank", "noopener,noreferrer");
        }, 600);
    } else {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "_blank", "noopener,noreferrer");
    }
}

function sharePostcard() {
    const t = DuyAppState.lastTrip;
    const place = (t && t.place) || DuyAppState.lastQuery || "DUY GO";
    const canvas = document.getElementById("postcard-canvas");
    if (!canvas || !canvas.getContext) return shareNative();
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0f172a");
    g.addColorStop(0.45, "#be123c");
    g.addColorStop(1, "#f97316");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(48, 48, w - 96, h - 96);
    ctx.fillStyle = "#fff7ed";
    ctx.font = "bold 52px 'Plus Jakarta Sans',sans-serif";
    ctx.fillText("DUY GO", 80, 140);
    ctx.font = "28px 'Plus Jakarta Sans',sans-serif";
    ctx.fillStyle = "#fecdd3";
    const sub = "Đi đâu cũng được, miễn là đi cùng nhau! ❤️";
    ctx.fillText(sub, 80, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px 'Plus Jakarta Sans',sans-serif";
    const lines = String(place).split(/(.{1,18})/).filter(Boolean);
    lines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line.trim(), 80, 320 + i * 72);
    });
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "26px 'Plus Jakarta Sans',sans-serif";
    ctx.fillText("Duy nhắc bạn · " + new Date().toLocaleDateString("vi-VN"), 80, h - 120);
    canvas.toBlob((blob) => {
        if (!blob) return shareNative();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `duy-go-postcard-${place.replace(/\s+/g, "-").slice(0, 24)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2500);
    });
}

let _originDebounce;
document.addEventListener("DOMContentLoaded", () => {
    fillPhrases();
    renderDuyAlerts();
    tryFillOriginFromGeolocation();
    setAffiliateLinks({}, "Việt Nam", getOriginInput());
    document.getElementById("duration")?.addEventListener("change", updateBudgetFromSelects);
    document.getElementById("budget")?.addEventListener("change", updateBudgetFromSelects);
    document.getElementById("origin-query")?.addEventListener("input", () => {
        clearTimeout(_originDebounce);
        _originDebounce = setTimeout(async () => {
            if (!DuyAppState.lastTrip) {
                setAffiliateLinks({}, "Việt Nam", getOriginInput());
                return;
            }
            const tier = document.getElementById("budget")?.value || "mid";
            const dest = DuyAppState.lastTrip.place || DuyAppState.lastQuery;
            await refreshFlightEstimateForRoute(getOriginInput(), dest, tier);
            updateBudgetFromSelects();
            setAffiliateLinks(DuyAppState.lastTrip, DuyAppState.lastQuery, getOriginInput());
        }, 450);
    });

    const fx = document.getElementById("fx-vnd");
    const out = document.getElementById("fx-usd");
    const rate = DuyAppState.fxRateVndPerUsd;
    function renderFx() {
        const v = parseFloat(String(fx?.value || "").replace(/,/g, ""));
        if (!out) return;
        if (!v || Number.isNaN(v)) {
            out.textContent = "≈ — USD";
            return;
        }
        const usd = v / rate;
        out.textContent = `≈ ${usd.toFixed(2)} USD`;
    }
    fx?.addEventListener("input", renderFx);
    renderFx();
});

window.askAI = askAI;
window.generateFullTrip = generateFullTrip;
window.scrollToId = scrollToId;
window.scrollToItinerary = scrollToItinerary;
window.setNavActive = setNavActive;
window.openDuyDrawer = openDuyDrawer;
window.closeDuyDrawer = closeDuyDrawer;
window.sharePostcard = sharePostcard;
window.shareToZalo = shareToZalo;
window.shareToMessenger = shareToMessenger;
window.shareNative = shareNative;
