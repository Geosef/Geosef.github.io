/**
 * GGC Outdoor League - Apps Script Web App
 *
 * Deploy settings:
 *   Execute as: Me (sheet owner)
 *   Who has access: Anyone
 *
 * Routes:
 *   ?action=leaderboard          season standings
 *   ?action=monthly&month=April  one month's standings
 *   ?action=scoringLog           full scoring log (all players, all rounds)
 *   ?action=handicapIndex        all players' handicap history
 *
 * Total Points sheet layout (row 3 = headers, data starts row 4):
 *   Col A (0): Rank
 *   Col B (1): Player Name
 *   Col C (2): April Points
 *   Col D (3): May Points
 *   Col E (4): June Points
 *   Col F (5): The Open (Major)
 *   Col G (6): July Points
 *   Col H (7): Captains Cup (Major)
 *   Col I (8): Adjustment for Top 20
 *   Col J (9): August Points
 *   Col K (10): Total Points
 *
 * Monthly Points sheets layout (row 4 = first data row):
 *   Col A (0): Rank
 *   Col B (1): Player Name
 *   Col D (3): +/- from Best 2 Rounds
 *   Col G (6): Points
 *
 * Scoring Log 2026 layout (row 1 = headers, data starts row 2):
 *   Col A (0):  Timestamp
 *   Col B (1):  Player
 *   Col C (2):  Course - Tees
 *   Col D (3):  Front/Back
 *   Col E (4):  Month (text from form, e.g. "April")
 *   Col F (5):  Day
 *   Col G (6):  Score (raw)
 *   Col H (7):  Playing Partner
 *   Col I (8):  Date Played (date cell)
 *   Col J (9):  Playing Handicap
 *   Col K (10): Net Score
 *   Col L (11): Course Par
 *   Col M (12): Plus-Minus (net - par)
 *   Col N (13): Month Played (stored as month number, e.g. 4)
 *   Col O (14): Month Logged
 *   Col P (15): Red Flag (exclude if "Flagged")
 *   Col Q (16): Monthly Count
 *
 * Handicap Index Log layout:
 *   Row 1: "Handicap Index Documentation" (title, skip)
 *   Row 2: empty (skip)
 *   Row 3: "Date Pulled:", date, description (skip)
 *   Row 4: headers — Col A: "Player", Col B: "Current", Col C+: dates (M/D format)
 *   Row 5+: player data
 */

// --- Config ---

var SPREADSHEET_ID = "1PATbhSmfKVcHa3ffxiqicTidGhV0g2JN18NkhCcq5xc";

var CACHE_TTL_LEADERBOARD = 900; // 15 min
var CACHE_TTL_MONTHLY = 1800; // 30 min
var CACHE_TTL_SCORING_LOG = 900; // 15 min (same cadence as leaderboard)
var CACHE_TTL_HANDICAP = 3600; // 60 min (pulled weekly)
var CACHE_TTL_COURSES = 3600; // 60 min (course list / info changes rarely)

var TOTAL_POINTS_SHEET = "Total Points";
var SCORING_LOG_SHEET = "Scoring Log 2026";
var HANDICAP_INDEX_SHEET = "Handicap Index Log";
var PLAYING_HANDICAPS_SHEET = "Playing Handicaps";
var COURSE_INFO_SHEET = "Course Info";

// 9-hole courses — these collapse front/back into a single entry
var NINE_HOLE_COURSES = ["Ballwin"];
var DATA_START_ROW = 3; // 0-based index; row 4 in sheet

var COL_RANK = 0;
var COL_NAME = 1;
var COL_TOTAL = 10;

// Columns that represent actual scoring events (excludes col 8: Adjustment)
var MONTHLY_COLS = [2, 3, 4, 5, 6, 7, 9];

var MONTHLY_SHEETS = {
  April: "April Points",
  May: "May Points",
  June: "June Points",
  July: "July Points",
  August: "August Points",
};

var MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// --- Helpers ---

/**
 * Convert a sheet value (Date object, serial number, or string) to "yyyy-MM-dd".
 * Google Sheets date cells come through getValues() as JS Date objects.
 * If somehow stored as a serial number, we convert from the Sheets epoch.
 */
function toDateStr(val) {
  if (!val || val === "") return "";
  var d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number") {
    // Sheets serial: days since Dec 30 1899 (with Lotus leap-year bug baked in)
    d = new Date((val - 25569) * 86400000);
  } else {
    return String(val).trim();
  }
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * Convert a month number (4) or text ("April") to a full month name ("April").
 * Pass-through for special event names like "The Open".
 */
function toMonthName(val) {
  var n = parseInt(val);
  if (!isNaN(n) && n >= 1 && n <= 12) return MONTH_NAMES[n];
  return String(val).trim();
}

// --- Entry point ---

