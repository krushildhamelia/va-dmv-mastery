# Virginia DMV Driver's Study Guide & Daily Mastery Application

A faithful clone and comprehensive daily learning system reverse-engineered from the official [Virginia DMV Driver's Manual](https://transactions.dmv.virginia.gov/dmv-manuals/#/manual/1/tboc).

---

## 🌟 Key Features

### 1. 📖 Full Official Study Manual (Offline)
* Contains all **7 core chapters** and **21 sub-sections** from the Virginia DMV Driver's Manual.
* High-resolution diagrams, road markings, traffic light states, and illustrations pre-downloaded for zero-latency offline access.
* Instant section-specific practice test button at the end of each reading section.

### 2. 🎯 Daily Practice Workout & Streaks
* **Daily Goal Tracker**: Targets 15 questions each day (customizable).
* **Streak Counter**: Tracks consecutive days studied to reinforce daily habits.
* **Instant Explanations**: Every question includes the official Virginia DMV rationale and illustrated visual aids.
* **Keyboard Navigation**: Press keys `1`–`4` to pick options and `Enter` to advance.

### 3. 🚦 Official Virginia Knowledge Exam Simulator
Mirrors real Virginia DMV testing regulations:
* **Part 1 (Traffic Signs)**: 10 traffic sign questions. **Must score 100% (10/10)** to pass to Part 2 (just like the real DMV test!).
* **Part 2 (General Knowledge)**: 30 questions. Requires **80% (24/30)** to earn a pass certificate.

### 4. 🃏 Traffic Signs Flashcards
* Visual flip cards specifically focusing on Virginia regulatory, warning, and guide signs.
* Immediate "I Know This" vs "Need Review" sorting.

### 5. ❌ Mistake Review Bank
* Any question answered incorrectly in any mode is automatically routed into your Mistake Bank.
* Requires **2 consecutive correct answers** to graduate out of the mistake bank.

### 6. 📊 Progress & Category Mastery
* Real-time metrics tracking total questions attempted, overall accuracy %, and category-by-category mastery bars.

---

## 🚀 Quick Start

### Option A: Launch with Local Web Server
Open terminal in `C:\Users\krush\Documents\va-dmv-mastery` and run:

```bash
npm start
```
Then visit: **http://localhost:3000**

### Option B: Open Directly in Any Browser
You can open `public/index.html` directly in Chrome, Edge, or Firefox by double-clicking it or using:

```powershell
start C:\Users\krush\Documents\va-dmv-mastery\public\index.html
```

---

## 🗂️ Data Provenance & Structure

* **Data Sources**: Extracted from Virginia DMV API endpoints (`/dmvapimanuals/api/manual/tboc`, `/sections`, `/quiz`).
* **Images**: 123 official graphics cached in `public/images/`.
* **State**: Persisted locally in your browser's `localStorage` (`VA_DMV_MASTERY_STATE_V1`).
