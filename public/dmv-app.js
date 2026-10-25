/**
 * Virginia DMV Mastery & Study Guide
 * Complete offline-first learning system
 */

(function () {
  'use strict';

  // --- STATE MANAGEMENT ---
  const STORAGE_KEY = 'VA_DMV_MASTERY_STATE_V1';

  const defaultState = {
    dailyGoal: 15,
    todayCompleted: 0,
    lastActiveDate: null,
    streak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    mistakeBank: {}, // questionId -> { count: number, consecutiveCorrect: number }
    bookmarks: [], // array of questionIds
    categoryStats: {}, // category -> { total: number, correct: number }
    activeManualSection: '1.1',
    soundEnabled: true
  };

  let state = loadState();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.warn('Could not parse saved state:', e);
    }
    return { ...defaultState };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not persist state:', e);
    }
  }

  // Check and update daily streak
  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastActiveDate) {
      state.lastActiveDate = today;
      state.streak = 1;
      state.todayCompleted = 0;
    } else if (state.lastActiveDate !== today) {
      const last = new Date(state.lastActiveDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        state.streak += 1;
      } else if (diffDays > 1) {
        state.streak = 1;
      }
      state.lastActiveDate = today;
      state.todayCompleted = 0;
    }
    saveState();
  }

  updateStreak();

  // --- AUDIO SYNTHESIS (Web Audio API) ---
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function playTone(type) {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'correct') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'incorrect') {
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.setValueAtTime(196, now + 0.1); // G3
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'click') {
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  // --- DATA ACCESS ---
  const data = window.DMV_DATA || { tboc: {}, sections: [], quizzes: [] };
  const allQuizzes = data.quizzes || [];
  const allSections = data.sections || [];
  const tboc = data.tboc || {};

  // Group sections by main section ID
  const sectionGroups = [
    { id: '1', title: '1. About DMV Testing' },
    { id: '2', title: '2. Signals, Signs & Markings' },
    { id: '3', title: '3. Safe Driving' },
    { id: '4', title: '4. Seat Belts & Air Bags' },
    { id: '5', title: '5. Penalties' },
    { id: '6', title: '6. License Types' },
    { id: '7', title: '7. Other Information' }
  ];

  // --- QUIZ RUNNER STATE ---
  let activeQuizMode = 'daily'; // 'daily' | 'section' | 'exam' | 'mistakes' | 'flashcards'
  let currentQuestions = [];
  let currentIndex = 0;
  let currentScore = 0;
  let examPart = 1; // 1: signs (10), 2: general (30)
  let examSignsScore = 0;
  let examGeneralScore = 0;
  let answeredState = false;

  // --- DOM ELEMENTS ---
  const els = {
    streakVal: document.getElementById('streak-val'),
    todayGoalVal: document.getElementById('today-goal-val'),
    masteryVal: document.getElementById('mastery-val'),
    themeToggle: document.getElementById('theme-toggle'),
    navItems: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    // Banner
    bannerGoalText: document.getElementById('banner-goal-text'),
    bannerProgressCircle: document.getElementById('banner-progress-circle'),
    bannerProgressPercent: document.getElementById('banner-progress-percent'),
    btnStartDaily: document.getElementById('btn-start-daily'),
    // Quick Actions
    actionDaily: document.getElementById('action-daily'),
    actionExam: document.getElementById('action-exam'),
    actionFlashcards: document.getElementById('action-flashcards'),
    actionMistakes: document.getElementById('action-mistakes'),
    mistakesCountBadge: document.getElementById('mistakes-count-badge'),
    // Quiz View
    quizContainer: document.getElementById('quiz-view'),
    quizCategoryBadge: document.getElementById('quiz-category-badge'),
    quizProgressIndicator: document.getElementById('quiz-progress-indicator'),
    quizQuestionText: document.getElementById('quiz-question-text'),
    quizImageWrapper: document.getElementById('quiz-image-wrapper'),
    quizImage: document.getElementById('quiz-image'),
    quizAnswersList: document.getElementById('quiz-answers-list'),
    quizFeedbackBox: document.getElementById('quiz-feedback-box'),
    quizFeedbackTitle: document.getElementById('quiz-feedback-title'),
    quizFeedbackText: document.getElementById('quiz-feedback-text'),
    btnNextQuestion: document.getElementById('btn-next-question'),
    btnBookmark: document.getElementById('btn-bookmark-question'),
    btnQuitQuiz: document.getElementById('btn-quit-quiz'),
    // Summary
    quizSummaryView: document.getElementById('quiz-summary-view'),
    summaryTitle: document.getElementById('summary-title'),
    summaryScore: document.getElementById('summary-score'),
    summaryMessage: document.getElementById('summary-message'),
    btnSummaryAction: document.getElementById('btn-summary-action'),
    // Manual
    manualSidebarList: document.getElementById('manual-sidebar-list'),
    manualArticleContent: document.getElementById('manual-article-content'),
    manualQuizBtn: document.getElementById('manual-quiz-btn'),
    // Flashcards
    flashcardContainer: document.getElementById('flashcards-view'),
    flashcardElement: document.getElementById('flashcard'),
    flashcardFrontImg: document.getElementById('flashcard-front-img'),
    flashcardFrontText: document.getElementById('flashcard-front-text'),
    flashcardBackAnswer: document.getElementById('flashcard-back-answer'),
    flashcardBackFeedback: document.getElementById('flashcard-back-feedback'),
    flashcardProgress: document.getElementById('flashcard-progress'),
    btnFlipCard: document.getElementById('btn-flip-card'),
    btnCardKnow: document.getElementById('btn-card-know'),
    btnCardNeedReview: document.getElementById('btn-card-review'),
    // Analytics
    statTotalAnswered: document.getElementById('stat-total-answered'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statDailyStreak: document.getElementById('stat-daily-streak'),
    statMistakesCount: document.getElementById('stat-mistakes-count'),
    categoryStatsList: document.getElementById('category-stats-list'),
    btnResetStats: document.getElementById('btn-reset-stats')
  };

  // --- INITIALIZE UI ---
  function init() {
    renderHeaderStats();
    buildManualSidebar();
    renderManualSection(state.activeManualSection || '1.1');
    setupEventListeners();
    updateTheme(localStorage.getItem('VA_DMV_THEME') || 'light');
    updateMistakesBadge();
  }

  function renderHeaderStats() {
    els.streakVal.textContent = state.streak;
    els.todayGoalVal.textContent = `${state.todayCompleted}/${state.dailyGoal}`;
    
    const accuracy = state.totalAnswered > 0 
      ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
      : 100;
    els.masteryVal.textContent = `${accuracy}%`;

    // Progress circle
    const percent = Math.min(100, Math.round((state.todayCompleted / state.dailyGoal) * 100));
    els.bannerProgressPercent.textContent = `${percent}%`;
    const circumference = 2 * Math.PI * 26; // r=26
    const offset = circumference - (percent / 100) * circumference;
    els.bannerProgressCircle.style.strokeDasharray = `${circumference}`;
    els.bannerProgressCircle.style.strokeDashoffset = `${offset}`;

    els.bannerGoalText.textContent = percent >= 100 
      ? `Goal achieved today (${state.todayCompleted}/${state.dailyGoal} questions)! Keep up the momentum!`
      : `${state.todayCompleted} of ${state.dailyGoal} questions completed today.`;
  }

  function updateMistakesBadge() {
    const mistakes = Object.keys(state.mistakeBank).length;
    if (els.mistakesCountBadge) {
      els.mistakesCountBadge.textContent = mistakes > 0 ? `${mistakes} to review` : '0 items';
    }
  }

  // --- NAVIGATION ---
  function switchTab(tabId) {
    els.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });
    els.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'tab-analytics') {
      renderAnalytics();
    }
  }

  // --- MANUAL READER ---
  function buildManualSidebar() {
    els.manualSidebarList.innerHTML = '';

    sectionGroups.forEach(grp => {
      const groupEl = document.createElement('div');
      groupEl.className = 'manual-section-group';

      const header = document.createElement('div');
      header.className = 'section-group-header';
      header.textContent = grp.title;
      groupEl.appendChild(header);

      const subSections = allSections.filter(s => s.section === grp.id);
      subSections.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'subsection-nav-btn';
        const key = `${sub.section}.${sub.subSectionID}`;
        btn.dataset.key = key;
        btn.textContent = `${key} - ${sub.subSectionTitle}`;
        btn.addEventListener('click', () => {
          renderManualSection(key);
        });
        groupEl.appendChild(btn);
      });

      els.manualSidebarList.appendChild(groupEl);
    });
  }

  function renderManualSection(key) {
    state.activeManualSection = key;
    saveState();

    // Highlight active sidebar item
    document.querySelectorAll('.subsection-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.key === key);
    });

    const [sec, sub] = key.split('.');
    const found = allSections.find(s => s.section === sec && s.subSectionID === sub);

    if (found) {
      els.manualArticleContent.innerHTML = found.copy;

      // Check if there are practice questions for this section
      const count = allQuizzes.filter(q => q.section === sec && q.subsection === sub).length;
      if (count > 0) {
        els.manualQuizBtn.style.display = 'inline-flex';
        els.manualQuizBtn.textContent = `Practice ${count} Questions for This Section`;
        els.manualQuizBtn.onclick = () => {
          startSectionQuiz(sec, sub);
        };
      } else {
        els.manualQuizBtn.style.display = 'none';
      }
    }
  }

  // --- QUIZ ENGINE ---
  function startDailyQuiz() {
    activeQuizMode = 'daily';
    // Select 15 randomized questions, prioritizing unpracticed or mistake questions
    const mistakes = Object.keys(state.mistakeBank).map(id => allQuizzes.find(q => q._id === id)).filter(Boolean);
    const others = allQuizzes.filter(q => !state.mistakeBank[q._id]);
    
    // Shuffle others
    const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
    const combined = [...mistakes.slice(0, 5), ...shuffledOthers].slice(0, state.dailyGoal);
    currentQuestions = combined.sort(() => 0.5 - Math.random());
    
    currentIndex = 0;
    currentScore = 0;
    switchTab('tab-quiz');
    renderQuestion();
  }

  function startSectionQuiz(sec, sub) {
    activeQuizMode = 'section';
    currentQuestions = allQuizzes.filter(q => q.section === sec && q.subsection === sub);
    if (currentQuestions.length === 0) {
      currentQuestions = allQuizzes.filter(q => q.section === sec);
    }
    currentIndex = 0;
    currentScore = 0;
    switchTab('tab-quiz');
    renderQuestion();
  }

  function startExamSimulator() {
    activeQuizMode = 'exam';
    examPart = 1;
    examSignsScore = 0;
    examGeneralScore = 0;

    // Virginia DMV Knowledge Exam Format:
    // Part 1: 10 Traffic Signs questions (category code 'SN')
    // Part 2: 30 General Knowledge questions (must score >= 80% / 24 correct)
    const signsQuestions = allQuizzes.filter(q => q.category && q.category.code === 'SN');
    const shuffledSigns = [...signsQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    currentQuestions = shuffledSigns;
    currentIndex = 0;
    currentScore = 0;
    switchTab('tab-quiz');
    renderQuestion();
  }

  function startMistakesReview() {
    activeQuizMode = 'mistakes';
    const mistakeIds = Object.keys(state.mistakeBank);
    if (mistakeIds.length === 0) {
      alert('Great job! Your mistake bank is empty. Start a daily quiz or exam to practice.');
      return;
    }
    currentQuestions = mistakeIds.map(id => allQuizzes.find(q => q._id === id)).filter(Boolean);
    currentIndex = 0;
    currentScore = 0;
    switchTab('tab-quiz');
    renderQuestion();
  }

  function renderQuestion() {
    answeredState = false;
    els.quizSummaryView.style.display = 'none';
    els.quizContainer.style.display = 'block';
    els.quizFeedbackBox.style.display = 'none';
    els.btnNextQuestion.disabled = true;

    if (currentIndex >= currentQuestions.length) {
      finishQuiz();
      return;
    }

    const q = currentQuestions[currentIndex];

    // Category & Progress Badge
    let modeText = '';
    if (activeQuizMode === 'exam') {
      modeText = `VA DMV EXAM (PART ${examPart}: ${examPart === 1 ? 'TRAFFIC SIGNS' : 'GENERAL KNOWLEDGE'})`;
    } else if (activeQuizMode === 'section') {
      modeText = `SECTION ${q.section}.${q.subsection || '1'} PRACTICE`;
    } else if (activeQuizMode === 'mistakes') {
      modeText = 'MISTAKE REVIEW';
    } else {
      modeText = (q.category && q.category.description) || "VIRGINIA DRIVER'S STUDY GUIDE";
    }
    els.quizCategoryBadge.textContent = modeText;
    els.quizProgressIndicator.textContent = `Question ${currentIndex + 1} of ${currentQuestions.length}`;

    // Question Text
    els.quizQuestionText.textContent = q.question;

    // Image
    if (q.images && q.images.length > 0 && q.images[0]) {
      const imgFile = q.images[0];
      els.quizImage.src = `images/${imgFile}`;
      els.quizImage.onerror = () => {
        els.quizImage.src = `https://transactions.dmv.virginia.gov/dmv-manuals/manuals/images/1/${imgFile}`;
      };
      els.quizImageWrapper.style.display = 'flex';
    } else {
      els.quizImageWrapper.style.display = 'none';
    }

    // Answers List
    els.quizAnswersList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.answers.forEach((ans, idx) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.value = ans.value;
      btn.innerHTML = `
        <span class="answer-letter">${letters[idx] || idx + 1}</span>
        <span>${ans.text}</span>
      `;
      btn.addEventListener('click', () => selectAnswer(ans.value, q));
      els.quizAnswersList.appendChild(btn);
    });

    // Bookmark icon state
    updateBookmarkButton(q._id);
  }

  function selectAnswer(selectedValue, question) {
    if (answeredState) return;
    answeredState = true;

    const isCorrect = String(selectedValue) === String(question.correctAnswer);
    const buttons = els.quizAnswersList.querySelectorAll('.answer-btn');

    buttons.forEach(btn => {
      btn.disabled = true;
      if (String(btn.dataset.value) === String(question.correctAnswer)) {
        btn.classList.add('correct');
      } else if (String(btn.dataset.value) === String(selectedValue)) {
        btn.classList.add('incorrect');
      }
    });

    // Audio & Score tracking
    if (isCorrect) {
      playTone('correct');
      currentScore++;
      state.totalCorrect++;
      if (activeQuizMode === 'exam') {
        if (examPart === 1) examSignsScore++;
        else examGeneralScore++;
      }
      // If in mistake bank, advance consecutive correct
      if (state.mistakeBank[question._id]) {
        state.mistakeBank[question._id].consecutiveCorrect = (state.mistakeBank[question._id].consecutiveCorrect || 0) + 1;
        if (state.mistakeBank[question._id].consecutiveCorrect >= 2) {
          delete state.mistakeBank[question._id];
        }
      }
    } else {
      playTone('incorrect');
      // Add to mistake bank
      if (!state.mistakeBank[question._id]) {
        state.mistakeBank[question._id] = { count: 1, consecutiveCorrect: 0 };
      } else {
        state.mistakeBank[question._id].count++;
        state.mistakeBank[question._id].consecutiveCorrect = 0;
      }
    }

    state.totalAnswered++;
    state.todayCompleted++;
    updateStreak();
    renderHeaderStats();
    updateMistakesBadge();

    // Track category stats
    const catCode = (question.category && question.category.code) || 'GEN';
    if (!state.categoryStats[catCode]) {
      state.categoryStats[catCode] = { total: 0, correct: 0, title: (question.category && question.category.description) || catCode };
    }
    state.categoryStats[catCode].total++;
    if (isCorrect) state.categoryStats[catCode].correct++;
    saveState();

    // Feedback display
    els.quizFeedbackBox.className = `feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;
    els.quizFeedbackTitle.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
    els.quizFeedbackText.textContent = question.feedback || 'Official Virginia DMV Manual rule applied.';
    els.quizFeedbackBox.style.display = 'block';

    els.btnNextQuestion.disabled = false;
  }

  function nextQuestion() {
    playTone('click');
    currentIndex++;
    renderQuestion();
  }

  function finishQuiz() {
    els.quizContainer.style.display = 'none';
    els.quizSummaryView.style.display = 'block';

    const total = currentQuestions.length;
    const pct = total > 0 ? Math.round((currentScore / total) * 100) : 0;

    if (activeQuizMode === 'exam') {
      if (examPart === 1) {
        // Virginia DMV requires 100% on Part 1 (10/10 signs)
        if (examSignsScore === 10) {
          els.summaryTitle.textContent = '🎉 Part 1 Passed (10/10 Signs)!';
          els.summaryScore.textContent = '10 / 10';
          els.summaryMessage.textContent = 'Congratulations! You answered all 10 traffic signs correctly. According to Virginia DMV exam regulations, you are now qualified to proceed to Part 2: General Knowledge (30 questions).';
          els.btnSummaryAction.textContent = 'Proceed to Part 2: General Knowledge';
          els.btnSummaryAction.onclick = () => {
            examPart = 2;
            const nonSigns = allQuizzes.filter(q => !q.category || q.category.code !== 'SN');
            currentQuestions = [...nonSigns].sort(() => 0.5 - Math.random()).slice(0, 30);
            currentIndex = 0;
            currentScore = 0;
            renderQuestion();
          };
          return;
        } else {
          els.summaryTitle.textContent = 'Exam Disqualified (Part 1 - Traffic Signs)';
          els.summaryScore.textContent = `${examSignsScore} / 10`;
          els.summaryMessage.textContent = `You scored ${examSignsScore}/10 on traffic signs. Virginia DMV requires a 100% score (10 out of 10) on Part 1 before you may take Part 2. Use the Sign Flashcards to review!`;
          els.btnSummaryAction.textContent = 'Practice Traffic Signs Flashcards';
          els.btnSummaryAction.onclick = () => {
            startSignFlashcards();
          };
          return;
        }
      } else {
        // Part 2: 30 General Knowledge questions, >= 80% (24/30) to pass
        const passed = examGeneralScore >= 24;
        els.summaryTitle.textContent = passed ? '🏆 OFFICIAL VIRGINIA DMV EXAM PASSED!' : 'Part 2 Not Passed';
        els.summaryScore.textContent = `${examGeneralScore} / 30 (${Math.round((examGeneralScore / 30) * 100)}%)`;
        els.summaryMessage.textContent = passed
          ? `Outstanding! You scored ${examGeneralScore}/30 (Passing score is 24/30 or 80%). With 100% on Signs and ${Math.round((examGeneralScore / 30) * 100)}% on General Knowledge, you are fully prepared for the real Virginia DMV test!`
          : `You scored ${examGeneralScore}/30. Virginia requires at least 80% (24 correct) on Part 2. Review the study manual and missed questions, then try again!`;
        els.btnSummaryAction.textContent = 'Return to Dashboard';
        els.btnSummaryAction.onclick = () => switchTab('tab-dashboard');
        return;
      }
    }

    // Daily or Section Quiz completion
    els.summaryTitle.textContent = pct >= 80 ? '🎉 Great Job!' : 'Session Complete';
    els.summaryScore.textContent = `${currentScore} / ${total} (${pct}%)`;
    els.summaryMessage.textContent = pct >= 80 
      ? `You demonstrated strong mastery of this content! Your daily streak is now ${state.streak} days.`
      : `Good effort! Any missed questions have been saved to your Mistake Bank for targeted practice.`;
    
    els.btnSummaryAction.textContent = 'Return to Dashboard';
    els.btnSummaryAction.onclick = () => switchTab('tab-dashboard');
  }

  // --- BOOKMARKS ---
  function updateBookmarkButton(questionId) {
    const isBookmarked = state.bookmarks.includes(questionId);
    els.btnBookmark.innerHTML = isBookmarked ? '★ Bookmarked' : '☆ Bookmark';
    els.btnBookmark.onclick = () => {
      if (isBookmarked) {
        state.bookmarks = state.bookmarks.filter(id => id !== questionId);
      } else {
        state.bookmarks.push(questionId);
      }
      saveState();
      updateBookmarkButton(questionId);
      playTone('click');
    };
  }

  // --- FLASHCARDS DRILL ---
  let flashcardQuestions = [];
  let flashcardIdx = 0;

  function startSignFlashcards() {
    activeQuizMode = 'flashcards';
    flashcardQuestions = allQuizzes.filter(q => q.category && q.category.code === 'SN' && q.images && q.images.length > 0);
    flashcardQuestions.sort(() => 0.5 - Math.random());
    flashcardIdx = 0;
    switchTab('tab-flashcards');
    renderFlashcard();
  }

  function renderFlashcard() {
    if (flashcardIdx >= flashcardQuestions.length) {
      alert('You have completed all sign flashcards! Outstanding work.');
      switchTab('tab-dashboard');
      return;
    }
    const q = flashcardQuestions[flashcardIdx];
    els.flashcardElement.classList.remove('flipped');

    els.flashcardProgress.textContent = `Sign ${flashcardIdx + 1} of ${flashcardQuestions.length}`;
    const img = q.images[0];
    els.flashcardFrontImg.src = `images/${img}`;
    els.flashcardFrontImg.onerror = () => {
      els.flashcardFrontImg.src = `https://transactions.dmv.virginia.gov/dmv-manuals/manuals/images/1/${img}`;
    };
    els.flashcardFrontText.textContent = q.question;

    const correctAns = q.answers.find(a => String(a.value) === String(q.correctAnswer));
    els.flashcardBackAnswer.textContent = correctAns ? correctAns.text : 'Official Sign Meaning';
    els.flashcardBackFeedback.textContent = q.feedback || '';
  }

  // --- ANALYTICS ---
  function renderAnalytics() {
    els.statTotalAnswered.textContent = state.totalAnswered;
    const acc = state.totalAnswered > 0 ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
    els.statAccuracy.textContent = `${acc}%`;
    els.statDailyStreak.textContent = `${state.streak} Days`;
    els.statMistakesCount.textContent = Object.keys(state.mistakeBank).length;

    els.categoryStatsList.innerHTML = '';
    const categories = Object.entries(state.categoryStats);
    if (categories.length === 0) {
      els.categoryStatsList.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Complete questions in study or exam mode to see category mastery breakdowns.</p>';
      return;
    }

    categories.forEach(([code, c]) => {
      const pct = c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0;
      const row = document.createElement('div');
      row.style.marginBottom = '14px';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:4px;">
          <span>${c.title}</span>
          <span>${pct}% (${c.correct}/${c.total})</span>
        </div>
        <div style="height:8px;background:var(--bg-surface-alt);border-radius:4px;overflow:hidden;border:1px solid var(--border);">
          <div style="width:${pct}%;height:100%;background:${pct >= 80 ? 'var(--success)' : 'var(--accent)'};border-radius:4px;transition:width 0.4s;"></div>
        </div>
      `;
      els.categoryStatsList.appendChild(row);
    });
  }

  // --- THEME ---
  function updateTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('VA_DMV_THEME', theme);
    els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Navigation
    els.navItems.forEach(item => {
      item.addEventListener('click', () => {
        playTone('click');
        switchTab(item.dataset.tab);
      });
    });

    // Theme toggle
    els.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      updateTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Quick Action cards
    els.actionDaily.addEventListener('click', startDailyQuiz);
    els.actionExam.addEventListener('click', startExamSimulator);
    els.actionFlashcards.addEventListener('click', startSignFlashcards);
    els.actionMistakes.addEventListener('click', startMistakesReview);
    els.btnStartDaily.addEventListener('click', startDailyQuiz);

    // Quiz Navigation
    els.btnNextQuestion.addEventListener('click', nextQuestion);
    els.btnQuitQuiz.addEventListener('click', () => {
      if (confirm('Quit active practice session? Progress will be saved.')) {
        switchTab('tab-dashboard');
      }
    });

    // Flashcards controls
    els.btnFlipCard.addEventListener('click', () => {
      playTone('click');
      els.flashcardElement.classList.toggle('flipped');
    });
    els.flashcardElement.addEventListener('click', () => {
      playTone('click');
      els.flashcardElement.classList.toggle('flipped');
    });
    els.btnCardKnow.addEventListener('click', (e) => {
      e.stopPropagation();
      playTone('correct');
      flashcardIdx++;
      renderFlashcard();
    });
    els.btnCardNeedReview.addEventListener('click', (e) => {
      e.stopPropagation();
      playTone('incorrect');
      flashcardIdx++;
      renderFlashcard();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('tab-quiz').classList.contains('active')) {
        if (!answeredState) {
          if (['1', '2', '3', '4'].includes(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            const buttons = els.quizAnswersList.querySelectorAll('.answer-btn');
            if (buttons[idx]) buttons[idx].click();
          }
        } else if (e.key === 'Enter') {
          if (!els.btnNextQuestion.disabled) nextQuestion();
        }
      }
    });

    // Reset Stats
    if (els.btnResetStats) {
      els.btnResetStats.addEventListener('click', () => {
        if (confirm('Reset all progress, streaks, and mistake bank statistics?')) {
          localStorage.removeItem(STORAGE_KEY);
          state = { ...defaultState };
          saveState();
          updateStreak();
          renderHeaderStats();
          updateMistakesBadge();
          renderAnalytics();
          alert('Progress has been reset.');
        }
      });
    }
  }

  // Run initial boot
  init();

})();
