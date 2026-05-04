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
};

const PERIOD_META = {
    sang: { label: "Sáng", icon: "fa-sun", color: "bg-amber-400 text-amber-950" },
    trua: { label: "Trưa", icon: "fa-utensils", color: "bg-orange-400 text-white" },
    chieu: { label: "Chiều", icon: "fa-cloud-sun", color: "bg-sky-500 text-white" },
    toi: { label: "Tối", icon: "fa-moon", color: "bg-indigo-600 text-white" },
};

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

function setAffiliateLinks(place) {
    const p = encodeURIComponent(place || "Việt Nam");
    const ag = document.getElementById("aff-agoda");
    const bk = document.getElementById("aff-booking");
    const fl = document.getElementById("aff-flights");
    if (ag) ag.href = `https://www.agoda.com/vi-vn/search?cid=1914491&q=${p}`;
    if (bk) bk.href = `https://www.booking.com/searchresults.html?ss=${p}&aid=304142`;
    if (fl) fl.href = `https://www.skyscanner.com.vn/transport/flights/?q=${p}`;
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
    const low = typeof tempC === "number" ? tempC : 28;
    if (low >= 32) base.unshift("Kem chống nắng SPF cao + nước uống đầy chai");
    if (low <= 22) base.unshift("Áo khoác mỏng / khăn choàng");
    if (String(place).toLowerCase().includes("biển") || String(place).toLowerCase().includes("phú quốc")) {
        base.push("Kính bơi, dép xỏ ngón, túi chống nước cho điện thoại");
    }
    if (wcode != null && Number(wcode) > 50) base.push("Ô gấp gọn trong balo");
    return [...new Set(base)].slice(0, 10);
}

function budgetRows(days, tier) {
    const d = Math.max(1, parseInt(days, 10) || 1);
    const mult = tier === "eco" ? 0.65 : tier === "lux" ? 1.45 : 1;
    const perNightRoom = Math.round(850000 * mult);
    const perDayEat = Math.round(450000 * mult);
    const perDayMove = Math.round(200000 * mult);
    const tickets = Math.round(300000 * d * mult * 0.4);
    const room = perNightRoom * Math.max(1, d - (d > 1 ? 0 : 0));
    const nights = Math.max(1, d - 1);
    const roomTotal = perNightRoom * nights;
    const eat = perDayEat * d;
    const move = perDayMove * d;
    const total = roomTotal + eat + move + tickets;
    return [
        { k: "Phòng (ước lượng)", v: roomTotal, icon: "fa-bed" },
        { k: "Ăn uống", v: eat, icon: "fa-bowl-food" },
        { k: "Di chuyển nội địa", v: move, icon: "fa-bus" },
        { k: "Vé tham quan / show", v: tickets, icon: "fa-ticket" },
        { k: "Tổng dự kiến", v: total, icon: "fa-wallet", bold: true },
    ];
}

function formatVnd(n) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

