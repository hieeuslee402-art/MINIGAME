/**
 * config.js
 * Cấu hình camera, mô hình bàn tay và ngưỡng nhận diện cử chỉ.
 * Muốn "nhạy" hơn thì giảm minDx / minSpeed; muốn "chắc" hơn thì tăng lên.
 */
export const CONFIG = {
  camera: {
    /* Độ phân giải camera lấy vào. Khung đưa vào mô hình được thu về inputWidth bên dưới.
       960×540 đủ nét cho bàn tay mà nhẹ hơn 1280×720 (copy khung hình nhanh hơn). */
    width: 960,
    height: 540,
    /** Mục tiêu 30 khung/giây — đủ mượt cho cử chỉ, không đốt CPU như 60. */
    fps: 30,
    /** Chặn trên cứng (0 = không giới hạn). */
    maxFps: 30,
  },

  hand: {
    /** 2 = nhận cả hai tay (để bắt cử chỉ "giơ cả 2 tay" chuyển trang). */
    maxNumHands: 2,
    /** Hai tay phải ở nửa trên khung hình (y < mức này) mới tính là "giơ tay". */
    bothHandsMaxY: 0.72,
    /** Hai tay phải cách nhau theo phương ngang ít nhất mức này (tỉ lệ chiều rộng khung). */
    twoHandsMinGap: 0.1,
    /** Lọc "bàn tay ảo" (mặt/đồ vật bị nhận nhầm, hoặc bản trùng của cùng một tay).
        spread = (gốc ngón trỏ → gốc ngón út) / (cổ tay → gốc ngón giữa) — tay thật ≈ 0,6–1,5.
        reach  = (cổ tay → đầu ngón giữa) / bàn tay — tay thật ≈ 1,3–2,4. */
    plausibility: {
      enabled: true,
      minScore: 0.5,
      spread: [0.35, 2.0],
      reach: [0.9, 2.8],
      minArea: 0.0015,
    },
    /** 0 = model lite (nhanh, nhẹ) • 1 = model full (chính xác hơn khi tay gần camera).
        Web tự nâng lên 1 nếu 4 giây không thấy bàn tay. */
    modelComplexity: 0,
    /** Hạ thấp để bắt được tay trong điều kiện thiếu sáng / tay hơi xa. */
    minDetectionConfidence: 0.45,
    minTrackingConfidence: 0.4,
    /** Đưa khung hình qua canvas 640px: ổn định hơn truyền thẳng thẻ <video>. */
    useCanvasInput: true,
    /** 384px: đủ chi tiết cho đầu ngón tay mà suy luận nhanh gấp ~2,8 lần so với 640px.
       Nếu máy vẫn chậm, handTracking tự hạ tiếp xuống minInputWidth. */
    inputWidth: 384,
    /** Sàn hạ độ phân giải khi máy không đạt nổi 30 khung/giây. */
    minInputWidth: 256,
    /** Tự hạ độ phân giải khi FPS thấp (giữ mục tiêu ~30 khung/giây). */
    adaptiveInput: true,
    /** Làm mượt landmark: càng cao càng bám tay nhanh (0,8 ≈ trễ dưới 1 khung hình). */
    smootherAlpha: 0.8,
    /** Tăng sáng/tương phản nhẹ trước khi nhận diện (rất hiệu quả trong phòng thiếu sáng). */
    enhance: { enabled: true, brightness: 1.18, contrast: 1.14, saturate: 1.06 },
    /** Một lần gửi khung hình quá thời gian này coi như treo → tự phục hồi. */
    sendTimeoutMs: 4000,
    /** Không có kết quả trả về quá lâu → tạo lại mô hình. */
    deadAfterMs: 8000,
    /** Tay ưu tiên hiển thị/khuyến nghị: 'Left' (mặc định), 'Right' hoặc 'Auto'. */
    trackedHand: 'Left',
    /** false = dùng bàn tay nào đang thấy (ổn định nhất khi trình chiếu thật). */
    strictHandedness: false,
    /** Cho phép tự nâng cấp mô hình nếu 8 giây không thấy tay. */
    autoUpgradeModel: true,
    /** Tự bật khi WebGL của máy có vấn đề (tự động, không cần đổi tay). */
    forceCpu: false,
  },

  /** Mức nhạy cử chỉ — đổi nhanh trong bảng Trợ giúp (phím H). */
  sensitivity: 'normal', // 'soft' | 'normal' | 'strong'

  gestures: {
    /** Chuyển trang bằng MỘT tay (trỏ + giữa bắt chéo) — mặc định TẮT để không chuyển
        trang nhầm khi chỉ giơ một tay. Bật lên nếu muốn dùng lại. */
    allowOneHandNext: false,

    /* Cặp ngón chạm ngón cái:
         cái+trỏ = A · cái+giữa = B · cái+áp út = C · cái+út = D
       Chuyển trang KHÔNG dùng cặp ngón chạm mà dùng cử chỉ "giơ cả 2 tay" (xem hand.*). */
    chord: {
      /** tỉ lệ (khoảng cách 2 đầu ngón / kích thước bàn tay) để coi là "đang chạm" */
      touchOn: 0.36,
      /** phải nhả ra rõ ràng mới tính lần chạm mới (chống rung tín hiệu) */
      touchOff: 0.62,
      /** cặp thắng phải nhỏ hơn cặp thứ hai ít nhất 12% → tránh nhầm khi 2 ngón cùng chạm */
      margin: 0.88,
      /** bỏ qua cử chỉ ngay khi tay vừa vào khung */
      warmupMs: 180,
      /** khoá giữa 2 lần nhận (một câu chỉ cần một đáp án) */
      cooldownMs: 700,
    },
  },

  /** Âm thanh đúng/sai + video kết thúc do người dùng đặt trong repo. */
  media: {
    /** Thư mục chứa dung.mp3 / sai.mp3 / outro.mp4 (đường dẫn thử lần lượt). */
    audioDir: 'dung/',
    correct: ['dung/dung.mp3', 'dung.mp3', 'assets/audio/dung.mp3', 'sounds/dung.mp3', 'sounds/dung.wav'],
    wrong: ['sai/sai.mp3', 'sai.mp3', 'assets/audio/sai.mp3', 'sounds/sai.mp3', 'sounds/sai.wav'],
    video: ['end/outro.mp4', 'outro.mp4', 'assets/video/outro.mp4'],
    /** Âm lượng file phát (0–1). */
    volume: 0.9,
  },

  /** Nhận búng tay bằng micro → phát video kết thúc toàn màn hình. */
  snap: {
    /** Bật mặc định khi vào trang (vẫn cần người dùng cấp quyền micro). */
    enabled: true,
    /** Hai tiếng búng cách nhau gần hơn mức này sẽ bỏ qua (ms). */
    minIntervalMs: 320,
    /** Ngưỡng tương đối so với nền ồn. */
    hfRatio: 5,
    rmsRatio: 2.6,
    /** Ngưỡng tuyệt đối (0–1) — phòng thu im lặng vẫn nhận được. */
    hfAbs: 0.006,
    rmsAbs: 0.004,
    /** Búng tay là tiếng "sắc": năng lượng cao tần ≥ 55% tổng năng lượng. */
    hfVsRms: 0.55,
  },

  scoring: {
    correct: 10,
  },

  effects: {
    reducedMotion: false,
  },
};
