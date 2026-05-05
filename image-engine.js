// image-engine.js — ảnh theo địa danh (loremflickr) + fallback an toàn
const ImageEngine = {
    /** Chuẩn hóa tag cho path loremflickr (chữ thường, tối đa vài tag). */
    tagsFromQuery(query) {
        const raw = String(query || "landscape")
            .toLowerCase()
            .replace(/[^a-z0-9\s,]/g, " ")
            .split(/[\s,]+/)
            .filter(Boolean)
            .slice(0, 2)
            .join(",");
        // Chỉ lấy ảnh phong cảnh/thiên nhiên để đảm bảo vibe nhẹ nhàng & load nhanh
        return (raw ? raw + "," : "") + "landscape,nature";
    },

    loremUrl(query, w = 800, h = 500) {
        const tags = this.tagsFromQuery(query);
        // Tối ưu: giảm kích thước ảnh xuống 800x500 cho nhẹ
        return `https://loremflickr.com/${w}/${h}/${tags}/all`;
    },

    placeholderUrl(label) {
        const t = encodeURIComponent(String(label || "DUY GO").slice(0, 40));
        return `https://placehold.co/800x500/faf8f5/5d4037?text=${t}`;
    },

    /** Khối ảnh hero/card: loremflickr theo query, lỗi thì placehold.co */
    getHtml(query, customClass = "") {
        const primaryImg = this.loremUrl(query, 800, 500);
        const fallbackImg = this.placeholderUrl(query);

        return `
            <div class="relative w-full h-full bg-slate-200 overflow-hidden watermark-container ${customClass}">
                <img src="${primaryImg}"
                     alt=""
                     class="w-full h-full object-cover transition-opacity duration-500 opacity-0"
                     onload="this.style.opacity='1'"
                     onerror="this.onerror=null;this.src='${fallbackImg}';this.style.opacity='1'">
                <div class="watermark-overlay">DUY GO</div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>`;
    }
};