function doGet(e) {
  var action =
    e && e.parameter && e.parameter.action ? e.parameter.action : "leaderboard";

  var result;
  if (action === "leaderboard") {
    result = getLeaderboard();
  } else if (action === "monthly") {
    var month = e.parameter && e.parameter.month ? e.parameter.month : "";
    result = getMonthly(month);
  } else if (action === "scoringLog") {
    result = getScoringLog();
  } else if (action === "handicapIndex") {
    result = getHandicapIndex();
  } else if (action === "courses") {
    result = getCourses();
  } else if (action === "courseInfo") {
    result = getCourseInfo();
  } else {
    result = { error: "Unknown action: " + action };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// --- Season leaderboard ---

function getLeaderboard() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("leaderboard");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(TOTAL_POINTS_SHEET);
  var rows = sheet.getDataRange().getValues();

  var standings = [];
  for (var i = DATA_START_ROW; i < rows.length; i++) {
    var row = rows[i];
    var name = String(row[COL_NAME]).trim();
    if (!name) continue;

    var rank = parseInt(row[COL_RANK], 10) || standings.length + 1;
    var totalPoints = parseFloat(row[COL_TOTAL]) || 0;

    var events = 0;
    for (var c = 0; c < MONTHLY_COLS.length; c++) {
      var pts = parseFloat(row[MONTHLY_COLS[c]]);
      if (!isNaN(pts) && pts > 0) events++;
    }

    standings.push({
      rank: rank,
      name: name,
      points: totalPoints,
      events: events,
      monthly: {
        april: parseFloat(row[2]) || 0,
        may: parseFloat(row[3]) || 0,
        june: parseFloat(row[4]) || 0,
        theOpen: parseFloat(row[5]) || 0,
        july: parseFloat(row[6]) || 0,
        captainsCup: parseFloat(row[7]) || 0,
        august: parseFloat(row[9]) || 0,
      },
    });
  }

  // Mark ties
  for (var j = 0; j < standings.length; j++) {
    var prev = j > 0 && standings[j - 1].points === standings[j].points;
    var next =
      j < standings.length - 1 &&
      standings[j + 1].points === standings[j].points;
    standings[j].isTied = prev || next;
    if (prev) standings[j].rank = standings[j - 1].rank;
  }

  var result = {
    standings: standings,
    lastUpdated: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "MMM d, h:mm a",
    ),
  };
  cache.put("leaderboard", JSON.stringify(result), CACHE_TTL_LEADERBOARD);
  return result;
}

// --- Monthly standings ---

function getMonthly(month) {
  var cacheKey = "monthly_" + month;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var sheetName = MONTHLY_SHEETS[month];
  if (!sheetName) return { error: "Unknown month: " + month };

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found: " + sheetName };

  var rows = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 3; i < rows.length; i++) {
    var name = String(rows[i][1]).trim();
    if (!name) continue;

    var rank = parseInt(rows[i][0], 10) || result.length + 1;
    var pmRaw = String(rows[i][3]).trim();
    var plusMinus =
      pmRaw === "N/A" || pmRaw === "" ? null : parseFloat(pmRaw) || 0;
    var points = parseFloat(rows[i][6]) || 0;

    result.push({
      rank: rank,
      name: name,
      plusMinus: plusMinus,
      points: points,
    });
  }

  // Mark ties
  for (var j = 0; j < result.length; j++) {
    var prev = j > 0 && result[j - 1].points === result[j].points;
    var next =
      j < result.length - 1 && result[j + 1].points === result[j].points;
    result[j].isTied = prev || next;
    if (prev) result[j].rank = result[j - 1].rank;
  }

  var response = { month: month, standings: result };
  cache.put(cacheKey, JSON.stringify(response), CACHE_TTL_MONTHLY);
  return response;
}

// --- Full scoring log (all players) ---

function getScoringLog() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("scoringLog");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SCORING_LOG_SHEET);
  var rows = sheet.getDataRange().getValues();

  var rounds = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var player = String(row[1]).trim();
    if (!player) continue;
    if (String(row[15]).trim() === "Flagged") continue;

    var courseAndTees = String(row[2]).trim();
    var sepIdx = courseAndTees.lastIndexOf(" - ");
    var course =
      sepIdx >= 0 ? courseAndTees.substring(0, sepIdx).trim() : courseAndTees;
    var tees = sepIdx >= 0 ? courseAndTees.substring(sepIdx + 3).trim() : "";

    rounds.push({
      player: player,
      course: course,
      tees: tees,
      frontBack: String(row[3]).trim(),
      month: String(row[4]).trim(),
      day: String(row[5]).trim(),
      score: parseInt(row[6]) || 0,
      partner: String(row[7]).trim(),
      datePlayed: toDateStr(row[8]),
      playingHandicap: parseFloat(row[9]) || 0,
      netScore: parseFloat(row[10]) || 0,
      coursePar: parseInt(row[11]) || 0,
      plusMinus: parseFloat(row[12]) || 0,
      monthPlayed: toMonthName(row[13]),
      monthlyCount: parseInt(row[16]) || 0,
    });
  }

  var result = { rounds: rounds };
  // CacheService limit is 100KB per entry; large logs may exceed it — serve uncached if so
  try {
    cache.put("scoringLog", JSON.stringify(result), CACHE_TTL_SCORING_LOG);
  } catch (e) {}
  return result;
}

// --- Canonical course list (from Playing Handicaps sheet) ---

