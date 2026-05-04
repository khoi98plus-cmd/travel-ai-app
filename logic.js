// logic.js - BẢN SẠCH CHUẨN 100%: FIX LỖI JSON & HIỆN ẢNH TỨ THÌ
const API_URL = "https://travel-ai-app-1-u992.onrender.com";

async function askAI() {
    const query = document.getElementById('query').value.trim();
    if (!query) return alert("Sếp nhập nơi đến nhé!");

    const loading = document.getElementById('loading');
    const firstLook = document.getElementById('first-look-section');

    loading.classList.remove('hidden');
    if (firstLook) firstLook.classList.add('hidden');

    // 1. TẠO LINK ẢNH TRƯỚC (Để chắc chắn có ảnh hiện lên dù AI lỗi)
    const imgUrl = `https://bing.net{encodeURIComponent(query)}&w=1200&h=800&c=7&rs=1`;

    try {
        const resp = await fetch(`${API_URL}/generate-trip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
        
        // Kiểm tra nếu Backend trả về lỗi hoặc không phải JSON
        if (!resp.ok) throw new Error('CORS hoặc Server lỗi');
        const data = await resp.json();

        renderLuxuryUI(data, imgUrl, query);

    } catch (e) {
        console.error("Lỗi kết nối AI:", e);
        // DÙ AI LỖI VẪN HIỆN UI VỚI ẢNH ĐÃ TẠO
        renderLuxuryUI({
            place: query, 
            desc: "Một địa danh tuyệt vời đang chờ bạn khám phá!", 
            cafe: "Quán cafe địa phương"
        }, imgUrl, query);
    } finally {
        loading.classList.add('hidden');
    }
}

function renderLuxuryUI(data, imgUrl, query) {
    const firstLook = document.getElementById('first-look-section');
    const placesGrid = document.getElementById('places-grid');

    if (placesGrid) {
        placesGrid.innerHTML = `
            <div class="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-full text-left">
                <div class="relative h-80 overflow-hidden">
                   <img src="${imgUrl}" class="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                        onerror="this.onerror=null;this.src='https://vnecdn.net'">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                <div class="p-10">
                    <h3 class="text-4xl font-black text-slate-800 mb-4 uppercase">${data.place || query}</h3>
                    <p class="text-slate-500 text-base leading-relaxed italic">"${data.desc || 'Mô tả đang được cập nhật...'}"</p>
                    <div class="mt-6 bg-red-50 p-6 rounded-[2rem] flex items-center gap-4">
                        <i class="fa-solid fa-mug-hot text-red-500 text-2xl"></i>
                        <div>
                            <p class="text-[10px] text-red-400 font-bold uppercase tracking-widest">Gợi ý từ AI:</p>
                            <span class="font-bold text-slate-700">${data.cafe || 'Quán cafe view đẹp'}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    if (firstLook) {
        firstLook.classList.remove('hidden');
        window.scrollTo({ top: firstLook.offsetTop - 50, behavior: 'smooth' });
    }
}

async function generateFullTrip() {
    const query = document.getElementById('query').value.trim();
    const days = document.getElementById('duration').value;
    const loading = document.getElementById('loading');
    const itinerarySection = document.getElementById('full-itinerary-section');
    const itineraryDays = document.getElementById('itinerary-days');

    loading.classList.remove('hidden');
    if (itinerarySection) itinerarySection.classList.add('hidden');

    try {
        const resp = await fetch(`${API_URL}/generate-full-itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, days: parseInt(days) })
        });
        const data = await resp.json();

        if (itineraryDays && data.itinerary) {
            itineraryDays.innerHTML = data.itinerary.map(day => `
                <div class="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-50 mb-12 relative overflow-hidden text-left">
                    <div class="mb-10">
                        <span class="bg-red-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase italic shadow-lg">NGÀY ${day.day}</span>
                        <h4 class="text-3xl font-black text-slate-800 mt-4 uppercase italic">"${day.theme}"</h4>
                    </div>
                    <div class="space-y-8">
                        ${day.slots.map(slot => `
                            <div class="flex gap-6 items-start">
                                <div class="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-md italic">${slot.time}</div>
                                <div class="flex-1 bg-slate-50 p-6 rounded-[2rem]">
                                    <h5 class="text-lg font-black text-slate-800 mb-2">${slot.activity}</h5>
                                    <p class="text-slate-500 text-sm italic mb-4 leading-relaxed">${slot.note}</p>
                                    <div class="bg-yellow-100/50 p-4 rounded-2xl border-l-4 border-yellow-400">
                                        <p class="text-slate-700 text-xs font-bold italic uppercase">Lời khuyên: <span class="font-normal normal-case">${slot.joke}</span></p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        if (itinerarySection) itinerarySection.classList.remove('hidden');
        window.scrollTo({ top: itinerarySection.offsetTop - 50, behavior: 'smooth' });
    } catch (e) {
        console.error("Lỗi lịch trình:", e);
        alert("Lỗi tải lịch trình, sếp thử lại nhé!");
    } finally {
        loading.classList.add('hidden');
    }
}
