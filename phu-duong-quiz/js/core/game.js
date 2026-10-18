/**
 * core/game.js — trạng thái làm bài: câu đã chọn, đáp án đúng, điểm số.
 * Không đụng tới DOM để dễ kiểm thử.
 */
import { questions } from '../data/slides.js';
import { CONFIG } from '../config.js';

export class Game {
  constructor() {
    this.questions = questions;
    this.answers = new Array(questions.length).fill(null); // { choice, correct, at, attempts }
    /** các phương án đã chọn SAI ở mỗi câu (để tô đỏ, không cho chọn lại) */
    this.tries = questions.map(() => []);
    this.revealed = new Array(questions.length).fill(false);
  }

  get total() {
    return this.questions.length;
  }

  correctKey(index) {
    return this.questions[index].answer;
  }

  isAnswered(index) {
    return Boolean(this.answers[index]);
  }

  /**
   * Ghi nhận một lần chọn. Chọn SAI thì câu hỏi vẫn mở để chọn lại cho tới khi đúng;
   * chỉ khi chọn đúng mới khoá câu và cộng điểm.
   */
  answer(index, choice) {
    if (index < 0 || index >= this.total) return null;

    const correctKey = this.correctKey(index);
    if (this.answers[index]) {
      return {
        ...this.answers[index],
        correctKey,
        alreadyAnswered: true,
        firstTry: this.answers[index].attempts === 1,
      };
    }

    const correct = choice === correctKey;
    if (!correct && !this.tries[index].includes(choice)) this.tries[index].push(choice);

    if (correct) {
      const attempts = this.tries[index].length + 1;
      this.answers[index] = { choice, correct: true, at: Date.now(), attempts };
      return { choice, correct, correctKey, alreadyAnswered: false, attempts, firstTry: attempts === 1 };
    }

    return {
      choice,
      correct: false,
      correctKey, // KHÔNG hiển thị ra giao diện khi chọn sai
      alreadyAnswered: false,
      attempts: this.tries[index].length,
      rejected: this.tries[index].includes(choice),
    };
  }

  /** Phương án đã chọn sai trước đó. */
  wrongTries(index) {
    return this.tries[index] || [];
  }

  reveal(index) {
    this.revealed[index] = true;
    return this.correctKey(index);
  }

  /**
   * Đáp án chỉ được "lộ" khi người dẫn bấm Hiện / phím R.
   * Riêng câu trả lời ĐÚNG thì lộ luôn (không còn gì để giấu);
   * câu trả lời SAI thì giữ kín, chỉ tô đỏ ô vừa chọn.
   */
  isRevealed(index) {
    return this.revealed[index] || Boolean(this.answers[index]?.correct);
  }

  get stats() {
    const answered = this.answers.filter(Boolean).length;
    const correct = this.answers.filter((a) => a && a.correct).length;
    return {
      answered,
      correct,
      total: this.total,
      score: correct * CONFIG.scoring.correct,
      maxScore: this.total * CONFIG.scoring.correct,
    };
  }

  reset() {
    this.answers = new Array(this.total).fill(null);
    this.tries = this.questions.map(() => []);
    this.revealed = new Array(this.total).fill(false);
  }
}
