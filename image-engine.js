// image-engine.js — ảnh theo địa danh (loremflickr) + fallback an toàn
const ImageEngine = {
    /** Chuẩn hóa tag cho path loremflickr (chữ thường, tối đa vài tag). */
    tagsFromQuery(query) {
        const raw = String(query || "vietnam")
            .toLowerCase()
            .replace(/[^a-z0-9\s,]/g, " ")
            .split(/[\s,]+/)
            .filter(Boolean)
            .slice(0, 4)
            .join(",");
        return raw || "vietnam,travel";
    },

    loremUrl(query, w = 1200, h = 800) {
        const tags = this.tagsFromQuery(query);
        return `https://loremflickr.com/${w}/${h}/${tags}`;
    },

    placeholderUrl(label) {
        const t = encodeURIComponent(String(label || "DUY GO").slice(0, 40));
        return `https://placehold.co/1200x800/0f172a/f8fafc?text=${t}`;
    },

    /** Khối ảnh hero/card: loremflickr theo query, lỗi thì placehold.co */
    getHtml(query, customClass = "") {
        const primaryImg = this.loremUrl(query, 1200, 800);
        const fallbackImg = this.placeholderUrl(query);

        return `
            <div class="relative w-full h-full bg-slate-200 overflow-hidden ${customClass}">
                <img src="${primaryImg}"
                     alt=""
                     class="w-full h-full object-cover transition-opacity duration-500 opacity-0"
                     onload="this.style.opacity='1'"
                     onerror="this.onerror=null;this.src='${fallbackImg}';this.style.opacity='1'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>`;
    }
};
