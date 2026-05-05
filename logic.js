/** DUY GO — logic chính (mobile-first) */
const API_URL = (typeof window !== "undefined" &&
    (window.DUY_GO_API_BASE || window.TRAVEL_API_BASE)
    ? String(window.DUY_GO_API_BASE || window.TRAVEL_API_BASE).replace(/\/$/, "")
    : "http://localhost:8000/api");

const DuyAppState = {
    currentLang: "vn",
    translations: null,
    lastQuery: "",
    lastTrip: null,
    lastItinerary: null,
    lastWeather: null,
    fxRateVndPerUsd: 25450,
    /** Khoảng cách bay ước lượng (km) giữa điểm khởi hành và điểm đến */
    lastFlightKm: null,
    lastOrigin: "Sài Gòn",
    mood: "chill",
    budget: "standard",
    user: null, // Thông tin user đăng nhập
    userRank: "Người mới",
    checkins: [],
    followers: 1200,
    audioEnabled: true,
    firstInteraction: false,
};

// Search & image runtime caches (tăng tốc + giảm lag khi cuộn)
const DuyRuntimeCache = {
    search: new Map(), // key -> trip data
    images: new Map(), // key -> [url...]
};

/** Multilingual Support */
async function initMultilingual() {
    try {
        const resp = await fetch('languages.json');
        DuyAppState.translations = await resp.json();
        applyTranslations();
    } catch (e) {
        console.error("Lỗi tải ngôn ngữ:", e);
    }
}

function setLanguage(lang) {
    DuyAppState.currentLang = lang;
    document.querySelectorAll(".lang-btn").forEach(btn => btn.classList.remove("active"));
    const langBtn = document.getElementById(`lang-${lang}`);
    if (langBtn) langBtn.classList.add("active");
    applyTranslations();
    updateDuyGreetingUI();
}

function t(key) {
    if (!DuyAppState.translations || !DuyAppState.translations[DuyAppState.currentLang]) return key;
    return DuyAppState.translations[DuyAppState.currentLang][key] || key;
}

function applyTranslations() {
    const queryInput = document.getElementById("query");
    if (queryInput) queryInput.placeholder = t("search_placeholder");

    const askBtn = document.querySelector("button[onclick*='askAI'] span");
    if (askBtn) askBtn.innerText = t("btn_ask_ai");

    const navButtons = document.querySelectorAll(".nav-btn");
    const navKeys = ["tab_explore", "tab_feed", "tab_itinerary", "tab_profile"];
    navButtons.forEach((btn, i) => {
        if (navKeys[i]) {
            const textNode = Array.from(btn.childNodes).find(node => node.nodeType === 3 && node.textContent.trim() !== "");
            if (textNode) textNode.textContent = t(navKeys[i]);
        }
    });
}

/** Auth & Session Management */
function checkAuth() {
    try {
        const savedUser = localStorage.getItem("duy_go_user");
        if (savedUser) {
            DuyAppState.user = JSON.parse(savedUser);
            const overlay = document.getElementById("auth-overlay");
            if (overlay) overlay.classList.add("hidden");
            document.getElementById("app-body").classList.remove("overflow-hidden");
            updateProfileUI();
        }
    } catch (e) {
        console.error("Lỗi parse User:", e);
        localStorage.removeItem("duy_go_user");
    }
}

function handleSocialLogin(provider) {
    // Giả lập Firebase Auth với từng provider
    const mockData = {
        'Google': { name: "Tri Kỷ Google", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Google&backgroundColor=b6e3f4" },
        'Facebook': { name: "Tri Kỷ Facebook", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Facebook&backgroundColor=b6e3f4" },
        'Apple': { name: "Tri Kỷ Apple", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Apple&backgroundColor=b6e3f4" }
    };
    
    const selected = mockData[provider];
    const mockUser = {
        name: selected.name,
        email: `${provider.toLowerCase()}@duygo.com`,
        avatar: selected.avatar,
        rank: "Người mới",
        tripsCount: 0,
        duyXu: 500,
        provider: provider
    };
    
    DuyAppState.user = mockUser;
    localStorage.setItem("duy_go_user", JSON.stringify(mockUser));
    
    safeConfetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    setTimeout(() => {
        document.getElementById("auth-overlay").classList.add("hidden");
        document.getElementById("app-body").classList.remove("overflow-hidden");
        updateProfileUI();
    }, 500);
}

/** Geolocation & Verification */
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject("GPS không hỗ trợ");
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

async function verifyLocationAndCheckIn() {
    if (!DuyAppState.lastTrip) return alert("Tìm điểm đến trước nha tri kỷ!");

    try {
        const pos = await getCurrentLocation();
        const { latitude, longitude } = pos.coords;
        console.log(`GPS: ${latitude}, ${longitude}`);
        openCamera();
    } catch (err) {
        alert("Bật GPS để Duy xác nhận bạn đang ở đúng nơi nhé! 📍");
    }
}

/** Camera & Story System */
let stream;
function openCamera() {
    const overlay = document.getElementById("camera-overlay");
    const video = document.getElementById("camera-video");
    const placeTag = document.getElementById("live-tag-place");
    const timeTag = document.getElementById("live-tag-time");

    overlay.classList.remove("hidden");
    placeTag.innerText = DuyAppState.lastTrip?.place || "Địa điểm bí mật";
    timeTag.innerText = new Date().toLocaleString('vi-VN');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(s => {
            stream = s;
            video.srcObject = s;
        })
        .catch(err => {
            alert("Không mở được camera rồi tri kỷ ơi! Duy buồn quá.");
            closeCamera();
        });
}

function closeCamera() {
    const overlay = document.getElementById("camera-overlay");
    overlay.classList.add("hidden");
    if (stream) stream.getTracks().forEach(track => track.stop());
}

function takeSnapshot() {
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Giả lập lưu vào Firebase Storage
    console.log("Đang upload ảnh lên Firebase Storage với quyền riêng tư cao nhất... 🔐");
    
    handleCheckIn(); // Thực hiện các logic tăng điểm, đóng dấu sticker
    closeCamera();
    
    alert("STORY ĐÃ LÊN SÓNG! Duy đã bảo mật ảnh của bạn trên Firebase Storage 100%. 🛡️");
}

function switchCamera() {
    // Logic chuyển camera trước/sau (facingMode: environment)
    alert("Duy đang xoay camera cho bạn...");
}

function handleLogout() {
    localStorage.removeItem("duy_go_user");
    location.reload();
}

function getPersonalizedName() {
    if (DuyAppState.user && DuyAppState.user.name) {
        return DuyAppState.user.name.split(' ').pop(); // Lấy tên cuối cho thân mật
    }
    return "Tri kỷ";
}

function updateProfileUI() {
    if (!DuyAppState.user) return;
    const nameEl = document.getElementById("user-name");
    const avatarEl = document.getElementById("user-avatar");
    if (nameEl) nameEl.innerText = DuyAppState.user.name;
    if (avatarEl) avatarEl.src = DuyAppState.user.avatar;
    
    // Member Level Logic
    let rank = "Người mới";
    if (DuyAppState.user.tripsCount > 5) rank = "Đại sứ Vi Vu 👑";
    else if (DuyAppState.user.tripsCount > 2) rank = "Kẻ lữ hành Pro 🎒";
    else if (DuyAppState.user.tripsCount > 0) rank = "Kẻ lữ hành 👣";
    
    DuyAppState.user.rank = rank;
    
    const rankEl = document.getElementById("user-rank");
    const tripsEl = document.getElementById("stat-trips");
    const xuEl = document.getElementById("stat-duyxu");
    const followersEl = document.getElementById("stat-followers");

    if (rankEl) rankEl.innerText = rank;
    if (tripsEl) tripsEl.innerText = DuyAppState.user.tripsCount;
    if (xuEl) xuEl.innerText = (DuyAppState.user.duyXu || 0).toLocaleString();
    if (followersEl) followersEl.innerText = (DuyAppState.followers || 1200).toLocaleString();
}

function playWelcomeMessage() {
    const name = getPersonalizedName();
    const greetings = [
        `Chào ${name}! Duy đã sẵn sàng cùng bạn khám phá những chân trời mới rồi nè.`,
        `Rất vui được gặp lại ${name}. Hôm nay mình đi đâu cho thật chill nhỉ?`,
        `Chào tri kỷ ${name}. Duy đã cập nhật những điểm đến hot nhất cho bạn rồi đó!`
    ];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    playAIRadio(text);
}

/** Tab Navigation */
function showTab(tabId, btn) {
    // Ẩn tất cả tab
    document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.add("hidden");
        p.classList.remove("active");
    });
    // Hiện tab được chọn
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }

    // Update bottom nav UI
    document.querySelectorAll(".nav-btn").forEach(b => {
        b.classList.remove("text-rose-500", "nav-item-active");
        b.classList.add("text-slate-500");
    });
    if (btn) {
        btn.classList.add("text-rose-500", "nav-item-active");
        btn.classList.remove("text-slate-500");
    }

    // Nếu vào tab feed, render feed mẫu
    if (tabId === 'feed') renderSocialFeed();
}

