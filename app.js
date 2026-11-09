(function () {
  "use strict";
  var EXAM_DATE = "2026-12-10";
  var DAILY_COUNT = 25;
  var TOPICS = {
    b: "基礎知識（学科）", p: "課題1 作業工程", d: "課題2 作業中の危険", g: "課題3 服装と保護具",
    m: "課題4 寸法の検査", c: "課題5 作業前点検", s: "課題6 鋸入れ・欠点", e: "課題7 異常時の対応", r: "試験のルール"
  };
  var app = document.getElementById("app");

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = hashStr(String(seed)); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function dayNum(s) { var p = s.split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var Q = window.QUESTIONS.map(function (q) { q.id = "q" + hashStr(q.t + "|" + q.q).toString(36); return q; });
  var BYID = {}; Q.forEach(function (q) { BYID[q.id] = q; });

  // ---------- storage ----------
  function history() { return load("moku_history", []); }
  function missed() { return load("moku_missed", {}); }
  function topicStats() { return load("moku_topics", {}); }
  function streak() {
    var days = {}; history().forEach(function (h) { days[h.date] = 1; });
    var n = dayNum(today()); if (!days[today()]) n -= 1;
    var s = 0;
    while (true) { var d = new Date(n * 86400000); var key = d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); if (days[key]) { s++; n--; } else break; }
    return s;
  }

  // ---------- quiz building ----------
  function prepare(list, seed) {
    var r = rng(seed + "|order");
    return list.map(function (q) {
      var item = { q: q, choices: null, correct: null, pick: null };
      if (q.k === "tf") { item.choices = ["○", "×"]; item.correct = q.a ? 0 : 1; }
      else {
        var idx = shuffle(q.c.map(function (_, i) { return i; }), r);
        item.choices = idx.map(function (i) { return q.c[i]; });
        item.correct = idx.indexOf(0);
      }
      return item;
    });
  }
  function dailySet(date) {
    var r = rng("daily|" + date);
    var picked = [], used = {};
    ["b", "p", "d", "g", "m", "c", "s", "e"].forEach(function (t) {
      shuffle(Q.filter(function (q) { return q.t === t; }), r).slice(0, 2).forEach(function (q) { picked.push(q); used[q.id] = 1; });
    });
    shuffle(Q.filter(function (q) { return !used[q.id]; }), r).slice(0, DAILY_COUNT - picked.length).forEach(function (q) { picked.push(q); });
    return shuffle(picked, r);
  }
  function buildQuiz(mode, topic) {
    var d = today(), list, title, seed;
    if (mode === "daily") { seed = "daily|" + d; list = dailySet(d); title = "今日のクイズ (" + d + ")"; }
    else if (mode === "random") { seed = "rand|" + Date.now() + Math.random(); list = shuffle(Q, rng(seed)).slice(0, DAILY_COUNT); title = "ランダム (New random set)"; }
    else if (mode === "topic") { seed = "topic|" + topic + "|" + Date.now(); list = shuffle(Q.filter(function (q) { return q.t === topic; }), rng(seed)).slice(0, DAILY_COUNT); title = TOPICS[topic]; }
    else if (mode === "official") { seed = "off|" + d; list = Q.filter(function (q) { return q.o; }); title = "公式サンプル ○×（10問）"; }
    else { seed = "rev|" + Date.now(); var m = missed(); list = shuffle(Q.filter(function (q) { return m[q.id]; }), rng(seed)).slice(0, 30); title = "まちがえた問題の復習 (Review my mistakes)"; }
    return { mode: mode, topic: topic || "", title: title, items: prepare(list, seed), done: false, hints: {} };
  }

  // ---------- state ----------
  var state = { view: "home", quiz: null, card: 0, flipped: false, cardOrder: null };

  function go(view) { state.view = view; render(); window.scrollTo(0, 0); }
  document.getElementById("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return; if (b.getAttribute("data-view") === "quiz" && state.quiz && state.quiz.done) state.quiz = null; go(b.getAttribute("data-view"));
  });

  // ---------- views ----------
  function countdownHtml() {
    var left = dayNum(EXAM_DATE) - dayNum(today());
    var txt = left > 1 ? "試験まで あと <b class='big'>" + left + "</b> 日" : left === 1 ? "試験は <b class='big'>明日</b> です" : left === 0 ? "<b class='big'>今日</b> が試験日です。がんばって！" : "試験日は過ぎました";
    var en = left > 0 ? left + " day" + (left === 1 ? "" : "s") + " until the exam" : left === 0 ? "Exam day. Good luck!" : "The exam date has passed";
    return "<div>" + txt + "</div><div class='muted'>" + en + "</div>";
  }
  function viewHome() {
    var h = history(), d = today();
    var todays = h.filter(function (x) { return x.date === d && x.mode === "daily"; });
    var mcount = Object.keys(missed()).length;
    var s = "<div class='card'><div class='muted'>木材加工技能評価試験（もくざいかこう ぎのう ひょうか しけん）実技 初級</div>" +
      "<h1>試験日 2026年12月10日</h1>" + countdownHtml() + "</div>";
    s += "<div class='card'><h2 style='margin-top:0'>今日のクイズ</h2><p class='muted'>毎日" + DAILY_COUNT + "問。日付で問題が変わります。<br>" + DAILY_COUNT + " questions, a new set every day.</p>";
    if (todays.length) { var last = todays[todays.length - 1]; s += "<p>今日の結果：<b>" + last.score + " / " + last.total + "</b>（もう一度できます）</p>"; }
    s += "<button class='btn primary full' data-act='start' data-mode='daily'>今日のクイズを始める ▶</button>";
    if (mcount) s += "<div style='height:8px'></div><button class='btn full' data-act='start' data-mode='review'>まちがえた問題を復習（" + mcount + "問）</button>";
    s += "</div>";
    s += "<div class='stats'><div class='stat'>連続（れんぞく）<b>" + streak() + " 日</b><span class='muted'>streak</span></div><div class='stat'>クイズ回数<b>" + h.length + "</b><span class='muted'>quizzes done</span></div></div>";
    s += "<div class='card'><h3 style='margin-top:0'>試験のルール</h3><ul class='terms'><li>試験監督者の指示に従う。</li><li>目で確認するときは、指でさして声に出す（指差し確認）。</li><li>課題が終わったら、手を上げて「おわりました」。</li></ul>" +
      "<button class='btn full' data-act='go' data-view='learn'>📘 7つの課題を学ぶ</button></div>";
    app.innerHTML = s;
  }

  function viewLearn() {
    var s = "<h1>学ぶ (Learn)</h1><p class='muted'>タップして開く。Tap a lesson to open it.</p>";
    window.LESSONS.forEach(function (l) {
      s += "<details class='lesson'><summary>" + esc(l.title) + (l.time ? "　<span class='tag'>" + esc(l.time) + "</span>" : "") + "</summary>";
      s += l.ja.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("");
      s += "<p class='hint'>" + esc(l.en) + "</p><h3>大事なことば</h3><ul class='terms'>" +
        l.terms.map(function (t) { return "<li><b>" + esc(t[0]) + "</b> — " + esc(t[1]) + "</li>"; }).join("") + "</ul>";
      var tq = Q.filter(function (q) { return q.t === l.id; }).length;
      if (tq) s += "<p><button class='btn full' data-act='start' data-mode='topic' data-topic='" + l.id + "'>この課題の問題を解く（" + tq + "問から）</button></p>";
      s += "</details>";
    });
    s += "<p class='muted'>合格点・許容差などの数字は、公式の資料や職場で確認してください。Check passing scores and tolerances in the official materials or at your workplace.</p>";
    app.innerHTML = s;
  }

  function viewWords() {
    var V = window.VOCAB;
    if (!state.cardOrder) state.cardOrder = V.map(function (_, i) { return i; });
    var v = V[state.cardOrder[state.card]];
    var s = "<h1>単語カード (Flashcards)</h1><p class='muted'>カードをタップしてうら返す。Tap the card to flip. " + (state.card + 1) + " / " + V.length + "</p>";
    s += "<div class='card flash' data-act='flip'>" + (state.flipped
      ? "<div class='r'>" + esc(v[1]) + "</div><div class='e'>" + esc(v[2]) + "</div>"
      : "<div class='k'>" + esc(v[0]) + "</div><div class='muted'>読み方は？ Reading?</div>") + "</div>";
    s += "<div class='row'><button class='btn' style='flex:1' data-act='prev'>◀ 前</button><button class='btn primary' style='flex:1' data-act='next'>次 ▶</button></div>";
    s += "<div style='height:8px'></div><button class='btn full' data-act='shufflecards'>🔀 シャッフル</button>";
    s += "<h2>一覧 (Word list)</h2><div class='card'><ul class='terms'>" + V.map(function (x) { return "<li><b>" + esc(x[0]) + "</b>（" + esc(x[1]) + "）— " + esc(x[2]) + "</li>"; }).join("") + "</ul></div>";
    app.innerHTML = s;
  }

  function viewQuizMenu() {
    var mcount = Object.keys(missed()).length;
    var s = "<h1>クイズ (Quiz)</h1>";
    s += "<div class='card'><button class='btn primary full' data-act='start' data-mode='daily'>今日のクイズ（" + DAILY_COUNT + "問）</button><p class='muted'>Today's set, same all day, changes tomorrow.</p>";
    s += "<button class='btn full' data-act='start' data-mode='random'>🔀 新しいランダム問題 (New random set)</button><div style='height:8px'></div>";
    s += "<button class='btn full' data-act='start' data-mode='official'>公式サンプル ○×（10問）</button><div style='height:8px'></div>";
    s += "<button class='btn full' data-act='start' data-mode='review'" + (mcount ? "" : " disabled") + ">まちがえた問題を復習（" + mcount + "問）</button></div>";
    s += "<div class='card'><h3 style='margin-top:0'>テーマで選ぶ (Topic filter)</h3><select id='topicSel'>" +
      Object.keys(TOPICS).map(function (t) { return "<option value='" + t + "'>" + esc(TOPICS[t]) + "（" + Q.filter(function (q) { return q.t === t; }).length + "問）</option>"; }).join("") +
      "</select><div style='height:8px'></div><button class='btn full' data-act='starttopic'>このテーマで始める</button></div>";
    s += "<p class='muted'>問題数：全" + Q.length + "問（公式サンプル10問 + 練習問題" + (Q.length - 10) + "問）。練習問題は本番の問題ではありません。Practice questions are not real exam questions.</p>";
    app.innerHTML = s;
  }

  function choiceLabel(it, i) { return it.q.k === "tf" ? it.choices[i] : String.fromCharCode(65 + i) + ". " + it.choices[i]; }
  function badge(q) { return q.o ? "<span class='tag off'>公式サンプル</span>" : "<span class='tag'>練習問題 (practice, not real exam questions)</span>"; }

  function viewQuizRun() {
    var z = state.quiz, n = z.items.length;
    var answered = z.items.filter(function (it) { return it.pick !== null; }).length;
    var s = "<div class='bar'><div class='row' style='justify-content:space-between'><b>" + esc(z.title) + "</b><span>" + answered + " / " + n + "</span></div><div class='prog'><i style='width:" + (100 * answered / n) + "%'></i></div></div>";
    z.items.forEach(function (it, qi) {
      var q = it.q;
      s += "<div class='card' id='qc" + qi + "'><div>" + badge(q) + "<span class='tag'>" + esc(TOPICS[q.t]) + "</span></div>";
      s += "<div class='q'>Q" + (qi + 1) + ". " + esc(q.q) + "</div>";
      s += z.hints[qi] ? "<div class='hint'>" + esc(q.h) + "</div><button class='link' data-act='hint' data-i='" + qi + "'>英語を隠す (hide)</button>"
        : "<button class='link' data-act='hint' data-i='" + qi + "'>English hint</button>";
      s += "<div class='choices" + (q.k === "tf" ? " tf" : "") + "'>";
      it.choices.forEach(function (c, ci) {
        s += "<button class='choice" + (it.pick === ci ? " sel" : "") + "' data-act='pick' data-i='" + qi + "' data-c='" + ci + "'>" + esc(choiceLabel(it, ci)) + "</button>";
      });
      s += "</div></div>";
    });
    s += "<button class='btn primary full' data-act='finish'>おわりました ✋ 答え合わせ (Finish)</button>";
    s += answered < n ? "<p class='muted'>まだ " + (n - answered) + " 問 答えていません。" + (n - answered) + " unanswered.</p>" : "";
    s += "<button class='btn full' data-act='quit'>やめる (Quit)</button>";
    app.innerHTML = s;
  }

  function finishQuiz() {
    var z = state.quiz; z.done = true;
    var score = 0, m = missed(), ts = topicStats();
    z.items.forEach(function (it) {
      var ok = it.pick === it.correct; if (ok) score++;
      var t = ts[it.q.t] || [0, 0]; t[1]++; if (ok) t[0]++; ts[it.q.t] = t;
      if (ok) delete m[it.q.id]; else m[it.q.id] = (m[it.q.id] || 0) + 1;
    });
    z.score = score;
    save("moku_missed", m); save("moku_topics", ts);
    var h = history(); h.push({ date: today(), mode: z.mode, title: z.title, score: score, total: z.items.length, ts: Date.now() });
    if (h.length > 500) h = h.slice(h.length - 500);
    save("moku_history", h);
    render(); window.scrollTo(0, 0);
  }

  function viewResults() {
    var z = state.quiz, n = z.items.length, pct = Math.round(100 * z.score / n);
    var s = "<div class='card'><div class='muted'>" + esc(z.title) + "</div><div class='big'>" + z.score + " / " + n + "</div><div>" + pct + "% 正解 (correct)</div>" +
      "<p class='muted'>まちがえた問題は赤で表示。「復習」に保存しました。Mistakes are in red and saved for review.</p>" +
      "<div class='row'><button class='btn primary' style='flex:1' data-act='start' data-mode='review'>まちがいを復習</button><button class='btn' style='flex:1' data-act='go' data-view='quiz'>クイズ メニュー</button></div></div>";
    z.items.forEach(function (it, qi) {
      var q = it.q, ok = it.pick === it.correct;
      s += "<div class='card res " + (ok ? "ok" : "ng") + "'><div>" + badge(q) + "<span class='tag'>" + esc(TOPICS[q.t]) + "</span></div>";
      s += "<div class='q'>Q" + (qi + 1) + ". " + esc(q.q) + "</div><div class='hint'>" + esc(q.h) + "</div>";
      s += "<div>" + (ok ? "<span class='okt'>✔ 正解</span>" : "<span class='ngt'>✘ まちがい</span>") + "</div>";
      s += "<div>あなたの答え：" + (it.pick === null ? "（なし / none）" : esc(choiceLabel(it, it.pick))) + "</div>";
      s += "<div>正しい答え：<b>" + esc(choiceLabel(it, it.correct)) + "</b></div>";
      s += "<div class='exp'>" + esc(q.e) + "<div class='muted'>" + esc(q.ee) + "</div></div></div>";
    });
    s += "<button class='btn full' data-act='go' data-view='home'>ホームへ</button>";
    app.innerHTML = s;
  }

  function viewProgress() {
    var h = history(), ts = topicStats();
    var days = {}; h.forEach(function (x) { days[x.date] = 1; });
    var total = 0, correct = 0; h.forEach(function (x) { total += x.total; correct += x.score; });
    var s = "<h1>記録 (Progress)</h1><p class='muted'>この記録はこの端末のブラウザだけに保存されます。Saved only in this browser on this phone.</p>";
    s += "<div class='stats'><div class='stat'>連続<b>" + streak() + " 日</b><span class='muted'>streak</span></div><div class='stat'>勉強した日<b>" + Object.keys(days).length + "</b><span class='muted'>days studied</span></div>" +
      "<div class='stat'>クイズ回数<b>" + h.length + "</b><span class='muted'>quizzes</span></div><div class='stat'>正解率<b>" + (total ? Math.round(100 * correct / total) : 0) + "%</b><span class='muted'>accuracy</span></div></div>";
    var last = h.slice(-10);
    if (last.length) {
      s += "<div class='card'><h3 style='margin-top:0'>最近の点数 (last " + last.length + ")</h3><div class='chart'>" +
        last.map(function (x) { var p = Math.round(100 * x.score / x.total); return "<div style='height:" + Math.max(p, 2) + "%'><span>" + p + "</span></div>"; }).join("") + "</div>";
      s += "<ul class='terms'>" + h.slice(-10).reverse().map(function (x) { return "<li>" + esc(x.date) + "　" + esc(x.title) + "　<b>" + x.score + "/" + x.total + "</b></li>"; }).join("") + "</ul></div>";
    }
    var tk = Object.keys(TOPICS).filter(function (t) { return ts[t]; });
    if (tk.length) {
      s += "<div class='card'><h3 style='margin-top:0'>テーマ別の正解率 (by topic)</h3>";
      tk.forEach(function (t) { var p = Math.round(100 * ts[t][0] / ts[t][1]); s += "<div>" + esc(TOPICS[t]) + "　<b>" + p + "%</b> <span class='muted'>(" + ts[t][0] + "/" + ts[t][1] + ")</span></div><div class='tbar'><i style='width:" + p + "%'></i></div>"; });
      s += "</div>";
    }
    var m = missed(), mk = Object.keys(m).filter(function (id) { return BYID[id]; });
    if (mk.length) {
      s += "<div class='card'><h3 style='margin-top:0'>まちがえた問題（" + mk.length + "）</h3><ul class='terms'>" +
        mk.map(function (id) { return "<li>" + esc(BYID[id].q) + " <span class='muted'>×" + m[id] + "</span></li>"; }).join("") +
        "</ul><button class='btn primary full' data-act='start' data-mode='review'>復習する (Review my mistakes)</button></div>";
    }
    if (!h.length) s += "<div class='card'>まだ記録がありません。今日のクイズから始めましょう。<br><span class='muted'>Finish a quiz to see your progress here.</span><div style='height:8px'></div><button class='btn primary full' data-act='start' data-mode='daily'>今日のクイズ</button></div>";
    else s += "<button class='btn full' data-act='reset'>記録を消す (Reset data)</button>";
    app.innerHTML = s;
  }

  function render() {
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.getAttribute("data-view") === state.view); });
    if (state.view === "home") viewHome();
    else if (state.view === "learn") viewLearn();
    else if (state.view === "words") viewWords();
    else if (state.view === "quiz") { if (state.quiz && !state.quiz.done) viewQuizRun(); else if (state.quiz && state.quiz.done) viewResults(); else viewQuizMenu(); }
    else viewProgress();
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "go") { if (b.getAttribute("data-view") === "quiz") state.quiz = null; go(b.getAttribute("data-view")); }
    else if (act === "start") {
      var mode = b.getAttribute("data-mode");
      if (mode === "review" && !Object.keys(missed()).length) { alert("まちがえた問題はありません！ No mistakes to review."); return; }
      state.quiz = buildQuiz(mode, b.getAttribute("data-topic")); go("quiz");
    }
    else if (act === "starttopic") { state.quiz = buildQuiz("topic", document.getElementById("topicSel").value); go("quiz"); }
    else if (act === "pick") {
      var it = state.quiz.items[+b.getAttribute("data-i")]; it.pick = +b.getAttribute("data-c");
      var y = window.scrollY; render(); window.scrollTo(0, y);
    }
    else if (act === "hint") { var i = +b.getAttribute("data-i"); state.quiz.hints[i] = !state.quiz.hints[i]; var y2 = window.scrollY; render(); window.scrollTo(0, y2); }
    else if (act === "finish") {
      var un = state.quiz.items.filter(function (it) { return it.pick === null; }).length;
      if (un && !confirm(un + " 問 答えていません。終わりますか？\n" + un + " unanswered. Finish anyway?")) return;
      finishQuiz();
    }
    else if (act === "quit") { if (confirm("やめますか？ Quit this quiz?")) { state.quiz = null; render(); window.scrollTo(0, 0); } }
    else if (act === "flip") { state.flipped = !state.flipped; render(); }
    else if (act === "next") { state.card = (state.card + 1) % window.VOCAB.length; state.flipped = false; render(); }
    else if (act === "prev") { state.card = (state.card - 1 + window.VOCAB.length) % window.VOCAB.length; state.flipped = false; render(); }
    else if (act === "shufflecards") { state.cardOrder = shuffle(window.VOCAB.map(function (_, i) { return i; }), rng(Date.now())); state.card = 0; state.flipped = false; render(); }
    else if (act === "reset") { if (confirm("記録をすべて消しますか？ Delete all saved progress?")) { ["moku_history", "moku_missed", "moku_topics"].forEach(function (k) { localStorage.removeItem(k); }); render(); } }
  });

  render();
})();
