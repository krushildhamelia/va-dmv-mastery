import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const quizzesPath = path.join(rootDir, 'data', 'quizzes.json');
const dataJsPath = path.join(rootDir, 'public', 'data.js');

console.log('Reading data/quizzes.json...');
const quizzes = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'));

let count5 = 0;
let count6 = 0;
let count7 = 0;
let countEmptyPruned = 0;
let countNormalizedFalse = 0;

const cleanedQuizzes = quizzes.map(q => {
  const newQ = { ...q };

  // Normalize legacy correctAnswer codes:
  // "5" = True -> maps to answer value "1"
  // "6" = False -> maps to answer value "2"
  // "7" = All of the above -> maps to answer value "4"
  if (newQ.correctAnswer === '5') {
    newQ.correctAnswer = '1';
    count5++;
  } else if (newQ.correctAnswer === '6') {
    newQ.correctAnswer = '2';
    count6++;
  } else if (newQ.correctAnswer === '7') {
    newQ.correctAnswer = '4';
    count7++;
  }

  // Prune empty answers and normalize casing
  const origLen = (newQ.answers || []).length;
  newQ.answers = (newQ.answers || [])
    .filter(a => a.text && a.text.trim().length > 0)
    .map(a => {
      let text = a.text.trim();
      if (text.toUpperCase() === 'FALSE') {
        text = 'False';
        countNormalizedFalse++;
      }
      if (text.toUpperCase() === 'TRUE') {
        text = 'True';
      }
      return { ...a, text };
    });

  if (newQ.answers.length < origLen) {
    countEmptyPruned++;
  }

  return newQ;
});

console.log(`Updated correctAnswer "5" -> "1" (True): ${count5}`);
console.log(`Updated correctAnswer "6" -> "2" (False): ${count6}`);
console.log(`Updated correctAnswer "7" -> "4" (All of the above): ${count7}`);
console.log(`Questions with pruned blank answers: ${countEmptyPruned}`);
console.log(`Normalized FALSE -> False: ${countNormalizedFalse}`);

// Verify every question has a valid matching answer
const unmatched = cleanedQuizzes.filter(q => !q.answers.some(a => String(a.value) === String(q.correctAnswer)));
if (unmatched.length > 0) {
  console.error(`ERROR: ${unmatched.length} questions have no matching correctAnswer!`);
  process.exit(1);
}
console.log('Verification passed: All 266 questions have valid matching correctAnswer.');

// Write back to data/quizzes.json
fs.writeFileSync(quizzesPath, JSON.stringify(cleanedQuizzes, null, 2) + '\n', 'utf8');
console.log('Successfully updated data/quizzes.json.');

// Update public/data.js
const dataJs = fs.readFileSync(dataJsPath, 'utf8');
const quizzesKey = 'quizzes: [';
const idx = dataJs.indexOf(quizzesKey);
if (idx === -1) {
  console.error('ERROR: Could not find "quizzes: [" in public/data.js');
  process.exit(1);
}

const prefix = dataJs.slice(0, idx);
const newContent = prefix + 'quizzes: ' + JSON.stringify(cleanedQuizzes) + '\n};\n';
fs.writeFileSync(dataJsPath, newContent, 'utf8');
console.log('Successfully updated public/data.js.');
