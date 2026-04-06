/**
 * GGC Outdoor League - Apps Script Web App
 *
 * Deploy settings:
 *   Execute as: Me (sheet owner)
 *   Who has access: Anyone
 *
 * Routes:
 *   ?action=leaderboard       season standings
 *   ?action=monthly&month=April   one month's breakdown (future)
 *
 * Privacy: returns only name, rank, and points. No PII, no raw scores.
 * All scoring/ranking logic lives in the sheet.
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
 */

// --- Config ---

var SPREADSHEET_ID = '1PATbhSmfKVcHa3ffxiqicTidGhV0g2JN18NkhCcq5xc';

var TOTAL_POINTS_SHEET = 'Total Points';
var DATA_START_ROW     = 3; // 0-based; row 4 in the sheet

var COL_RANK  = 0;
var COL_NAME  = 1;
var COL_TOTAL = 10;

// Columns that represent actual scoring events (excludes col 8: Adjustment)
var MONTHLY_COLS = [2, 3, 4, 5, 6, 7, 9];

var MONTHLY_SHEETS = {
  'April':  'April Points',
  'May':    'May Points',
  'June':   'June Points',
  'July':   'July Points',
  'August': 'August Points'
};

// --- Entry point ---

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'leaderboard';

  var result;
  if (action === 'leaderboard') {
    result = getLeaderboard();
  } else if (action === 'monthly') {
    var month = (e.parameter && e.parameter.month) ? e.parameter.month : '';
    result = getMonthly(month);
  } else {
    result = { error: 'Unknown action: ' + action };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Season leaderboard ---

function getLeaderboard() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(TOTAL_POINTS_SHEET);
  var rows  = sheet.getDataRange().getValues();

  var standings = [];

  for (var i = DATA_START_ROW; i < rows.length; i++) {
    var row  = rows[i];
    var name = String(row[COL_NAME]).trim();
    if (!name) continue;

    var rank        = parseInt(row[COL_RANK], 10) || (standings.length + 1);
    var totalPoints = parseFloat(row[COL_TOTAL]) || 0;

    var events = 0;
    for (var c = 0; c < MONTHLY_COLS.length; c++) {
      var pts = parseFloat(row[MONTHLY_COLS[c]]);
      if (!isNaN(pts) && pts > 0) {
        events++;
      }
    }

    standings.push({
      rank:   rank,
      name:   name,
      points: totalPoints,
      events: events
    });
  }

  // Mark ties
  for (var j = 0; j < standings.length; j++) {
    var prev = j > 0 && standings[j - 1].points === standings[j].points;
    var next = j < standings.length - 1 && standings[j + 1].points === standings[j].points;
    standings[j].isTied = prev || next;
    if (prev) {
      standings[j].rank = standings[j - 1].rank;
    }
  }

  return {
    standings:   standings,
    lastUpdated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, h:mm a')
  };
}

// --- Monthly breakdown (for future page) ---

function getMonthly(month) {
  var sheetName = MONTHLY_SHEETS[month];
  if (!sheetName) {
    var validMonths = [];
    for (var key in MONTHLY_SHEETS) {
      validMonths.push(key);
    }
    return { error: 'Unknown month: ' + month + '. Valid: ' + validMonths.join(', ') };
  }

  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { error: 'Sheet not found: ' + sheetName };
  }

  var rows   = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 0; i < rows.length; i++) {
    var name   = String(rows[i][1]).trim();
    var points = rows[i][3];
    if (!name || name === 'Player') continue;
    result.push({ name: name, points: parseFloat(points) || 0 });
  }

  return { month: month, standings: result };
}