/**
 * Reads Playing Handicaps sheet to build the canonical course variant list.
 * Row 7 (index 6) = column headers: "Player | Current | Course - Tees - Front | ..."
 * Row 2 (index 1) = par values; Row 3 (index 2) = slope values (course cols start at index 2).
 * Header format: "Course - Tees - Front" or "Course - Tees - Back".
 * 9-hole courses (NINE_HOLE_COURSES) are collapsed to a single entry (no front/back).
 */
function getCourses() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("courses");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PLAYING_HANDICAPS_SHEET);
  if (!sheet) return { courses: [] };

  // Row 7 (index 6) = "Player | Current | course/tee names..."
  // Row 2 (index 1) = Par values
  // Row 3 (index 2) = Slope values
  // Row 4 (index 3) = Rating values
  var maxCols = Math.min(sheet.getLastColumn(), 110);
  var data = sheet.getRange(1, 1, 7, maxCols).getValues();

  var headerRow = data[6]; // row 7: course/tee column names
  var parRow    = data[1]; // row 2: par
  var slopeRow  = data[2]; // row 3: slope
  var ratingRow = data[3]; // row 4: rating

  var courses = [];

  // Course columns start at index 2 (cols 0-1 are "Player" and "Current")
  for (var c = 2; c < headerRow.length; c++) {
    var header = String(headerRow[c]).trim();
    if (!header) continue;

    // Header format: "Course Name - Tee Color - Front/Back"
    //           or:  "Course Name - Tee Color"  (9-hole)
    var parts = header.split(" - ");
    var courseName = parts[0].trim();
    var tees = parts.length >= 2 ? parts[1].trim() : "";

    var isNineHole = NINE_HOLE_COURSES.indexOf(courseName) >= 0;
    var frontBack = (!isNineHole && parts.length >= 3) ? parts[parts.length - 1].trim() : "";

    var par    = parseInt(parRow[c])    || 0;
    var slope  = parseInt(slopeRow[c])  || 0;
    var rating = parseFloat(ratingRow[c]) || 0;

    courses.push({
      name: courseName,
      frontBack: frontBack,
      tees: tees,
      par: par,
      slope: slope,
      rating: rating,
    });
  }

  var result = { courses: courses };
  try {
    cache.put("courses", JSON.stringify(result), CACHE_TTL_COURSES);
  } catch (e) {}
  return result;
}

// --- Course info metadata ---

/**
 * Reads the "Course Info" sheet for static course metadata (address, phone, etc.).
 * Row 1 = headers, data starts row 2.
 * Cols: A=Course Name, B=Full Name, C=Address, D=Phone, E=Tee Times URL, F=Architect, G=Year Built
 */
function getCourseInfo() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("courseInfo");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(COURSE_INFO_SHEET);
  if (!sheet) return { courses: [] };

  var rows = sheet.getDataRange().getValues();
  var courses = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var name = String(row[0]).trim();
    if (!name) continue;
    courses.push({
      name: name,
      fullName: String(row[1]).trim(),
      address: String(row[2]).trim(),
      phone: String(row[3]).trim(),
      teeTimesUrl: String(row[4]).trim(),
      architect: String(row[5]).trim(),
      yearBuilt: String(row[6]).trim(),
    });
  }

  var result = { courses: courses };
  try {
    cache.put("courseInfo", JSON.stringify(result), CACHE_TTL_COURSES);
  } catch (e) {}
  return result;
}

// --- Full handicap index (all players) ---

function getHandicapIndex() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("handicapIndex");
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(HANDICAP_INDEX_SHEET);
  var maxCols = Math.min(sheet.getLastColumn(), 252);
  var maxRows = sheet.getLastRow();
  var data = sheet.getRange(1, 1, maxRows, maxCols).getValues();

  // Row 4 (index 3) = headers: Player | Current | <date> | <date> | ...
  // Row 5+ (index 4+) = player data
  var headers = data[3];

  var players = [];
  for (var r = 4; r < data.length; r++) {
    var playerName = String(data[r][0]).trim();
    if (!playerName) continue;

    // Col B (index 1) = current handicap; may be #N/A for players without GHIN
    var currentRaw = data[r][1];
    var current = null;
    if (currentRaw !== "" && currentRaw !== null && currentRaw !== undefined) {
      var parsed = parseFloat(currentRaw);
      if (!isNaN(parsed)) current = parsed;
    }

    var history = [];
    for (var c = 2; c < headers.length; c++) {
      var dateVal = headers[c];
      var hcapVal = data[r][c];
      if (
        !dateVal ||
        hcapVal === "" ||
        hcapVal === null ||
        hcapVal === undefined
      )
        continue;
      var hcapNum = parseFloat(hcapVal);
      if (isNaN(hcapNum)) continue;
      history.push({ date: toDateStr(dateVal), index: hcapNum });
    }

    players.push({ player: playerName, current: current, history: history });
  }

  var result = { players: players };
  try {
    cache.put("handicapIndex", JSON.stringify(result), CACHE_TTL_HANDICAP);
  } catch (e) {}
  return result;
}