/** Social Feed & Stories */
const DuyFeed = {
    posts: [],
    
    init() {
        // Khởi tạo 10 bài đăng đầu tiên
        for (let i = 0; i < 10; i++) {
            this.posts.unshift(DuyMockData.generateRandomPost());
        }
        
        // Cập nhật bài đăng mới mỗi 5-10 phút (giả lập 30s cho dễ demo)
        setInterval(() => {
            const newPost = DuyMockData.generateRandomPost();
            this.posts.unshift(newPost);
            if (this.posts.length > 100) this.posts.pop();
            
            // Nếu đang ở tab feed, render lại
            const activeTab = document.querySelector(".tab-pane.active");
            if (activeTab && activeTab.id === 'tab-feed') {
                renderSocialFeed();
            }
        }, 30000); // 30s cho demo sống động
    },

    addRealUserPost(content, image) {
        const post = {
            id: `real_post_${Date.now()}`,
            user: {
                name: DuyAppState.user?.name || "Tri kỷ bí ẩn",
                avatar: DuyAppState.user?.avatar || "",
                rank: DuyAppState.user?.rank || "Người mới"
            },
            location: DuyAppState.lastTrip?.place || "Địa điểm bí mật",
            caption: content,
            image: image,
            likes: 0,
            comments: [],
            timestamp: Date.now(),
            isVirtual: false
        };
        
        this.posts.unshift(post);
        renderSocialFeed();

        // Tự động được 'người dùng ảo' tương tác sau 3-10 giây
        setTimeout(() => {
            this.autoInteract(post.id);
        }, Math.random() * 7000 + 3000);
    },

    autoInteract(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        // Tăng tim
        post.likes += Math.floor(Math.random() * 50) + 20;

        // Thêm 2-5 bình luận ảo
        const count = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < count; i++) {
            post.comments.push(DuyMockData.generateRandomComment(post.user));
        }

        renderSocialFeed();
        console.log("Duy Go Community đã tương tác với bài viết của bạn! ✅");
    }
};

