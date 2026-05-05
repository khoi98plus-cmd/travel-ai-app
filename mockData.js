/** mockData.js — Hệ thống cộng đồng ảo DUY GO (50 người dùng & logic tự động) */
const DuyMockData = {
    users: [],
    captions: [
        "Đà Lạt hôm nay buồn quá, có ai đi cafe với mình không? ✨",
        "Phú Quốc nắng vàng biển xanh, thiếu mỗi bạn đi cùng thôi... 🌊",
        "Vibe Hà Giang mùa này đỉnh thực sự, Duy Go dẫn đường xịn quá! ⛰️",
        "Tìm đồng đội cùng leo Fansipan cuối tuần này, ai đi không? 🧗",
        "Chỉ muốn ở lại Hội An mãi thôi, bình yên quá đỗi. ❤️",
        "Healing tại Sa Pa, mây luồn qua cửa sổ luôn nè! ☁️",
        "Check-in Ninh Bình, đẹp như tranh vẽ vậy đó. 🛶",
        "Lần đầu đi Huế, mê mẩn nét cổ kính ở đây. 🏯",
        "Bình minh trên biển Nha Trang, tuyệt phẩm! 🌅",
        "Ăn sập Sài Gòn cùng Duy Go, no nê luôn. 🍜",
        "Tà Xùa săn mây thành công mỹ mãn! ☁️✨",
        "Đảo Lý Sơn nước trong vắt, lặn ngắm san hô thôi! 🤿",
        "Mùa lúa chín Mù Cang Chải đẹp rụng rời... 🌾",
        "Chill một chút tại Vũng Tàu cuối tuần. 🏖️",
        "Cần tìm người đi Đà Nẵng cùng, ưu tiên biết chụp ảnh! 📸"
    ],
    comments: [
        "Chỗ này ở đâu vậy chủ thớt? Đẹp quá!",
        "Mê vibe này quá! Duy Go dẫn đường xịn thật!",
        "Đẹp quá tri kỷ ơi, cho mình xin địa chỉ với!",
        "Nhìn là muốn xách balo lên và đi ngay!",
        "Ảnh chất quá, dùng máy gì chụp vậy bạn?",
        "Hôm trước mình cũng mới đi, công nhận tuyệt!",
        "Duy Go Approved có khác, uy tín luôn! ✅",
        "Có ai đi cùng không, lập team thôi!",
        "Vibe này đúng kiểu mình thích luôn.",
        "Ước gì đang được ở đó ngay lúc này...",
        "Chủ thớt review tâm huyết quá, cảm ơn nha!",
        "App xịn, gợi ý toàn chỗ đẹp!",
        "Hài hước quá bạn ơi, đi thôi chờ chi!",
        "Xịn xò con bò luôn! 🐮✨",
        "Lên kèo đi tri kỷ ơi!"
    ],

    init() {
        // Tạo 50 người dùng ảo
        for (let i = 1; i <= 50; i++) {
            this.users.push({
                id: `virtual_user_${i}`,
                name: this.generateRandomName(),
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=DuyUser${i}&backgroundColor=b6e3f4`,
                rank: this.getRandomElement(["Tri kỷ hạng Bạc", "Tri kỷ hạng Vàng", "Thánh Vi Vu", "Kẻ lữ hành", "Duy's Bestie"])
            });
        }
    },

    generateRandomName() {
        const first = ["Linh", "Minh", "Hoàng", "An", "Trang", "Tuấn", "Hương", "Nam", "Khánh", "Vy", "Sơn", "Hà", "Phong", "Thảo", "Dũng"];
        const mid = ["Thị", "Văn", "Thanh", "Minh", "Kim", "Ngọc", "Hoàng", "Đức"];
        const last = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi"];
        return `${this.getRandomElement(last)} ${this.getRandomElement(mid)} ${this.getRandomElement(first)}`;
    },

    getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    generateRandomPost() {
        const user = this.getRandomElement(this.users);
        const location = this.getRandomElement(["Đà Lạt", "Phú Quốc", "Hà Giang", "Sa Pa", "Hội An", "Ninh Bình", "Huế", "Nha Trang", "Sài Gòn", "Tà Xùa", "Lý Sơn", "Mù Cang Chải"]);
        const caption = this.getRandomElement(this.captions);
        const likes = Math.floor(Math.random() * 451) + 50; // 50 - 500 tim
        const commentCount = Math.floor(Math.random() * 10) + 2;
        const postComments = [];
        
        for (let i = 0; i < commentCount; i++) {
            postComments.push({
                user: this.getRandomElement(this.users),
                text: this.getRandomElement(this.comments)
            });
        }

        // Fix ảnh Bảng tin: Sử dụng Source Unsplash theo đúng tên địa danh + thêm random để ảnh không bị trùng
        const randomId = Math.floor(Math.random() * 1000);
        const imageUrl = `https://source.unsplash.com/featured/800x500?${encodeURIComponent(location + ',nature,landscape')}&sig=${randomId}`;

        return {
            id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user: user,
            location: location,
            caption: caption,
            image: imageUrl,
            likes: likes,
            comments: postComments,
            timestamp: new Date().getTime(),
            isVirtual: true
        };
    },

    generateRandomComment(targetUser) {
        let text = this.getRandomElement(this.comments);
        if (targetUser) {
            text = text.replace("chủ thớt", targetUser.name || "tri kỷ");
        }
        return {
            user: this.getRandomElement(this.users),
            text: text
        };
    }
};

// Khởi tạo dữ liệu
DuyMockData.init();
