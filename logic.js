const API_URL = "https://travel-ai-api-qu6z.onrender.com";

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
        
        if (!resp.ok) throw new Error("Server Error");
        const data = await resp.json();

        // Sử dụng từ khóa AI trả về để lấy ảnh đẹp từ Unsplash
        const imgUrl = `https://unsplash.com{encodeURIComponent(data.img_tag || query)}`;
        renderLuxuryUI(data, imgUrl);

    } catch (e) {
        console.error("Lỗi:", e);
        alert("Có chút trục trặc, nhưng em vẫn lấy thông tin cơ bản cho sếp nhé!");
        // Dữ liệu dự phòng
        renderLuxuryUI({
            place: query,
            desc: "Khám phá hành trình mới cùng TravelVN!",
            cafe: "Quán cafe view triệu đô"
        }, `https://unsplash.com`);
    } finally {
        loading.classList.add('hidden');
    }
}

function renderLuxuryUI(data, imgUrl) {
    const section = document.getElementById('first-look-section');
    const grid = document.getElementById('places-grid');

    if (grid) {
        grid.innerHTML = `
            <div class="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-full animate-fadeIn">
                <div class="relative h-80 overflow-hidden">
                   <img src="${imgUrl}" class="w-full h-full object-cover transition-transform duration-1000 hover:scale-110">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>
                <div class="p-10 text-left">
                    <h3 class="text-4xl font-black text-slate-800 mb-4 uppercase italic">${data.place}</h3>
                    <p class="text-slate-500 text-lg leading-relaxed italic">"${data.desc}"</p>
                    <div class="mt-8 bg-blue-50 p-6 rounded-[2rem] flex items-center gap-4 border border-blue-100">
                        <i class="fa-solid fa-mug-hot text-blue-500 text-2xl"></i>
                        <div>
                            <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Gợi ý địa phương:</p>
                            <span class="font-bold text-slate-700 text-lg">${data.cafe}</span>
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
        
        const data = await resp.json();

        if (data.itinerary) {
            itineraryDays.innerHTML = data.itinerary.map(day => `
                <div class="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-50 mb-10 text-left">
                    <span class="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-black italic uppercase">NGÀY ${day.day}</span>
                    <h4 class="text-3xl font-black text-slate-800 mt-6 mb-8 uppercase italic">"${day.theme}"</h4>
                    <div class="space-y-6">
                        ${day.slots.map(slot => `
                            <div class="flex gap-6">
                                <div class="bg-red-500 text-white text-[10px] h-fit font-black px-3 py-1 rounded-lg italic">${slot.time}</div>
                                <div class="flex-1">
                                    <h5 class="text-xl font-bold text-slate-800">${slot.activity}</h5>
                                    <p class="text-slate-500 italic mb-2">${slot.note}</p>
                                    <p class="text-blue-600 text-sm font-medium">💡 ${slot.joke}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            
            itinerarySection.classList.remove('hidden');
            itinerarySection.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        alert("Lên lịch trình thất bại, sếp thử lại nhé!");
    } finally {
        loading.classList.add('hidden');
    }
}
