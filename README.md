# Moku 🌲 木材加工 初級 Study & Daily Quiz

A phone-friendly study site for the 木材加工技能評価試験 実技 初級 (exam date: 2026-12-10).

Live: https://hanataha.github.io/moku/

## What's inside
- **ホーム**: exam countdown, today's quiz, streak.
- **学ぶ (Learn)**: lessons for 課題1–7, exam rules, and background (wood species, units, sawmill flow).
- **単語 (Flashcards)**: ~50 exam words, tap to flip.
- **クイズ (Quiz)**: 25 questions per day, chosen by date; new random set; topic filter; official ○× sample; review of mistakes. Score and explanations (Japanese + English) after finishing.
- **記録 (Progress)**: scores, streak, accuracy by topic, missed questions. Saved in the browser's localStorage only.

Questions labeled 「公式サンプル」 are from the official sample sheet. All others are 「練習問題」 (practice), not real exam questions.

## Files
- `index.html`, `style.css`, `app.js`: the site (no build step).
- `questions.js`: the question bank. Add new questions at the end with `TF(...)`, `MC(...)` or `ORD(...)` (see the comment at the top).
- `content.js`: lessons and vocabulary.

Run locally: open `index.html` in a browser, or `python3 -m http.server`.