function renderSocialFeed() {
    const list = document.getElementById("social-feed-list");
    if (!list) return;

    if (DuyFeed.posts.length === 0) {
        DuyFeed.init();
    }

    const feedFallback = (typeof ImageEngine !== "undefined" && ImageEngine.placeholderUrl)
        ? ImageEngine.placeholderUrl("DUY GO")
        : "https://placehold.co/800x500/faf8f5/5d4037?text=DUY%20GO";

    list.innerHTML = DuyFeed.posts.map(s => `
        <div class="card-duy bg-white overflow-hidden border border-stone-100 shadow-xl animate-up mb-6">
            <div class="p-4 flex items-center gap-3">
                <img src="${s.user.avatar}" class="w-10 h-10 rounded-full border-2 border-rose-100">
                <div>
                    <p class="font-black text-stone-900 text-sm">${s.user.name}</p>
                    <p class="text-[10px] text-stone-400 uppercase font-bold tracking-widest">${new Date(s.timestamp).toLocaleTimeString()}</p>
                </div>
                ${s.isVirtual ? `<button onclick="toggleFollow(this)" class="ml-auto bg-rose-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black transition-all active:scale-95">Follow</button>` : ''}
            </div>
            <div class="relative aspect-[4/5] overflow-hidden watermark-container">
                <img src="${s.image}" class="w-full h-full object-cover" loading="lazy" decoding="async"
                     onerror="this.onerror=null;this.src=${JSON.stringify(feedFallback)}">
                <div class="watermark-overlay">DUY GO</div>
                ${s.isVirtual ? `<div class="approved-stamp">DUY GO APPROVED</div>` : ''}
            </div>
            <div class="p-4">
                <p class="text-sm text-stone-700 leading-relaxed font-medium mb-4">${s.caption}</p>
                <div class="flex items-center gap-4 mb-4">
                    <button class="flex items-center gap-1.5 text-stone-400 text-xs font-bold transition-colors hover:text-rose-500" onclick="this.classList.toggle('text-rose-500')">
                        <i class="fa-solid fa-heart"></i> ${s.likes}
                    </button>
                    <button class="flex items-center gap-1.5 text-stone-400 text-xs font-bold"><i class="fa-regular fa-comment"></i> ${s.comments.length}</button>
                    <button class="ml-auto text-stone-400"><i class="fa-regular fa-paper-plane"></i></button>
                </div>
                
                <!-- Comments Section -->
                <div class="space-y-3 pt-4 border-t border-stone-50">
                    ${s.comments.slice(0, 3).map(c => `
                        <div class="flex gap-2">
                            <img src="${c.user.avatar}" class="w-6 h-6 rounded-full">
                            <div class="bg-stone-50 rounded-2xl px-3 py-1.5 flex-1">
                                <p class="text-[10px] font-black text-stone-900">${c.user.name}</p>
                                <p class="text-[11px] text-stone-600">${c.text}</p>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `).join("");
}

/** Follow System */
function toggleFollow(btn) {
    if (btn.innerText.includes("Follow")) {
        btn.innerText = "Following";
        btn.classList.add("bg-stone-200", "text-stone-600");
        btn.classList.remove("bg-rose-500", "text-white");
        DuyAppState.followers++;
    } else {
        btn.innerText = "Follow";
        btn.classList.remove("bg-stone-200", "text-stone-600");
        btn.classList.add("bg-rose-500", "text-white");
        DuyAppState.followers--;
    }
    const statFollowers = document.getElementById("stat-followers");
    if (statFollowers) statFollowers.innerText = DuyAppState.followers.toLocaleString();
}

/** AI Radio & Voice Agent System */
let systemVoices = [];
window.speechSynthesis.onvoiceschanged = () => {
    systemVoices = window.speechSynthesis.getVoices();
    console.log("Duy đã cập nhật danh sách giọng nói mới:", systemVoices.length);
};

function playAIRadio(customText = null, callback = null) {
    if (!DuyAppState.audioEnabled) return;

    const bgm = document.getElementById("lofi-bgm");
    const text =
        customText != null
            ? String(customText)
            : String((DuyAppState.lastTrip && DuyAppState.lastTrip.radio_script) || "Chào tri kỷ!");
    
    if (!('speechSynthesis' in window)) return;

    const msg = new SpeechSynthesisUtterance();
    msg.text = normalizeTtsText(text);
    // Ép buộc Tiếng Việt
    msg.lang = "vi-VN";
    
    // Tông giọng ấm áp
    msg.pitch = 0.8; 
    msg.rate = 0.85;

    if (systemVoices.length === 0) systemVoices = window.speechSynthesis.getVoices();
    
    const voices = systemVoices.length > 0 ? systemVoices : window.speechSynthesis.getVoices();
    
    // Chọn giọng VI nam trầm nếu có (Windows thường có Microsoft Nam)
    const viVoices = voices.filter((v) => String(v.lang || "").toLowerCase().includes("vi"));
    const scoreVoice = (v) => {
        const name = String(v.name || "");
        const lower = name.toLowerCase();
        let score = 0;
        if (lower.includes("nam")) score += 40;
        if (lower.includes("male")) score += 30;
        if (lower.includes("google")) score += 10;
        if (lower.includes("microsoft")) score += 5;
        if (lower.includes("an") || lower.includes("lê") || lower.includes("le")) score -= 5;
        return score;
    };
    let selectedVoice = viVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
    if (!selectedVoice) selectedVoice = voices.find((v) => String(v.lang || "").toLowerCase().includes("vi"));
    
    if (selectedVoice) {
        msg.voice = selectedVoice;
        // Hạ pitch nếu không chắc là giọng nam
        const vname = String(selectedVoice.name || "").toLowerCase();
        if (!vname.includes("nam") && !vname.includes("male")) {
            msg.pitch = 0.62;
        }
        console.log("Duy đã chọn giọng:", selectedVoice.name, "Pitch:", msg.pitch);
    } else {
        msg.pitch = 0.62;
    }

    msg.onstart = () => {
        if (bgm) {
            bgm.volume = 0.05;
            bgm.play().catch(e => console.warn("BGM play blocked:", e));
        }
        handleProactiveActions(text);
    };

    msg.onend = () => {
        if (bgm) {
            let vol = 0.05;
            const interval = setInterval(() => {
                vol += 0.01;
                bgm.volume = Math.min(vol, 0.15);
                if (vol >= 0.15) clearInterval(interval);
            }, 50);
        }
        if (callback) callback();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
}

function handleProactiveActions(text) {
    const t = text.toLowerCase();
    const navBtns = document.querySelectorAll(".nav-btn");
    
    if (t.includes("lịch trình") || t.includes("itinerary")) {
        showTab('itinerary', navBtns[2]);
    } else if (t.includes("của duy") || t.includes("profile")) {
        showTab('profile', navBtns[3]);
    } else if (t.includes("bói bài") || t.includes("tarot")) {
        drawTarot();
    } else if (t.includes("tiếng anh") || t.includes("english")) {
        setLanguage('en');
    }
}

/** Idle Reminder */
let idleTimer;
function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (DuyAppState.firstInteraction && DuyAppState.audioEnabled) {
            const name = getPersonalizedName();
            const reminder = DuyAppState.currentLang === 'vn' 
                ? `Ủa ${name} đi đâu rồi? Mình tiếp tục lên kế hoạch đi trốn nhé!`
                : `Where did you go, ${name}? Let's keep planning our escape!`;
            
            playAIRadio(reminder);
            if (navigator.vibrate) navigator.vibrate(200); // Haptic feedback
        }
    }, 60000); // 1 phút đứng im
}

window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('touchstart', resetIdleTimer);
window.addEventListener('keypress', resetIdleTimer);

/** Voice Interaction - Proactive */
let recognition;
function toggleVoice() {
    if (!('webkitSpeechRecognition' in window)) return alert("Dùng Chrome nha tri kỷ!");
    
    if (recognition && recognition.active) { recognition.stop(); return; }

    recognition = new webkitSpeechRecognition();
    recognition.lang = DuyAppState.currentLang === 'vn' ? 'vi-VN' : 'en-US';
    
    const btn = document.getElementById("voice-btn");
    recognition.onstart = () => btn.classList.add("bg-orange-500", "animate-pulse");
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById("query").value = text;
        
        // AI thấu hiểu lệnh
        if (text.toLowerCase().includes("mở bói bài") || text.toLowerCase().includes("tarot")) {
            playAIRadio("Duy mở quẻ bài cho bạn ngay đây!", () => drawTarot());
        } else if (text.toLowerCase().includes("tiếng anh") || text.toLowerCase().includes("english")) {
            setLanguage('en');
            playAIRadio("Done! Switching to English for you.");
        } else if (text.toLowerCase().includes("nhạc")) {
            toggleAudio();
        } else {
            askAI();
        }
    };

    recognition.onend = () => btn.classList.remove("bg-orange-500", "animate-pulse");
    recognition.start();
}

function toggleAudio() {
    const bgm = document.getElementById("lofi-bgm");
    const btn = document.getElementById("audio-toggle");
    DuyAppState.audioEnabled = !DuyAppState.audioEnabled;
    
    if (DuyAppState.audioEnabled) {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove("muted");
        if (bgm) bgm.play().catch(() => {});
    } else {
        btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btn.classList.add("muted");
        if (bgm) bgm.pause();
        window.speechSynthesis.cancel();
    }
}

