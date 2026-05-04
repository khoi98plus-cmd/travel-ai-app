// image-engine.js - HỆ THỐNG PHỤC HỒI HÌNH ẢNH TỰ ĐỘNG
const ImageEngine = {
    // Danh sách các kho ảnh dự phòng (Càng nhiều càng an toàn)
    sources: [
        (q) => `https://weserv.nl{q},travel/all&w=1000&t=cover`,
        (q) => `https://weserv.nl{q},travel&w=1000`,
        (q) => `https://placehold.jp{q.toUpperCase()}`
    ],

    // Hàm lấy ảnh thông minh: Nếu link 1 chết, tự động dùng link 2
    getHtml: function(query, customClass = "") {
        const primaryImg = this.sources[0](encodeURIComponent(query));
        const secondaryImg = this.sources[1](encodeURIComponent(query));
        const fallbackImg = this.sources[2](encodeURIComponent(query));

        return `
            <div class="relative w-full h-full bg-slate-200 overflow-hidden ${customClass}">
                <img src="${primaryImg}" 
                     class="w-full h-full object-cover transition-opacity duration-500 opacity-0"
                     onload="this.style.opacity='1'"
                     onerror="this.src='${secondaryImg}'; this.onerror=()=>this.src='${fallbackImg}'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>`;
    }
};
