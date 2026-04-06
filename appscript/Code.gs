/**
 * GGC Outdoor League - Apps Script Web App
 *
 * Deploy settings:
 *   Execute as: Me (sheet owner)
 *   Who has access: Anyone
 *
 * Routes:
 *   ?action=leaderboard                  season standings
 *   ?action=monthly&month=April          one month's standings
 *   ?action=playerDetail&name=Joe Smith  player round + handicap history
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
 *   Col E (4):  Month
 *   Col F (5):  Day
 *   Col G (6):  Score (raw)
 *   Col H (7):  Playing Partner
 *   Col I (8):  Date Played
 *   Col J (9):  Playing Handicap
 *   Col K (10): Net Score
 *   Col L (11): Course Par
 *   Col M (12): Plus-Minus (net - par)
 *   Col N (13): Month Played
 *   Col O (14): Month Logged
 *   Col P (15): Red Flag (exclude if "Flagged")
 *   Col Q (16): Monthly Count
 */

// --- Config ---

var SPREADSHEET_ID = "1PATbhSmfKVcHa3ffxiqicTidGhV0g2JN18NkhCcq5xc";

// Cache TTLs (seconds). CacheService is script-scoped — shared across all users,
// so the first request after expiry does one sheet read and everyone else gets
// the cached response until the next expiry.
var CACHE_TTL_LEADERBOARD = 900; // 15 min
var CACHE_TTL_MONTHLY = 1800; // 30 min
var CACHE_TTL_PLAYER_DETAIL = 3600; // 60 min

var TOTAL_POINTS_SHEET = "Total Points";
var SCORING_LOG_SHEET = "Scoring Log 2026";
var HANDICAP_INDEX_SHEET = "Handicap Index Log";
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
  } else if (action === "playerDetail") {
    var name = e.parameter && e.parameter.name ? e.parameter.name : "";
    result = getPlayerDetail(name);
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
  if (!sheetName) {
    return {
      error:
        "Unknown month: " + month + ". Valid: April, May, June, July, August",
    };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found: " + sheetName };

  var rows = sheet.getDataRange().getValues();
  var result = [];

  // Row 4 = first data row (index 3); cols: A=rank, B=name, D=+/-, G=points
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

// --- Player detail (rounds + handicap history) ---

function getPlayerDetail(playerName) {
  if (!playerName) return { error: "Missing name parameter" };

  var cacheKey = "player_" + playerName;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // --- Scoring Log ---
  var logSheet = ss.getSheetByName(SCORING_LOG_SHEET);
  var logRows = logSheet.getDataRange().getValues();

  var rounds = [];
  for (var i = 1; i < logRows.length; i++) {
    var row = logRows[i];
    var name = String(row[1]).trim();
    if (name !== playerName) continue;

    // Exclude flagged rounds
    if (String(row[15]).trim() === "Flagged") continue;

    // Parse "Course - Tees" from col C
    var courseAndTees = String(row[2]).trim();
    var separatorIdx = courseAndTees.lastIndexOf(" - ");
    var course =
      separatorIdx >= 0
        ? courseAndTees.substring(0, separatorIdx).trim()
        : courseAndTees;
    var tees =
      separatorIdx >= 0 ? courseAndTees.substring(separatorIdx + 3).trim() : "";

    rounds.push({
      timestamp: String(row[0]),
      course: course,
      tees: tees,
      frontBack: String(row[3]).trim(),
      month: String(row[4]).trim(),
      day: String(row[5]).trim(),
      score: parseInt(row[6]) || 0,
      partner: String(row[7]).trim(),
      datePlayed: String(row[8]),
      playingHandicap: parseFloat(row[9]) || 0,
      netScore: parseFloat(row[10]) || 0,
      coursePar: parseInt(row[11]) || 0,
      plusMinus: parseFloat(row[12]) || 0,
      monthPlayed: String(row[13]).trim(),
      monthlyCount: parseInt(row[16]) || 0,
    });
  }

  // Sort by date descending
  rounds.sort(function (a, b) {
    return new Date(b.datePlayed) - new Date(a.datePlayed);
  });

  // --- Handicap History ---
  var hcapSheet = ss.getSheetByName(HANDICAP_INDEX_SHEET);
  var maxCols = Math.min(hcapSheet.getLastColumn(), 252); // cap at 250 data cols + A + B
  var maxRows = hcapSheet.getLastRow();
  var hcapData = hcapSheet.getRange(1, 1, maxRows, maxCols).getValues();

  var dateHeaders = hcapData[0]; // row 1 = date headers (col C+ = index 2+)
  var handicapHistory = [];

  for (var r = 1; r < hcapData.length; r++) {
    if (String(hcapData[r][0]).trim() !== playerName) continue;

    for (var c = 2; c < dateHeaders.length; c++) {
      var dateVal = dateHeaders[c];
      var hcapVal = hcapData[r][c];
      if (
        dateVal &&
        hcapVal !== "" &&
        hcapVal !== null &&
        hcapVal !== undefined
      ) {
        handicapHistory.push({
          date: Utilities.formatDate(
            new Date(dateVal),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd",
          ),
          index: parseFloat(hcapVal) || 0,
        });
      }
    }
    break;
  }

  var result = {
    player: playerName,
    rounds: rounds,
    handicapHistory: handicapHistory,
  };
  // CacheService has a 100KB per-entry limit. Large player histories could exceed
  // it — catch silently and serve uncached rather than crash.
  try {
    cache.put(cacheKey, JSON.stringify(result), CACHE_TTL_PLAYER_DETAIL);
  } catch (e) {}
  return result;
}