// Back-compat: index.html đang gọi toggleBGM()
function toggleBGM() {
    return toggleAudio();
}

/** Lời chào - Nhân cách Duy (đa ngôn ngữ) */
function getDuyGreeting() {
    const hour = new Date().getHours();
    const key = hour >= 5 && hour < 11 ? "greeting_morning" : hour >= 11 && hour < 18 ? "greeting_afternoon" : "greeting_evening";
    const msg = t(key);
    if (msg !== key) return msg;
    if (hour >= 5 && hour < 11) return "Chào buổi sáng bình yên! Hôm nay mình đi đâu cho thật chill nhỉ?";
    if (hour >= 11 && hour < 18) return "Chiều nhẹ rơi rồi — Duy tìm cho bạn một góc thật bình yên nhé!";
    return "Tối rồi — mình đi trốn một chút cho nhẹ lòng nha?";
}

/** Abstract Data Flow Background */
function initDataFlowBg() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let lines = [];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    class Line {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.length = Math.random() * 100 + 50;
            this.speed = Math.random() * 2 + 1;
            this.color = Math.random() > 0.5 ? '#FF5F1F' : '#00F5FF';
        }
        draw() {
            ctx.beginPath();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 0.5;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.length, this.y - this.length / 2);
            ctx.stroke();
            this.x += this.speed;
            this.y -= this.speed / 2;
            if (this.x > width || this.y < 0) this.reset();
        }
    }

    for (let i = 0; i < 20; i++) lines.push(new Line());

    function animate() {
        ctx.clearRect(0, 0, width, height);
        lines.forEach(l => l.draw());
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize(); animate();
}

/** Card Tilt Effect */
function initTiltEffect() {
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.card-duy');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            } else {
                card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            }
        });
    });
}

/** Story Check-in V2 */
function handleCheckIn() {
    if (!DuyAppState.lastTrip) return alert("Tìm điểm đến trước khi check-in nha tri kỷ!");
    
    const canvas = document.getElementById("camera-canvas");
    const image = canvas ? canvas.toDataURL("image/jpeg") : "https://loremflickr.com/800/500/travel,landscape";
    
    // Tích hợp vào Bảng tin thực tế
    const content = `Check-in tại ${DuyAppState.lastTrip?.place || "một nơi tuyệt vời"}! Cảm ơn Duy Go đã đồng hành. 👣✨ #DuyGoApproved`;
    DuyFeed.addRealUserPost(content, image);

    safeConfetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.7 },
        colors: ['#FF5F1F', '#00F5FF', '#BC13FE']
    });

    DuyAppState.user.duyXu += 500;
    DuyAppState.user.tripsCount++;
    updateProfileUI();
    localStorage.setItem("duy_go_user", JSON.stringify(DuyAppState.user));

    alert("CHECK-IN THÀNH CÔNG! Duy đã đưa bài viết của bạn lên Bảng tin. Chờ xem các tri kỷ khác vào thả tim nhé! 🔥");
}

function updateDuyGreetingUI() {
    const mainGreeting = document.getElementById("duy-main-greeting");
    const miniGreeting = document.getElementById("duy-greeting-mini");
    const greeting = getDuyGreeting();
    if (mainGreeting) mainGreeting.innerText = greeting;
    if (miniGreeting) miniGreeting.innerText = "Duy đang thức...";
}

function setMood(mood) {
    DuyAppState.mood = mood;
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.classList.remove("bg-white/30", "ring-1", "ring-white/50");
        if (btn.innerText.toLowerCase().includes(mood)) {
            btn.classList.add("bg-white/30", "ring-1", "ring-white/50");
        }
    });
    console.log("Mood set to:", mood);
}

