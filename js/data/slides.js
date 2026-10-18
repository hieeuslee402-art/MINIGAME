/**
 * data/slides.js
 * Toàn bộ nội dung bài thuyết trình — giữ nguyên 100% văn bản gốc.
 * 10 slide: 1 giới thiệu + 7 câu hỏi + 1 video kết thúc + 1 kết thúc.
 */

export const deckMeta = {
  org: 'TỔ 1',
  introLine: 'SAU ĐÂY LÀ MINI GAME TRẢ LỜI CÂU HỎI CỦA TỔ 1',
  title: 'BỘ CÂU HỎI TRẮC NGHIỆM',
  subtitle: 'HIỆN TƯỢNG PHÚ DƯỠNG – NGUYÊN NHÂN, TÁC HẠI VÀ GIẢI PHÁP',
  subject: 'Môn: Hóa học / Giáo dục môi trường',
  count: 'Số câu: 7 (mỗi câu 4 phương án A, B, C, D)',
  note: 'Ghi chú: Đáp án đúng của mỗi câu được in đậm và tô màu xanh ngay dưới câu hỏi.',
};

/** Ký hiệu nguyên tố trang trí cho từng câu (thuần thẩm mỹ, không ảnh hưởng nội dung). */
const elementBadges = [
  { symbol: 'N', number: 7, name: 'Nitơ', mass: '14,007' },
  { symbol: 'P', number: 15, name: 'Photpho', mass: '30,974' },
  { symbol: 'C', number: 6, name: 'Cacbon', mass: '12,011' },
  { symbol: 'O', number: 8, name: 'Oxygen', mass: '15,999' },
  { symbol: 'S', number: 16, name: 'Lưu huỳnh', mass: '32,06' },
  { symbol: 'K', number: 19, name: 'Kali', mass: '39,098' },
  { symbol: 'Mg', number: 12, name: 'Magie', mass: '24,305' },
];

const rawQuestions = [
  {
    id: 1,
    part: 'Phần 1 – Giới thiệu chung',
    question: '1. Hiện tượng phú dưỡng là gì?',
    options: {
      A: 'Hiện tượng nguồn nước tích tụ quá nhiều chất dinh dưỡng, chủ yếu là hợp chất chứa nitơ và photpho, kích thích tảo phát triển quá mức, làm mất cân bằng hệ sinh thái nước.',
      B: 'Hiện tượng nguồn nước bị nhiễm kim loại nặng do xả thải công nghiệp.',
      C: 'Hiện tượng nhiệt độ nước tăng cao do biến đổi khí hậu.',
      D: 'Hiện tượng độ pH của nước giảm mạnh do mưa axit.',
    },
    answer: 'A',
  },
  {
    id: 2,
    part: 'Phần 2 – Nguyên nhân',
    question: '2. Điều nào sau đây là nguyên nhân tự nhiên gây ra hiện tượng phú dưỡng?',
    options: {
      A: 'Sử dụng phân bón hóa học trong sản xuất nông nghiệp.',
      B: 'Nước thải sinh hoạt từ khu dân cư chưa được xử lí.',
      C: 'Lá cây, xác sinh vật và chất hữu cơ phân hủy tự nhiên giải phóng chất dinh dưỡng vào nước.',
      D: 'Nước thải công nghiệp chứa hợp chất dinh dưỡng xả ra sông, suối.',
    },
    answer: 'C',
  },
  {
    id: 3,
    part: 'Phần 3 – Cơ sở hóa học',
    question: '3. Nitơ có vai trò gì đối với tảo và thực vật thủy sinh?',
    options: {
      A: 'Nitơ tham gia cấu tạo protein và axit nucleic.',
      B: 'Nitơ chỉ tham gia cấu tạo cellulose của tế bào thực vật.',
      C: 'Nitơ làm tăng độ pH của nguồn nước.',
      D: 'Nitơ không có vai trò trong quá trình sinh trưởng của tảo.',
    },
    answer: 'A',
  },
  {
    id: 4,
    part: 'Phần 4 – Diễn biến',
    question:
      '4. Ở giai đoạn sau của hiện tượng phú dưỡng, oxygen hòa tan trong nước suy giảm chủ yếu do nguyên nhân nào?',
    options: {
      A: 'Tảo quang hợp mạnh hơn, thải ra nhiều carbon dioxide.',
      B: 'Tảo chết, vi sinh vật phân hủy xác tảo làm tiêu thụ oxygen hòa tan trong nước.',
      C: 'Nhiệt độ nước tăng cao khiến oxygen bay hơi hết.',
      D: 'Vi khuẩn cố định nitơ trong không khí làm mất cân bằng oxygen.',
    },
    answer: 'B',
  },
  {
    id: 5,
    part: 'Phần 5 – Tác hại',
    question: '5. Tác hại nào sau đây của hiện tượng phú dưỡng đối với hệ sinh thái nước là đúng?',
    options: {
      A: 'Hàm lượng oxygen hòa tan trong nước tăng lên.',
      B: 'Ánh sáng truyền qua nước nhiều hơn, thực vật thủy sinh phát triển mạnh.',
      C: 'Cá, tôm và sinh vật thủy sinh có thể chết hàng loạt do thiếu oxygen; một số loài tảo lam còn có khả năng tiết độc tố.',
      D: 'Đa dạng sinh học trong hệ sinh thái nước tăng lên.',
    },
    answer: 'C',
  },
  {
    id: 6,
    part: 'Phần 6 – Biện pháp hạn chế và khắc phục',
    question: '6. Biện pháp nào sau đây giúp hạn chế hiện tượng phú dưỡng trong nông nghiệp?',
    options: {
      A: 'Tăng liều lượng phân bón hóa học để tăng năng suất cây trồng.',
      B: 'Sử dụng phân bón đúng loại, đúng liều lượng, đúng thời điểm và hạn chế phân bón bị rửa trôi.',
      C: 'Xả trực tiếp phân chuồng và chất thải chăn nuôi ra sông, suối.',
      D: 'Bón nhiều phân đạm vào đầu mùa mưa để cây sinh trưởng nhanh.',
    },
    answer: 'B',
  },
  {
    id: 7,
    part: 'Tổng kết',
    question: '7. Phát biểu nào sau đây là ĐÚNG về hiện tượng phú dưỡng?',
    options: {
      A: 'Phú dưỡng là hiện tượng hoàn toàn tự nhiên, có lợi và không cần kiểm soát.',
      B: 'Phú dưỡng chỉ do các yếu tố tự nhiên gây ra, con người không thể phòng ngừa.',
      C: 'Phú dưỡng do nguồn nước tích tụ quá nhiều nitơ, photpho, kích thích tảo nở hoa dẫn đến thiếu oxygen và mất cân bằng hệ sinh thái; hiện tượng này có thể được hạn chế bằng cách kiểm soát các nguồn ô nhiễm từ đầu vào.',
      D: 'Chỉ cần thấy nước có màu xanh là có thể kết luận ao, hồ đó đang bị phú dưỡng.',
    },
    answer: 'C',
  },
];

