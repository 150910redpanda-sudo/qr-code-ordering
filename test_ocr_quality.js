// Self-contained regression test for the OCR quality gate.
// Extracts isGibberishLine() and parseOcrToMenu() straight out of
// restaurant.html (so this test exercises the actual shipped code,
// not a reimplementation) and runs them against real garbled OCR
// output to confirm a failed scan gets rejected instead of dumping
// junk rows into the menu editor. Run with: node test_ocr_quality.js

const fs = require('fs');
const html = fs.readFileSync('restaurant.html', 'utf8');

function extractFn(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start), bodyStart = i;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}

eval(extractFn('isGibberishLine'));
eval(extractFn('parseOcrToMenu'));

const BAIL_THRESHOLD = 0.45; // keep in sync with readMenuLocal in restaurant.html

function checkBailOut(lines) {
  const gibberishCount = lines.filter(isGibberishLine).length;
  return gibberishCount / lines.length > BAIL_THRESHOLD;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.log('FAIL:', msg); failures++; }
  else console.log('PASS:', msg);
}

// --- Real garbled scan reported by the user ---
const garbageLines = [
  "RS TETE100", "m@ﬁﬁ“.‘", "R ST Bciryeiand ;o", "frendongisie = o",
  "st > 2ol", "Do Repe .0", "LIRS v SR vt", "DS oot o S i eatics @",
  "P e e ool T TR RN it oot o", "Aot it L) > o1 Corine ® o oo",
  "m.@g D G £ e erroom o", "i Peppers, wikd rocket and",
  "Minced Lamd g  \"',.r..- -‘.’.v.».!),~.\\ vl \"-", "Chicken \" n L]",
  "% et 7 QTG it JAcR b o8 gied cO T P o) =",
  "6550 Bonelers chucken cubes .41,\",[1{;5.,1.»'3,\"1“1.(..3, ) giedonurispi o",
  "Rt Lamb 0 ) ! . . ?", "1058 Mixed Gt - — . sewm papw————— :",
  "e s A b SER St S Sy", "f26.59) Sooutsh prime ok ”ﬁ‘m—éﬁwﬁﬁ@iﬂfl h' @>",
  "— s . .niir' & ﬁn : ) . s", "0.5 S s i s S R G ety v e",
  "] Grfied Chicken Burger WIS S I", "] ww“-\" ] -7 mgl ]",
  "Veg BUrger s wammm . o onr SEE U RIUR I B",
  "‘omato, Mozzarella & @ @ Crusty bread with batsamic vinegacisk",
  "gl Avocado salad g Garlkc Bread",
  "Chicken Cesar salad @ zm.) Garic Bread with chieesS]",
  "mumcmaw-q. @ Sweet Potato Frias £5.50",
  "73 4.00) Miced leat, Feta cheese, cherry oma coRU B Onion Rings",
  "@) g @ -Gl @ -conneg @ - Voo"
];
assert(checkBailOut(garbageLines), 'failed/blurry scan triggers the early bail-out (no garbage reaches the review screen)');

// --- A real, clean menu must NOT be rejected ---
const cleanLines = [
  "ANTIPASTI", "zuppa del giorno", "FRESH SOUP OF THE DAY WITH TOASTED BREAD",
  "carbonara", "£16.95", "PENNE PASTA WITH BACON, EGG AND CREAM",
  "On The Grill", "Chicken", "SeaBass", "£19.95", "Minced Lamb", "£10.50",
  "chips", "onion rings", "Veg Burger", "£10.50"
];
assert(!checkBailOut(cleanLines), 'a real, clean menu does NOT trigger the bail-out');
const cleanItems = parseOcrToMenu(cleanLines.join('\n'));
assert(cleanItems.some(it => it.name === 'Chicken'), 'clean menu: "Chicken" survives parsing');
assert(cleanItems.some(it => it.name === 'carbonara' && it.price === 16.95), 'clean menu: "carbonara" keeps its price');
assert(cleanItems.some(it => it.name === 'chips' && it.price === null), 'clean menu: no-price side "chips" is kept, not dropped');

// --- A mildly noisy but mostly-readable scan should still get through ---
const noisyButReadable = [
  "Starters", "Garlic Bread", "£4.50", "FRESH BAKED WITH HERB BUTTER",
  "Soup of the Day", "£5.00", "n",  // one stray junk line mixed in
  "Mains", "Chicken Burger", "£10.95"
];
assert(!checkBailOut(noisyButReadable), 'a mostly-readable scan with one stray junk line is NOT rejected outright');

console.log('');
console.log(failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.');
process.exit(failures === 0 ? 0 : 1);