// Khởi tạo khi load trang
window.addEventListener("DOMContentLoaded", async () => {
    await initMultilingual();
    checkAuth();
    updateDuyGreetingUI();
    setMood("chill");
    // initDataFlowBg(); // Tắt nền Cyber
    initTiltEffect();

    // Lofi BGM initialization
    const bgm = document.getElementById("lofi-bgm");
    if (bgm) bgm.volume = 0.2;

    // First interaction trigger for greeting
    const handleFirstInteraction = () => {
        if (!DuyAppState.firstInteraction) {
            DuyAppState.firstInteraction = true;
            playAIRadio();
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
        }
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    
    // Initialize Lottie Loading
    lottie.loadAnimation({
        container: document.getElementById('lottie-loading'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'https://assets5.lottiefiles.com/packages/lf20_tivun8cc.json' // Travel Bus animation
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("DUY GO PWA Ready!"))
            .catch(err => console.log("PWA Error:", err));
    }
    
    const budgetSelect = document.getElementById("budget-select");
    if (budgetSelect) {
        budgetSelect.addEventListener("change", (e) => {
            const v = String(e.target.value || "standard");
            // UI: economy|standard|luxury -> internal: eco|standard|lux (dùng ở budgetRows/estimateDomesticRoundTripVnd)
            DuyAppState.budget = v === "economy" ? "eco" : v === "luxury" ? "lux" : "standard";
        });
    }
});

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

function normalizeTtsText(text) {
    const s = String(text ?? "");
    try {
        return s.normalize("NFC");
    } catch {
        return s;
    }
}

function stableHash32(input) {
    let h = 0x811c9dc5;
    const s = String(input ?? "");
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function buildDynamicImageUrls(place, imageTags, count = 5) {
    const key = normalizePlaceName(place || "") || "vietnam";
    const cached = DuyRuntimeCache.images.get(key);
    if (cached && cached.length) return cached.slice(0, count);

    const baseQuery = (Array.isArray(imageTags) && imageTags.length ? imageTags.join(",") : place) || "vietnam travel";
    const seedBase = stableHash32(`${key}|${baseQuery}`);
    const n = Math.max(3, Math.min(parseInt(count, 10) || 5, 8));
    const urls = Array.from({ length: n }).map((_, i) => {
        if (typeof ImageEngine !== "undefined" && ImageEngine.loremUrl) {
            const q = `${baseQuery},${i + 1}`;
            return ImageEngine.loremUrl(q, 1200, 800);
        }
        const sig = (seedBase + i * 97) % 10000;
        return `https://source.unsplash.com/featured/1200x800?${encodeURIComponent(baseQuery + ",landscape,nature")}&sig=${sig}`;
    });
    DuyRuntimeCache.images.set(key, urls);
    return urls.slice(0, count);
}

async function preloadImages(urls) {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!list.length) return;
    list.forEach((u) => {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = u;
    });
    if (typeof caches === "undefined") return;
    try {
        const cache = await caches.open("duy-images-v1");
        await Promise.all(list.map((u) => cache.add(u).catch(() => {})));
    } catch {
        /* ignore */
    }
}

function safeConfetti(options) {
    try {
        if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        if (typeof confetti === "function") confetti(options);
    } catch {
        /* ignore */
    }
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
        <div class="relative h-40 overflow-hidden watermark-container">
          <img src=${JSON.stringify(img)} alt="" class="w-full h-full object-cover" loading="lazy">
          <div class="watermark-overlay">DUY GO</div>
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
    const body = document.body;
    if (!el) return;
    const cw = weatherJson && weatherJson.current_weather;
    if (!cw) {
        el.innerHTML = `<p class="text-sm font-semibold text-stone-500">Chưa lấy được thời tiết cho ${escHtml(place)}.</p>`;
        return;
    }
    const temp = Math.round(cw.temperature);
    const code = cw.weathercode;
    const label = weatherCodeLabel(code);
    
    // Weather-Adaptive UI: Đổi màu theo thời tiết
    if (code > 50) { // Trời mưa/xấu
        body.style.background = "linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)";
        el.classList.add("bg-blue-50/80", "border-blue-200");
    } else if (temp > 30) { // Trời nắng gắt
        body.style.background = "linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)";
        el.classList.add("bg-amber-50/80", "border-amber-200");
    } else { // Bình thường
        body.style.background = "linear-gradient(180deg, var(--duy-porcelain) 0%, #f5f0e8 55%, #efe8dc 100%)";
    }

    el.innerHTML = `
    <div class="flex items-center justify-between">
        <div>
            <p class="text-[10px] font-black uppercase text-amber-700 tracking-widest">Thời tiết tại ${escHtml(place)}</p>
            <p class="text-2xl font-black text-slate-900">${temp}°C</p>
            <p class="text-xs font-bold text-slate-600 mt-1">${label}</p>
        </div>
        <div class="text-4xl text-amber-500">
            <i class="fa-solid ${code > 50 ? 'fa-cloud-showers-heavy' : (temp > 30 ? 'fa-sun' : 'fa-cloud-sun')}"></i>
        </div>
    </div>
    <div class="mt-4 pt-4 border-t border-slate-100">
        <p class="text-[11px] leading-relaxed text-stone-600">
            <i class="fa-solid fa-quote-left text-amber-400 mr-1"></i>
            ${clothingAdviceText(temp, code)}
        </p>
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

// (Đã có toggleVoice & playAIRadio phiên bản chuẩn phía trên)
function playTripRadio() {
    playAIRadio(null);
}

async function askAI() {
    const query = document.getElementById("query").value.trim();
    if (!query) return alert("Nhập điểm đến đi — Duy chờ bạn nè!");

    const cacheKey = normalizePlaceName(query);
    const cached = cacheKey ? DuyRuntimeCache.search.get(cacheKey) : null;
    if (cached) {
        DuyAppState.lastTrip = cached;
        DuyAppState.lastQuery = String(cached.place || query).trim() || query;
        if (!Array.isArray(cached.images) || cached.images.length === 0) {
            cached.images = buildDynamicImageUrls(cached.place || query, cached.image_tags || cached.imageTags, 5);
        }
        await preloadImages(cached.images);
        await renderLuxuryUI(cached, cached.images[0], query);
        return;
    }

    DuyAppState.lastWeather = null;

    const loading = document.getElementById("loading");
    const firstLook = document.getElementById("first-look-section");
    const radioUI = document.getElementById("ai-radio-ui");

    loading?.classList.remove("hidden");
    firstLook?.classList.add("hidden");
    if (radioUI) radioUI.classList.add("hidden");

    // Abort request cũ để giảm lag khi user gõ nhanh / bấm liên tục
    if (window.__duyAbortGenerate) {
        try { window.__duyAbortGenerate.abort(); } catch {}
    }
    window.__duyAbortGenerate = new AbortController();

    try {
        let data;
        try {
            const resp = await fetch(`${API_URL}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: window.__duyAbortGenerate.signal,
                body: JSON.stringify({
                    destination: query,
                    origin: getOriginInput(),
                    mood: DuyAppState.mood,
                    budget: DuyAppState.budget,
                    days: parseInt(document.getElementById("duration")?.value || "1", 10)
                }),
            });
            data = await parseJsonResponse(resp);
            if (!resp.ok) throw new Error(data.detail || "Server Error");
        } catch (fetchError) {
            if (fetchError && (fetchError.name === "AbortError" || String(fetchError.message || "").includes("aborted"))) {
                return;
            }
            console.warn("Chế độ Demo (Offline Mode) kích hoạt do lỗi kết nối backend.");
            
            const demoData = {
                "đà lạt": {
                    place: "Đà Lạt",
                    trip_name: "Đà Lạt — Thành phố Ngàn Hoa & Sương Mù",
                    desc: "Hành trình chữa lành tại thành phố mộng mơ, nơi mây luồn qua ô cửa sổ và ngàn hoa khoe sắc.",
                    radio_script: `Chào ${getPersonalizedName()}! Duy đã chuẩn bị một lịch trình cực chill tại Đà Lạt cho bạn đây. Mình sẽ cùng săn mây tại Cầu Đất, nhâm nhi cafe ngắm thung lũng và tận hưởng không khí se lạnh tuyệt vời này nhé. Đi thôi tri kỷ ơi!`,
                    inspiration: {
                        why_visit: "Đà Lạt không chỉ là một điểm đến, mà là một cảm giác. Vibe thơ mộng, không khí trong lành sẽ giúp bạn tái tạo năng lượng cực tốt.",
                        photo_spots_pro: "Dốc Nhà Bò, Tiệm bánh Cối Xay Gió, Ga Đà Lạt, và những đồi thông ẩn mình trong sương.",
                        must_eat_pro: "Bánh tráng nướng, Lẩu gà lá é, Kem bơ Thanh Thảo, và Cafe vợt đêm."
                    },
                    packing_hints: ["Áo len nhẹ", "Khăn quàng cổ", "Máy ảnh", "Tâm hồn mộng mơ"],
                    image_tags: ["dalat landscape", "dalat flower", "dalat pine forest", "dalat mist", "dalat cafe"]
                },
                "hà tiên": {
                    place: "Hà Tiên",
                    trip_name: "Hà Tiên — Thập Vịnh Cảnh Hữu Tình",
                    desc: "Khám phá vùng đất biên thùy xinh đẹp với những bãi biển hoang sơ, hang động kỳ ảo và ẩm thực độc đáo.",
                    radio_script: `Chào ${getPersonalizedName()}! Duy đã lên lịch cho tri kỷ khám phá Mũi Nai, Thạch Động và thưởng thức bún kèn đặc sản Hà Tiên cực ngon rồi nhé. Đi thôi!`,
                    inspiration: {
                        why_visit: "Hà Tiên mang vẻ đẹp bình dị, cổ kính với nhiều danh lam thắng cảnh đi vào thơ ca.",
                        photo_spots_pro: "Bãi tắm Mũi Nai, Thạch Động Thôn Vân, Núi Đá Dựng, Đầm Đông Hồ.",
                        must_eat_pro: "Bún kèn Hà Tiên, Xôi xiêm, Hủ tiếu hấp, Cà xỉu muối."
                    },
                    packing_hints: ["Đồ bơi", "Kem chống nắng", "Giày đi bộ", "Kính râm"],
                    image_tags: ["hatien beach", "hatien sunset", "hatien cave", "hatien temple", "hatien street"]
                },
                "phú quốc": {
                    place: "Phú Quốc",
                    trip_name: "Phú Quốc — Đảo Ngọc Thiên Đường",
                    desc: "Trải nghiệm kỳ nghỉ chanh sả tại hòn đảo lớn nhất Việt Nam với những bãi cát trắng mịn và hoàng hôn rực rỡ.",
                    radio_script: `Chào ${getPersonalizedName()}! Phú Quốc đang vẫy gọi kìa. Duy đã lên kèo lặn ngắm san hô và thưởng thức bún quậy cực phẩm cho bạn rồi nhé. Cháy thôi!`,
                    inspiration: {
                        why_visit: "Thiên đường nghỉ dưỡng hàng đầu với những dịch vụ cao cấp và cảnh sắc thiên nhiên tuyệt mỹ.",
                        photo_spots_pro: "Bãi Sao, Sunset Sanato, Grand World, Hòn Thơm.",
                        must_eat_pro: "Bún quậy Kiến Xây, Gỏi cá trích, Nhum biển nướng, Rượu sim."
                    },
                    packing_hints: ["Váy maxi/Short", "Dép đi biển", "Túi chống nước", "Nón rộng vành"],
                    image_tags: ["phuquoc beach", "phuquoc sunset", "phuquoc resort", "phuquoc island", "phuquoc sea"]
                },
                "hội an": {
                    place: "Hội An",
                    trip_name: "Hội An — Phố Cổ Lung Linh Đèn Lồng",
                    desc: "Ngược dòng thời gian về với thương cảng sầm uất một thời, nơi mỗi góc phố đều mang hơi thở của lịch sử.",
                    radio_script: `Chào ${getPersonalizedName()}! Hội An về đêm đẹp lắm, mình sẽ cùng thả đèn hoa đăng và ăn bánh mì Phượng nổi tiếng nhé. Một cảm giác thật bình yên!`,
                    inspiration: {
                        why_visit: "Vẻ đẹp vượt thời gian, sự kết hợp hoàn hảo giữa các nền văn hóa Việt - Hoa - Nhật.",
                        photo_spots_pro: "Chùa Cầu, Bờ sông Hoài, Phố đèn lồng, Các hội quán cổ.",
                        must_eat_pro: "Cao lầu, Cơm gà Hội An, Bánh mì Phượng, Nước Mót."
                    },
                    packing_hints: ["Áo dài/Đồ vintage", "Quạt tay", "Giày vải", "Máy ảnh phim"],
                    image_tags: ["hoian ancient", "hoian lantern", "hoian river", "hoian street", "hoian night"]
                },
                "hà nội": {
                    place: "Hà Nội",
                    trip_name: "Hà Nội — Ngàn Năm Văn Hiến",
                    desc: "Tận hưởng nét thanh lịch của thủ đô với 36 phố phường, những hồ nước xanh ngắt và chiều sâu văn hóa khó nơi nào có được.",
                    radio_script: `Chào ${getPersonalizedName()}! Hà Nội mùa này đẹp lắm, Duy dẫn bạn đi dạo Hồ Gươm và thưởng thức cafe trứng chuẩn vị nhé. Một chút lãng mạn cho ngày mới!`,
                    inspiration: {
                        why_visit: "Nơi lắng đọng hồn thiêng sông núi, sự giao thoa giữa nét cổ kính và hiện đại.",
                        photo_spots_pro: "Hồ Hoàn Kiếm, Phố Cổ, Lăng Bác, Cầu Long Biên.",
                        must_eat_pro: "Phở bò, Bún chả Obama, Cafe trứng Giảng, Chả cá Lã Vọng."
                    },
                    packing_hints: ["Trang phục lịch sự", "Giày đi bộ", "Bản đồ phố cổ", "Tâm hồn nghệ sĩ"],
                    image_tags: ["hanoi lake", "hanoi old quarter", "hanoi temple", "hanoi street", "hanoi food"]
                },
                "hà giang": {
                    place: "Hà Giang",
                    trip_name: "Hà Giang — Miền Đá Nở Hoa",
                    desc: "Chinh phục những cung đường đèo hiểm trở, ngắm nhìn cao nguyên đá hùng vĩ và tìm hiểu văn hóa các dân tộc vùng cao.",
                    radio_script: `Chào ${getPersonalizedName()}! Hà Giang vẫy gọi kìa. Mình sẽ cùng check-in Cột cờ Lũng Cú và thưởng thức bát Phở Tráng Kìm nóng hổi giữa mây trời nhé!`,
                    inspiration: {
                        why_visit: "Vẻ đẹp hùng vĩ của cao nguyên đá Đồng Văn và sự mộc mạc của con người nơi đây.",
                        photo_spots_pro: "Đèo Mã Pì Lèng, Cột cờ Lũng Cú, Nhà của Pao, Dinh thự họ Vương.",
                        must_eat_pro: "Phở Tráng Kìm, Thắng cố, Bánh tam giác mạch, Rượu ngô."
                    },
                    packing_hints: ["Áo khoác ấm", "Giày leo núi", "Máy ảnh", "Bản đồ đèo"],
                    image_tags: ["hagiang mountain", "hagiang landscape", "hagiang pass", "hagiang rock", "hagiang ethnic"]
                }
            };

            const qn = normalizePlaceName(query);
            // Tìm kiếm khớp chuẩn hoá (tránh “râu ông nọ cắm cằm bà kia”)
            const matchKey = Object.keys(demoData).find((key) => normalizePlaceName(key) === qn);
            if (matchKey) {
                data = demoData[matchKey];
            } else {
                // Fallback tức thì: sinh dữ liệu demo dựa đúng query người dùng
                const place = String(query).trim() || "Việt Nam";
                data = {
                    place,
                    trip_name: `${place} — Duy gợi ý vibe chill`,
                    desc: `Duy đang ở chế độ offline, nhưng vẫn gợi ý cho bạn một chuyến đi tử tế tại ${place}.`,
                    radio_script: `Chào ${getPersonalizedName()}! Duy đang offline một chút, nhưng mình vẫn “lên kèo” vi vu ${place} cho bạn đây. Bạn muốn chill, vibe hay healing?`,
                    inspiration: {
                        why_visit: `${place} có thể hợp vibe của bạn ngay lúc này — đi để đổi gió và nạp lại năng lượng.`,
                        photo_spots_pro: `Gợi ý: tìm “best view ${place}”, “sunset ${place}”, “cafe ${place}” trên Maps để chốt góc chụp.`,
                        must_eat_pro: `Gợi ý: tìm món “đặc sản ${place}” và đọc review gần đây để chọn quán ngon.`
                    },
                    packing_hints: ["Giấy tờ", "Sạc dự phòng", "Áo khoác mỏng", "Giày êm"],
                    image_tags: [place, "vietnam travel", "landscape", "nature", "city"]
                };
            }
        }

        DuyAppState.lastTrip = data;
        DuyAppState.lastQuery = String(data.place || query || "").trim() || query;

        // Hiển thị Radio UI nếu có script
        if (data.radio_script && radioUI) {
            radioUI.classList.remove("hidden");
            // Không auto-play để tránh giật/treo máy; user bấm AI Radio khi muốn nghe
        }

        const origin = getOriginInput();
        await refreshFlightEstimateForRoute(origin, data.place || query, DuyAppState.budget);

        // Ảnh phải “đổi theo địa danh”, không hard-code chung 1 bộ ảnh
        if (!Array.isArray(data.images) || data.images.length === 0) {
            data.images = buildDynamicImageUrls(data.place || query, data.image_tags || data.imageTags, 5);
        }
        await preloadImages(data.images);

        // Cache kết quả để lần sau trả tức thì
        if (cacheKey) DuyRuntimeCache.search.set(cacheKey, data);

        await renderLuxuryUI(data, data.images[0], query);

        // Hiệu ứng ăn mừng khi có lịch trình
        safeConfetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
        });

        // Lấy thời tiết và render packing
        geocodePlace(data.place || query)
            .then((geo) => geo ? fetchWeather(geo.lat, geo.lon).then(w => ({w, label: geo.label})) : null)
            .then((pack) => {
                if (!pack || !pack.w) return;
                DuyAppState.lastWeather = pack.w;
                renderWeatherCard(pack.label || data.place, pack.w);
                renderPackingCard(mergePackingHints(data.packing_hints, pack.w.current_weather.temperature, pack.w.current_weather.weathercode, query));
            });

    } catch (e) {
        console.error(e);
        alert("Duy bận tí, bạn thử lại sau nha!");
    } finally {
        loading?.classList.add("hidden");
    }
}