export const answerKey = rawQuestions.map((q) => q.answer);

export const questions = rawQuestions.map((q, i) => ({
  ...q,
  index: i,
  badge: elementBadges[i],
  optionList: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: q.options[key] })),
}));

export const outro = {
  headline: 'CẢM ƠN CÁC BẠN ĐÃ THAM GIA!',
  subline: 'MINI GAME TRẢ LỜI CÂU HỎI • TỔ 1 • HÓA HỌC',
  tableTitle: 'BẢNG ĐÁP ÁN',
  tableHead: ['Câu', '1', '2', '3', '4', '5', '6', '7'],
  tableRow: ['Đáp án', ...answerKey],
};

/** Slide 9 — video kết thúc: tới đây (giơ cả 2 tay) là video tự phát toàn màn hình. */
export const videoSlide = {
  eyebrow: 'VIDEO KẾT THÚC',
  title: 'CẢM ƠN CÁC BẠN ĐÃ THEO DÕI!',
  subline: 'Giơ cả 2 tay từ câu cuối để tới slide này — video sẽ tự phát toàn màn hình.',
  playLabel: 'PHÁT VIDEO',
  nextLabel: 'XEM BẢNG ĐÁP ÁN',
  hint: 'Búng tay (hoặc phím E) để phát lại · Esc để đóng video',
  missing: 'Chưa có file <code>end/outro.mp4</code> — hãy thêm video vào thư mục <code>end</code>.',
};

/** Deck hoàn chỉnh: slide 1 giới thiệu → 7 câu hỏi → slide video → slide kết thúc. */
export const slides = [
  { type: 'intro', id: 'intro', title: deckMeta.introLine },
  ...questions.map((q) => ({ type: 'question', id: `q${q.id}`, question: q })),
  { type: 'video', id: 'video', title: videoSlide.title },
  { type: 'outro', id: 'outro', title: outro.headline },
];

export const totalQuestions = questions.length;
