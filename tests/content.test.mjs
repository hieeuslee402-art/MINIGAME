/**
 * tests/content.test.mjs
 * Kiểm tra nội dung bài thuyết trình khớp 100% với bản gốc đã gửi.
 * Chạy: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, answerKey, slides, deckMeta, outro } from '../js/data/slides.js';

const ORIGINAL = {
  1: {
    part: 'Phần 1 – Giới thiệu chung',
    question: '1. Hiện tượng phú dưỡng là gì?',
    A: 'Hiện tượng nguồn nước tích tụ quá nhiều chất dinh dưỡng, chủ yếu là hợp chất chứa nitơ và photpho, kích thích tảo phát triển quá mức, làm mất cân bằng hệ sinh thái nước.',
    B: 'Hiện tượng nguồn nước bị nhiễm kim loại nặng do xả thải công nghiệp.',
    C: 'Hiện tượng nhiệt độ nước tăng cao do biến đổi khí hậu.',
    D: 'Hiện tượng độ pH của nước giảm mạnh do mưa axit.',
    answer: 'A',
  },
  2: {
    part: 'Phần 2 – Nguyên nhân',
    question: '2. Điều nào sau đây là nguyên nhân tự nhiên gây ra hiện tượng phú dưỡng?',
    A: 'Sử dụng phân bón hóa học trong sản xuất nông nghiệp.',
    B: 'Nước thải sinh hoạt từ khu dân cư chưa được xử lí.',
    C: 'Lá cây, xác sinh vật và chất hữu cơ phân hủy tự nhiên giải phóng chất dinh dưỡng vào nước.',
    D: 'Nước thải công nghiệp chứa hợp chất dinh dưỡng xả ra sông, suối.',
    answer: 'C',
  },
  3: {
    part: 'Phần 3 – Cơ sở hóa học',
    question: '3. Nitơ có vai trò gì đối với tảo và thực vật thủy sinh?',
    A: 'Nitơ tham gia cấu tạo protein và axit nucleic.',
    B: 'Nitơ chỉ tham gia cấu tạo cellulose của tế bào thực vật.',
    C: 'Nitơ làm tăng độ pH của nguồn nước.',
    D: 'Nitơ không có vai trò trong quá trình sinh trưởng của tảo.',
    answer: 'A',
  },
  4: {
    part: 'Phần 4 – Diễn biến',
    question:
      '4. Ở giai đoạn sau của hiện tượng phú dưỡng, oxygen hòa tan trong nước suy giảm chủ yếu do nguyên nhân nào?',
    A: 'Tảo quang hợp mạnh hơn, thải ra nhiều carbon dioxide.',
    B: 'Tảo chết, vi sinh vật phân hủy xác tảo làm tiêu thụ oxygen hòa tan trong nước.',
    C: 'Nhiệt độ nước tăng cao khiến oxygen bay hơi hết.',
    D: 'Vi khuẩn cố định nitơ trong không khí làm mất cân bằng oxygen.',
    answer: 'B',
  },
  5: {
    part: 'Phần 5 – Tác hại',
    question: '5. Tác hại nào sau đây của hiện tượng phú dưỡng đối với hệ sinh thái nước là đúng?',
    A: 'Hàm lượng oxygen hòa tan trong nước tăng lên.',
    B: 'Ánh sáng truyền qua nước nhiều hơn, thực vật thủy sinh phát triển mạnh.',
    C: 'Cá, tôm và sinh vật thủy sinh có thể chết hàng loạt do thiếu oxygen; một số loài tảo lam còn có khả năng tiết độc tố.',
    D: 'Đa dạng sinh học trong hệ sinh thái nước tăng lên.',
    answer: 'C',
  },
  6: {
    part: 'Phần 6 – Biện pháp hạn chế và khắc phục',
    question: '6. Biện pháp nào sau đây giúp hạn chế hiện tượng phú dưỡng trong nông nghiệp?',
    A: 'Tăng liều lượng phân bón hóa học để tăng năng suất cây trồng.',
    B: 'Sử dụng phân bón đúng loại, đúng liều lượng, đúng thời điểm và hạn chế phân bón bị rửa trôi.',
    C: 'Xả trực tiếp phân chuồng và chất thải chăn nuôi ra sông, suối.',
    D: 'Bón nhiều phân đạm vào đầu mùa mưa để cây sinh trưởng nhanh.',
    answer: 'B',
  },
  7: {
    part: 'Tổng kết',
    question: '7. Phát biểu nào sau đây là ĐÚNG về hiện tượng phú dưỡng?',
    A: 'Phú dưỡng là hiện tượng hoàn toàn tự nhiên, có lợi và không cần kiểm soát.',
    B: 'Phú dưỡng chỉ do các yếu tố tự nhiên gây ra, con người không thể phòng ngừa.',
    C: 'Phú dưỡng do nguồn nước tích tụ quá nhiều nitơ, photpho, kích thích tảo nở hoa dẫn đến thiếu oxygen và mất cân bằng hệ sinh thái; hiện tượng này có thể được hạn chế bằng cách kiểm soát các nguồn ô nhiễm từ đầu vào.',
    D: 'Chỉ cần thấy nước có màu xanh là có thể kết luận ao, hồ đó đang bị phú dưỡng.',
    answer: 'C',
  },
};

test('có đúng 7 câu hỏi', () => {
  assert.equal(questions.length, 7);
});

test('deck có 10 slide: giới thiệu + 7 câu hỏi + video kết thúc + kết thúc', () => {
  assert.equal(slides.length, 10);
  assert.equal(slides[0].type, 'intro');
  assert.equal(slides.filter((s) => s.type === 'question').length, 7);
  // slide thứ 9 là slide video — tới đây thì video tự phát
  assert.equal(slides[8].type, 'video');
  assert.equal(slides[9].type, 'outro');
});

test('nội dung từng câu khớp bản gốc', () => {
  questions.forEach((q) => {
    const expected = ORIGINAL[q.id];
    assert.ok(expected, `thiếu dữ liệu gốc cho câu ${q.id}`);
    assert.equal(q.part, expected.part, `phần của câu ${q.id}`);
    assert.equal(q.question, expected.question, `câu hỏi ${q.id}`);
    ['A', 'B', 'C', 'D'].forEach((key) => {
      assert.equal(q.options[key], expected[key], `phương án ${key} của câu ${q.id}`);
    });
    assert.equal(q.answer, expected.answer, `đáp án câu ${q.id}`);
  });
});

test('bảng đáp án: A, C, A, B, C, B, C', () => {
  assert.deepEqual(answerKey, ['A', 'C', 'A', 'B', 'C', 'B', 'C']);
  assert.deepEqual(outro.tableHead, ['Câu', '1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(outro.tableRow, ['Đáp án', 'A', 'C', 'A', 'B', 'C', 'B', 'C']);
});

test('mỗi câu có đúng 4 phương án A–D', () => {
  questions.forEach((q) => {
    assert.deepEqual(
      q.optionList.map((o) => o.key),
      ['A', 'B', 'C', 'D']
    );
    q.optionList.forEach((o) => assert.ok(o.text.trim().length > 0));
  });
});

test('thông tin chung của bài thuyết trình', () => {
  assert.equal(deckMeta.introLine, 'SAU ĐÂY LÀ MINI GAME TRẢ LỜI CÂU HỎI CỦA TỔ 1');
  assert.equal(deckMeta.title, 'BỘ CÂU HỎI TRẮC NGHIỆM');
  assert.equal(deckMeta.subtitle, 'HIỆN TƯỢNG PHÚ DƯỠNG – NGUYÊN NHÂN, TÁC HẠI VÀ GIẢI PHÁP');
  assert.equal(deckMeta.subject, 'Môn: Hóa học / Giáo dục môi trường');
  assert.equal(deckMeta.count, 'Số câu: 7 (mỗi câu 4 phương án A, B, C, D)');
  assert.equal(
    deckMeta.note,
    'Ghi chú: Đáp án đúng của mỗi câu được in đậm và tô màu xanh ngay dưới câu hỏi.'
  );
});
