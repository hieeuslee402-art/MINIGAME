/**
 * data/slides.js
 * Toàn bộ nội dung bài thuyết trình — giữ nguyên 100% văn bản gốc.
 * 9 slide: 1 giới thiệu + 7 câu hỏi + 1 video kết thúc (slide cuối).
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
    question: 'Hiện tượng phú dưỡng là gì?',
    options: {
      A: 'Hiện tượng nguồn nước tích tụ quá nhiều chất dinh dưỡng, chủ yếu là hợp chất chứa nitơ và photpho, kích thích tảo phát triển quá mức, làm mất cân bằng hệ sinh thái nước.',
      B: 'Hiện tượng nguồn nước tích tụ quá nhiều hợp chất kim loại nặng độc hại, gây ra sự suy giảm trầm trọng chất lượng nước sạch và làm ô nhiễm môi trường đất xung quanh.',
      C: 'Hiện tượng nhiệt độ của các nguồn nước tự nhiên tăng cao đột ngột do tác động của biến đổi khí hậu, làm thay đổi tốc độ hòa tan chất khí và tập tính sinh sản của sinh vật.',
      D: 'Hiện tượng độ pH của các nguồn nước ngọt giảm mạnh do sự xuất hiện của mưa axit, gây ảnh hưởng nghiêm trọng đến lớp màng tế bào của thực vật thủy sinh.',
    },
    answer: 'A',
  },
  {
    id: 2,
    part: 'Phần 2 – Nguyên nhân',
    question: 'Điều nào sau đây là nguyên nhân tự nhiên gây ra hiện tượng phú dưỡng?',
    options: {
      A: 'Việc lạm dụng các loại phân bón hóa học dư thừa trong hoạt động trồng trọt nông nghiệp.',
      B: 'Việc xả thải trực tiếp nước thải sinh hoạt chưa qua xử lý từ các khu dân cư đông đúc.',
      C: 'Sự phân hủy tự nhiên của lá cây, xác sinh vật và các chất hữu cơ cuốn vào nguồn nước.',
      D: 'Sự phát thải nước thải công nghiệp chứa nhiều hợp chất dinh dưỡng ra sông, hồ, ao.',
    },
    answer: 'C',
  },
  {
    id: 3,
    part: 'Phần 3 – Cơ sở hóa học',
    question: 'Nitơ có vai trò gì đối với tảo và thực vật thủy sinh?',
    options: {
      A: 'Nitơ tham gia vào quá trình tổng hợp cấu tạo protein và các phân tử axit nucleic của tế bào.',
      B: 'Nitơ chỉ tham gia vào việc liên kết cấu tạo nên thành cellulose cứng chắc của tế bào thực vật.',
      C: 'Nitơ đóng vai trò thúc đẩy sự tăng cao độ pH giúp cân bằng lại môi trường kiềm trong nguồn nước.',
      D: 'Nitơ hoàn toàn không đóng vai trò trực tiếp nào trong quá trình sinh trưởng và phát triển của tảo.',
    },
    answer: 'A',
  },
  {
    id: 4,
    part: 'Phần 4 – Diễn biến',
    question:
      'Ở giai đoạn sau của hiện tượng phú dưỡng, oxygen hòa tan trong nước suy giảm chủ yếu do nguyên nhân nào?',
    options: {
      A: 'Tảo thực hiện quá trình quang hợp diễn ra mạnh mẽ hơn, giải phóng ra lượng lớn khí carbon dioxide vào nước.',
      B: 'Tảo bị chết hàng loạt, các vi sinh vật tiến hành phân hủy xác tảo khiến oxygen hòa tan bị tiêu thụ mạnh.',
      C: 'Nhiệt độ môi trường nước tăng cao một cách đột ngột làm cho toàn bộ khí oxygen hòa tan bị bay hơi mất.',
      D: 'Hoạt động của các vi khuẩn cố định nitơ trong không khí gây ra sự phá vỡ trạng thái cân bằng của oxygen.',
    },
    answer: 'B',
  },
  {
    id: 5,
    part: 'Phần 5 – Tác hại',
    question: 'Tác hại nào sau đây của hiện tượng phú dưỡng đối với hệ sinh thái nước là đúng?',
    options: {
      A: 'Làm gia tăng đáng kể hàm lượng oxygen hòa tan trong nước, giúp các loài động vật thủy sinh phát triển mạnh.',
      B: 'Giúp ánh sáng mặt trời truyền qua nước tốt hơn, tạo điều kiện thuận lợi cho thực vật đáy ao hồ phát triển.',
      C: 'Cá, tôm và sinh vật thủy sinh có thể chết hàng loạt do thiếu oxygen; một số loài tảo lam còn có khả năng tiết độc tố.',
      D: 'Thúc đẩy sự gia tăng độ đa dạng sinh học và sự phong phú của các loài sinh vật trong toàn hệ sinh thái nước.',
    },
    answer: 'C',
  },
  {
    id: 6,
    part: 'Phần 6 – Biện pháp hạn chế và khắc phục',
    question: 'Biện pháp nào sau đây giúp hạn chế hiện tượng phú dưỡng trong nông nghiệp?',
    options: {
      A: 'Tăng cường tối đa liều lượng phân bón hóa học nhằm thúc đẩy nhanh năng suất của cây trồng.',
      B: 'Sử dụng phân bón đúng loại, đúng liều lượng, đúng thời điểm và hạn chế phân bón bị rửa trôi.',
      C: 'Xả trực tiếp toàn bộ nguồn phân chuồng và chất thải chưa xử lý từ hoạt động chăn nuôi ra sông.',
      D: 'Bón một lượng rất lớn phân đạm vào thời điểm đầu mùa mưa để cây có thể sinh trưởng nhanh chóng.',
    },
    answer: 'B',
  },
  {
    id: 7,
    part: 'Tổng kết',
    question: 'Phát biểu nào sau đây là ĐÚNG về hiện tượng phú dưỡng?',
    options: {
      A: 'Phú dưỡng là hiện tượng mang tính tự nhiên hoàn toàn, đem lại nhiều lợi ích cho nguồn nước nên không cần kiểm soát.',
      B: 'Phú dưỡng xảy ra hoàn toàn do tác động của các yếu tố tự nhiên, con người không thể can thiệp hay phòng ngừa.',
      C: 'Phú dưỡng do nguồn nước tích tụ quá nhiều nitơ, photpho, kích thích tảo nở hoa dẫn đến thiếu oxygen và mất cân bằng hệ sinh thái; hiện tượng này có thể được hạn chế bằng cách kiểm soát các nguồn ô nhiễm từ đầu vào.',
      D: 'Phú dưỡng là hiện tượng mà cứ khi nào quan sát thấy nước xuất hiện màu xanh là có thể kết luận chắc chắn ao hồ đó bị ô nhiễm.',
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
  hint: 'Búng tay (hoặc phím E) để phát lại · Esc để đóng video',
  missing: 'Chưa có file <code>end/outro.mp4</code> — hãy thêm video vào thư mục <code>end</code>.',
};

/** Deck hoàn chỉnh: slide 1 giới thiệu → 7 câu hỏi → slide 9 video kết thúc. */
export const slides = [
  { type: 'intro', id: 'intro', title: deckMeta.introLine },
  ...questions.map((q) => ({ type: 'question', id: `q${q.id}`, question: q })),
  { type: 'video', id: 'video', title: videoSlide.title },
];

export const totalQuestions = questions.length;
