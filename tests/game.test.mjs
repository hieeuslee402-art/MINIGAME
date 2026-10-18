/**
 * tests/game.test.mjs
 * Quy tắc chọn đáp án: chọn SAI thì câu hỏi vẫn mở để chọn lại cho tới khi đúng,
 * chỉ khi đúng mới khoá câu + cộng điểm và mới lộ đáp án.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/config.js';

const Q1 = 0; // câu 1 có đáp án đúng là A

test('chọn sai: chưa tính là đã trả lời, chưa cộng điểm, chưa lộ đáp án', () => {
  const game = new Game();
  const res = game.answer(Q1, 'B');

  assert.equal(res.correct, false);
  assert.equal(game.isAnswered(Q1), false, 'câu hỏi phải còn mở để chọn lại');
  assert.deepEqual(game.wrongTries(Q1), ['B'], 'phương án sai được ghi nhớ để tô đỏ');
  assert.equal(game.stats.score, 0);
  assert.equal(game.stats.answered, 0);
  assert.equal(game.isRevealed(Q1), false, 'không được lộ đáp án');
});

test('chọn lại đúng sau khi sai: khoá câu, cộng điểm, lộ đáp án', () => {
  const game = new Game();
  game.answer(Q1, 'B');
  game.answer(Q1, 'C');
  const res = game.answer(Q1, 'A');

  assert.equal(res.correct, true);
  assert.equal(res.attempts, 3);
  assert.equal(game.isAnswered(Q1), true);
  assert.equal(game.answers[Q1].choice, 'A');
  assert.equal(game.stats.score, CONFIG.scoring.correct);
  assert.equal(game.stats.answered, 1);
  assert.equal(game.isRevealed(Q1), true);
});

test('chọn đúng ngay lần đầu: attempts = 1', () => {
  const game = new Game();
  const res = game.answer(Q1, 'A');
  assert.equal(res.correct, true);
  assert.equal(res.attempts, 1);
  assert.equal(res.firstTry, true);
});

test('đã trả lời đúng thì không nhận thêm lựa chọn', () => {
  const game = new Game();
  game.answer(Q1, 'A');
  const res = game.answer(Q1, 'C');
  assert.equal(res.alreadyAnswered, true);
  assert.equal(game.answers[Q1].choice, 'A');
});

test('không ghi trùng một phương án sai hai lần', () => {
  const game = new Game();
  game.answer(Q1, 'D');
  game.answer(Q1, 'D');
  assert.deepEqual(game.wrongTries(Q1), ['D']);
});

test('chơi lại: xoá cả lựa chọn sai lẫn đáp án', () => {
  const game = new Game();
  game.answer(Q1, 'B');
  game.answer(1, 'C');
  game.reset();

  assert.equal(game.isAnswered(Q1), false);
  assert.deepEqual(game.wrongTries(Q1), []);
  assert.equal(game.stats.answered, 0);
  assert.equal(game.stats.score, 0);
});