function renderWeatherCard(place, weatherJson) {
    const el = document.getElementById("weather-card");
    if (!el) return;
    const cw = weatherJson && weatherJson.current_weather;
    if (!cw) {
        el.innerHTML = `<p class="font-bold text-slate-700">Duy chưa dò được thời tiết — vẫn cứ vi vu, nhớ coi app thời tiết trước khi đi nha!</p>`;
        return;
    }
    const t = cw.temperature;
    const code = cw.weathercode;
    const tip = weatherCodeLabel(code);
    el.innerHTML = `
        <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
                <p class="text-[10px] font-black uppercase text-rose-500 tracking-widest">Dự báo nhanh</p>
                <p class="text-lg font-black text-slate-900 mt-1">${escHtml(place)}</p>
                <p class="text-4xl font-black text-rose-500 mt-2">${t}°C</p>
            </div>
            <div class="text-right max-w-xs">
                <p class="text-sm font-semibold text-slate-600">${escHtml(tip)}</p>
            </div>
        </div>`;
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
        <p class="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-2">Hành lý · Checklist</p>
        <ul class="space-y-2 text-sm font-medium text-slate-700">${items || "<li>Duy sẽ nhắc bạn mang balo nhẹ thôi — thêm gì tùy vibe chuyến đi!</li>"}</ul>`;
}

function renderBudgetCard(days, tier) {
    const el = document.getElementById("budget-card");
    if (!el) return;
    const rows = budgetRows(days, tier);
    const body = rows.map((r) => `
        <div class="flex justify-between items-center gap-2 py-2 border-b border-slate-100 last:border-0 ${r.bold ? "font-black text-rose-600 text-base pt-3" : "text-sm"}">
            <span class="flex items-center gap-2 text-slate-700 ${r.bold ? "" : ""}">
                <i class="fa-solid ${r.icon} text-slate-400 w-5 text-center"></i> ${escHtml(r.k)}
            </span>
            <span>${formatVnd(r.v)}</span>
        </div>`).join("");
    el.innerHTML = `
        <p class="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">Ngân sách dự kiến (${escHtml(String(days))} ngày)</p>
        <p class="text-xs text-slate-500 mb-3">Duy tính sơ theo mức <strong>${tier === "eco" ? "tiết kiệm" : tier === "lux" ? "xả láng" : "tiêu chuẩn"}</strong> — chỉ mang tính tham khảo.</p>
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
        await renderLuxuryUI(fallback, tripCoverImageUrl(fallback, query), query);
        renderWeatherCard(query, null);
        renderPackingCard(fallback.packing_hints);
    } finally {
        loading?.classList.add("hidden");
    }
}

async function renderLuxuryUI(data, imgUrl, query) {
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
    setAffiliateLinks(data.place || query);

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
        wc.innerHTML = `<p class="text-sm font-semibold text-slate-600"><i class="fa-solid fa-cloud-sun text-rose-500 mr-2 animate-pulse"></i>Duy đang hỏi thời tiết cho <strong>${escHtml(data.place || query)}</strong>…</p>`;
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
                            <p class="text-[10px] font-black uppercase text-amber-600 tracking-widest">Duy thủ thỉ</p>
                            <span class="font-bold text-slate-800">${escHtml(data.cafe)}</span>
                        </div>
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
                            <div class="flex gap-3 pl-2 border-l-2 border-rose-200 py-2">
                                <div class="text-[10px] font-black text-rose-500 shrink-0 w-14">${escHtml(slot.time || "")}</div>
                                <div class="min-w-0">
                                    <p class="font-bold text-slate-900">${escHtml(slot.activity)}</p>
                                    <p class="text-sm text-slate-600">${escHtml(slot.note)}</p>
                                    <p class="text-xs text-rose-600 font-semibold mt-1">💬 ${escHtml(slot.joke)}</p>
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
                        <div class="flex gap-3 py-2 border-b border-slate-100">
                            <span class="text-xs font-black text-rose-500">${escHtml(slot.time || "")}</span>
                            <div>
                                <p class="font-bold">${escHtml(slot.activity)}</p>
                                <p class="text-sm text-slate-600">${escHtml(slot.note)}</p>
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
        return `Cùng Duy vi vu ${t.place}! ${t.desc || ""} — DUY GO ❤️`;
    }
    return `Cùng Duy vi vu với DUY GO! Đi đâu cũng được, miễn là đi cùng nhau! ❤️ ${q || ""}`;
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
    ctx.fillText("Duy gợi ý nè · " + new Date().toLocaleDateString("vi-VN"), 80, h - 120);
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

document.addEventListener("DOMContentLoaded", () => {
    fillPhrases();
    setAffiliateLinks("Việt Nam");
    document.getElementById("duration")?.addEventListener("change", updateBudgetFromSelects);
    document.getElementById("budget")?.addEventListener("change", updateBudgetFromSelects);

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
