/** Base API FastAPI trên Render — ghi đè bằng window.TRAVEL_API_BASE trong index.html nếu cần */
const API_URL = (typeof window !== "undefined" && window.TRAVEL_API_BASE
    ? String(window.TRAVEL_API_BASE).replace(/\/$/, "")
    : "https://dulichthuvi.onrender.com");

function tripImageSeed(data, fallbackQuery) {
    const seed = (data && (data.img_tag || data.place)) || fallbackQuery;
    return seed;
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

async function parseJsonResponse(resp) {
    const text = await resp.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON không hợp lệ từ server:", text.slice(0, 200));
        throw new Error("Phản hồi không phải JSON hợp lệ");
    }
}

function escHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Hàm gọi AI chính
async function askAI() {
    const query = document.getElementById('query').value.trim();
    if (!query) return alert("Sếp nhập nơi đến nhé!");

    const loading = document.getElementById('loading');
    const firstLook = document.getElementById('first-look-section');

    loading.classList.remove('hidden');
    firstLook?.classList.add('hidden');

    try {
        const resp = await fetch(`${API_URL}/generate-trip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await parseJsonResponse(resp);
        if (!resp.ok) {
            const d = data.detail;
            const detailMsg = Array.isArray(d)
                ? d.map((x) => x.msg || JSON.stringify(x)).join("; ")
                : d;
            throw new Error(detailMsg || data.message || `Server ${resp.status}`);
        }

        const imgUrl = tripCoverImageUrl(data, query);
        renderLuxuryUI(data, imgUrl);

    } catch (e) {
        console.error("Lỗi:", e);
        alert("Có chút trục trặc, nhưng em vẫn lấy thông tin cơ bản cho sếp nhé!");
        // Dữ liệu dự phòng
        const fallback = {
            place: query,
            desc: "Khám phá hành trình mới cùng TravelVN!",
            cafe: "Quán cafe view triệu đô",
            img_tag: query
        };
        renderLuxuryUI(fallback, tripCoverImageUrl(fallback, query));
    } finally {
        loading.classList.add('hidden');
    }
}

function renderLuxuryUI(data, imgUrl) {
    const section = document.getElementById('first-look-section');
    const grid = document.getElementById('places-grid');
    const galleryRow = document.getElementById("gallery-row");
    const ph = typeof ImageEngine !== "undefined" && ImageEngine.placeholderUrl
        ? ImageEngine.placeholderUrl(data.place || "")
        : tripCoverImageUrl(data, data.place || "");

    const seed = tripImageSeed(data, data.place || "");
    if (galleryRow && typeof ImageEngine !== "undefined" && ImageEngine.loremUrl) {
        const variants = ["", ",beach", ",food", ",city"].map((suffix) =>
            ImageEngine.loremUrl(String(seed) + suffix, 480, 320));
        galleryRow.innerHTML = variants
            .map(
                (url) => `
            <div class="shrink-0 w-64 h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
                <img src=${JSON.stringify(url)} alt="" class="w-full h-full object-cover"
                     onerror="this.onerror=null;this.src=${JSON.stringify(ph)}">
            </div>`
            )
            .join("");
    }

    if (grid) {
        grid.innerHTML = `
            <div class="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-full animate-fadeIn">
                <div class="relative h-80 overflow-hidden">
                   <img src=${JSON.stringify(imgUrl)} alt="" class="w-full h-full object-cover transition-transform duration-1000 hover:scale-110"
                        onerror="this.onerror=null;this.src=${JSON.stringify(ph)}">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>
                <div class="p-10 text-left">
                    <h3 class="text-4xl font-black text-slate-800 mb-4 uppercase italic">${escHtml(data.place)}</h3>
                    <p class="text-slate-500 text-lg leading-relaxed italic">"${escHtml(data.desc)}"</p>
                    <div class="mt-8 bg-blue-50 p-6 rounded-[2rem] flex items-center gap-4 border border-blue-100">
                        <i class="fa-solid fa-mug-hot text-blue-500 text-2xl"></i>
                        <div>
                            <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Gợi ý địa phương:</p>
                            <span class="font-bold text-slate-700 text-lg">${escHtml(data.cafe)}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    section?.classList.remove('hidden');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function generateFullTrip() {
    const query = document.getElementById('query').value.trim();
    const days = document.getElementById('duration').value;
    const loading = document.getElementById('loading');
    const itinerarySection = document.getElementById('full-itinerary-section');
    const itineraryDays = document.getElementById('itinerary-days');

    loading.classList.remove('hidden');

    try {
        const resp = await fetch(`${API_URL}/generate-full-itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, days: parseInt(days) })
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
            alert("Server không trả về lịch trình hợp lệ.");
            return;
        }

        if (data.itinerary.length) {
            itineraryDays.innerHTML = data.itinerary.map(day => {
                const slots = Array.isArray(day.slots) ? day.slots : [];
                return `
                <div class="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-50 mb-10 text-left">
                    <span class="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-black italic uppercase">NGÀY ${escHtml(day.day)}</span>
                    <h4 class="text-3xl font-black text-slate-800 mt-6 mb-8 uppercase italic">"${escHtml(day.theme)}"</h4>
                    <div class="space-y-6">
                        ${slots.map(slot => `
                            <div class="flex gap-6">
                                <div class="bg-red-500 text-white text-[10px] h-fit font-black px-3 py-1 rounded-lg italic">${escHtml(slot.time)}</div>
                                <div class="flex-1">
                                    <h5 class="text-xl font-bold text-slate-800">${escHtml(slot.activity)}</h5>
                                    <p class="text-slate-500 italic mb-2">${escHtml(slot.note)}</p>
                                    <p class="text-blue-600 text-sm font-medium">💡 ${escHtml(slot.joke)}</p>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
            }).join("");
            
            itinerarySection.classList.remove('hidden');
            itinerarySection.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert("Chưa có hoạt động nào trong lịch trình. Sếp thử lại nhé!");
        }
    } catch (e) {
        alert("Lên lịch trình thất bại, sếp thử lại nhé!");
    } finally {
        loading.classList.add('hidden');
    }
}