async function renderLuxuryUI(data, imgUrl, query) {
    const agodaLink = buildAgodaLink(data, query);

    const section = document.getElementById("first-look-section");
    const grid = document.getElementById("places-grid");
    const mapsBtn = document.getElementById("maps-link-btn");

    // Slider Images - Sử dụng mảng images từ data
    const images = Array.isArray(data.images) ? data.images : [];
    const fallbackImg =
        typeof ImageEngine !== "undefined" && ImageEngine.placeholderUrl
            ? ImageEngine.placeholderUrl(data.place || query || "DUY GO")
            : "https://placehold.co/1200x800/faf8f5/5d4037?text=DUY%20GO";
    const sliderHtml = images.map(url => `
        <div class="swiper-slide watermark-container dreamy-img-container">
            <img src="${url}" class="w-full h-full object-cover" loading="lazy" decoding="async"
                 onerror="this.onerror=null;this.src=${JSON.stringify(fallbackImg)}">
            <div class="watermark-overlay" style="color: rgba(255, 179, 138, 0.6)">DUY GO</div>
        </div>
    `).join("");

    if (grid) {
        grid.innerHTML = `
            <div class="card-duy bg-white overflow-hidden border border-rose-100 flex flex-col shadow-2xl">
                <!-- Swiper Image Slider -->
                <div class="swiper duy-swiper h-[400px] w-full relative" style="pointer-events: auto;">
                    <div class="swiper-wrapper">
                        ${sliderHtml}
                    </div>
                    <div class="swiper-pagination"></div>
                    <div class="absolute top-4 right-4 z-10">
                        <button onclick="verifyLocationAndCheckIn()" class="bg-rose-500 text-white px-6 py-2.5 rounded-full font-black text-xs shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                            <i class="fa-solid fa-camera"></i> Check-in Pro
                        </button>
                    </div>
                </div>

                <div class="p-6 sm:p-10 text-left space-y-8">
                    <div>
                        <p class="text-[10px] font-black uppercase text-rose-500 tracking-[0.3em] mb-2">Duy Guide · Khám phá Pro</p>
                        <h3 class="text-3xl sm:text-5xl font-black text-stone-900 leading-tight">${escHtml(data.trip_name || data.place)}</h3>
                    </div>

                    <div class="space-y-6">
                        <div class="animate-up" style="animation-delay: 0.1s">
                            <h4 class="font-black text-stone-900 flex items-center gap-2"><i class="fa-solid fa-heart text-rose-500"></i> Tại sao phải đến đây ít nhất một lần?</h4>
                            <p class="text-stone-600 text-sm leading-relaxed mt-2 italic">${escHtml(data.inspiration?.why_visit || data.desc)}</p>
                        </div>

                        <div class="grid sm:grid-cols-2 gap-6">
                            <div class="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 animate-up" style="animation-delay: 0.2s">
                                <h4 class="font-black text-amber-900 text-xs uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <i class="fa-solid fa-camera-retro"></i> Góc chụp triệu like
                                </h4>
                                <p class="text-stone-700 text-sm leading-relaxed">${escHtml(data.inspiration?.photo_spots_pro || "Đang cập nhật...")}</p>
                            </div>
                            <div class="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 animate-up" style="animation-delay: 0.3s">
                                <h4 class="font-black text-rose-900 text-xs uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <i class="fa-solid fa-bowl-food"></i> Món phải ăn
                                </h4>
                                <p class="text-stone-700 text-sm leading-relaxed">${escHtml(data.inspiration?.must_eat_pro || "Đang cập nhật...")}</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-4 pt-4">
                        <a href="${agodaLink}" target="_blank" class="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-black text-sm text-center shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
                            <i class="fa-solid fa-hotel"></i> Đặt khách sạn qua Duy
                        </a>
                        <button onclick="generateFullTrip()" class="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform">
                            Dựng lịch trình Pro ngay
                        </button>
                    </div>
                </div>
            </div>`;

        // Initialize Swiper after rendering
        new Swiper('.duy-swiper', {
            pagination: { el: '.swiper-pagination', clickable: true },
            autoplay: { delay: 3000, disableOnInteraction: false },
            loop: true,
            effect: 'slide',
            speed: 450,
            simulateTouch: true,
            grabCursor: true,
            allowTouchMove: true
        });
    }

    if (mapsBtn) mapsBtn.href = mapsSearchUrl(data.place || query);
    
    // ... (keep the rest of the existing logic for weather, packing, etc.)

    section?.classList.remove("hidden");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Gamification & Duy Xu */
function updateDuyXu(amount) {
    const el = document.getElementById("duy-xu-count");
    if (el) {
        let current = parseInt(el.innerText.replace(/,/g, ''), 10);
        current += amount;
        el.innerText = current.toLocaleString();
    }
}

/** Photo Quest */
function openPhotoQuest() {
    alert("Duy đang quét các 'góc ẩn' tại " + (DuyAppState.lastQuery || "điểm đến của bạn") + "... Sẵn sàng săn ảnh nhận Duy Xu chưa tri kỷ? 📸");
}

/** Travel Tarot */
function drawTarot() {
    const cards = [
        "The Sun: Hành trình rực rỡ, tràn đầy năng lượng tích cực! ☀️",
        "The Star: Hy vọng và sự chữa lành đang chờ bạn. ✨",
        "The Fool: Một khởi đầu mới đầy bất ngờ, cứ đi thôi đừng ngại! 🎒",
        "The Moon: Khám phá những bí ẩn và chiều sâu tâm hồn. 🌙"
    ];
    const card = cards[Math.floor(Math.random() * cards.length)];
    alert("Quẻ bài cho chuyến đi của bạn:\n\n" + card + "\n\n- Duy thỏ thẻ -");
}

/** Bill Splitter - Lầy lội V2 */
function openBillSplitter() {
    const total = prompt("Nhập tổng số thiệt hại (VND):", "1000000");
    const people = prompt("Chia cho mấy 'con nợ' nè?", "4");
    if (total && people) {
        const each = Math.round(total / people);
        const jokes = [
            "Tiền bạc phân minh, ái tình dứt khoát. Trả lẹ cho tri kỷ mình vui nè! 💸",
            "Đừng để Duy phải xách loa đi đòi nợ thuê nhé, ngại lắm! 📣",
            "Có không giữ, mất đừng tìm... nhất là tiền của tri kỷ nha! 🏃‍♂️",
            "Alo, nghe rõ trả lời, tiền về túi ngay và luôn nào! 🏦"
        ];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        alert(`Mỗi người ${each.toLocaleString()} VND nha!\n\nDuy nhắc khéo: ${joke}`);
    }
}

/** Time Capsule */
function openTimeCapsule() {
    alert("Duy đã niêm phong 'Thư gửi tương lai' của bạn. Hẹn gặp lại sau 1 năm để xem chúng mình đã trưởng thành thế nào nhé! 💌");
}

/** Firebase Auth Placeholder */
function loginFirebase() {
    alert("Duy đang kết nối với Google... Đăng nhập thành công! Giờ thì mọi chuyến đi của bạn đều được Duy giữ hộ bí mật 100%. 🛡️");
}

async function generateFullTrip() {
    const query = document.getElementById("query").value.trim();
    if (!query) return alert("Nhập điểm đến ở ô tìm kiếm trước — Duy mới dựng timeline được!");

    const loading = document.getElementById("loading");
    const itinerarySection = document.getElementById("section-itinerary");
    const itineraryDays = document.getElementById("itinerary-days");

    loading?.classList.remove("hidden");

    try {
        // Nếu đã có data từ askAI rồi thì dùng luôn, không cần gọi lại
        let data = DuyAppState.lastTrip;
        
        // Nếu chưa có hoặc query khác thì gọi lại
        if (!data || DuyAppState.lastQuery !== query) {
            const resp = await fetch(`${API_URL}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    destination: query,
                    origin: getOriginInput(),
                    mood: DuyAppState.mood,
                    budget: DuyAppState.budget,
                    days: parseInt(document.getElementById("duration")?.value || "3", 10)
                }),
            });
            data = await parseJsonResponse(resp);
            if (!resp.ok) throw new Error(data.detail || "Server Error");
            DuyAppState.lastTrip = data;
            DuyAppState.lastQuery = query;
        }

        if (data.days && itineraryDays) {
            itineraryDays.innerHTML = data.days.map((day) => {
                const activities = day.activities.map(act => `
                    <div class="flex gap-4 pl-4 border-l-2 border-rose-200 py-4 group hover:border-rose-500 transition-all">
                        <div class="text-[10px] font-black text-rose-800 shrink-0 w-16 uppercase tracking-tighter pt-1">${escHtml(act.time)}</div>
                        <div class="flex-1">
                            <h5 class="font-black text-stone-900 text-lg group-hover:text-rose-600 transition-colors">${escHtml(act.place_name)}</h5>
                            <p class="text-sm text-stone-600 leading-relaxed mt-1">${escHtml(act.description)}</p>
                            <div class="flex flex-wrap gap-2 mt-3">
                                <span class="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-1 rounded-full border border-amber-200">
                                    <i class="fa-solid fa-coins mr-1"></i>~${escHtml(act.cost_estimate)}
                                </span>
                                <button onclick="window.open('${mapsSearchUrl(act.place_name)}', '_blank')" class="bg-stone-100 text-stone-600 text-[10px] font-black px-2 py-1 rounded-full border border-stone-200 hover:bg-stone-200 transition-colors">
                                    <i class="fa-solid fa-location-dot mr-1"></i>Maps
                                </button>
                            </div>
                        </div>
                    </div>
                `).join("");

                return `
                <div class="card-duy bg-white p-6 sm:p-10 border border-stone-100 shadow-xl">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="bg-stone-900 text-white w-14 h-14 rounded-3xl flex flex-col items-center justify-center shadow-lg">
                            <span class="text-[10px] font-black uppercase opacity-60 leading-none mb-1">Ngày</span>
                            <span class="text-xl font-black leading-none">${day.day}</span>
                        </div>
                        <div class="flex-1">
                            <p class="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em] mb-1">Lịch trình Duy gợi ý</p>
                            <h4 class="text-xl font-black text-stone-900">“Chuyến vi vu ngày ${day.day}”</h4>
                        </div>
                    </div>
                    <div class="space-y-2">
                        ${activities}
                    </div>
                </div>`;
            }).join("");

            itinerarySection?.classList.remove("hidden");
            itinerarySection?.scrollIntoView({ behavior: "smooth", block: "start" });
            
            // Pháo giấy ăn mừng
            safeConfetti({
                particleCount: 200,
                spread: 120,
                origin: { y: 0.7 }
            });
        }
    } catch (e) {
        console.error(e);
        alert("Duy bận tí, không dựng timeline được. Thử lại sau nhé tri kỷ!");
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
let _queryDebounce;
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

    // Debounce tìm kiếm (300ms) để giảm lag khi gõ
    const qInput = document.getElementById("query");
    qInput?.addEventListener("input", () => {
        clearTimeout(_queryDebounce);
        const v = String(qInput.value || "").trim();
        if (!v) return;
        _queryDebounce = setTimeout(() => {
            // không spam alert vì input đã có value
            askAI();
        }, 300);
    });
    qInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(_queryDebounce);
            askAI();
        }
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
