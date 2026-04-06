// NOTE: NOT DEPLOYED ON APPSCRIPT, THIS IS A BACKUP

/** @OnlyCurrentDoc */

function PrintScorecards() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.setActiveSheet(
    spreadsheet.getSheetByName("Match Play Scorecards"),
    true,
  );
  spreadsheet.getRange("A1").activate();
  spreadsheet.getRange("A1:N62").activate();
}

function SummaryUpdate() {
  var spreadsheet = SpreadsheetApp.getActive();
  var sheet = spreadsheet.getActiveSheet();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).activate();
  spreadsheet
    .getActiveRangeList()
    .setBackground("#ffffff")
    .setBorder(false, false, false, false, false, false);
  spreadsheet.getRange("5:38").activate();
  spreadsheet
    .getActiveSheet()
    .deleteRows(
      spreadsheet.getActiveRange().getRow(),
      spreadsheet.getActiveRange().getNumRows(),
    );
  spreadsheet.getRange("J7").activate();
  spreadsheet.getRange("5:38").activate();
  spreadsheet
    .getActiveRangeList()
    .setFontFamily("Permanent Marker")
    .setFontSize(14);

  spreadsheet.getRange("C3").activate();
  var num = spreadsheet.getActiveCell().getValue();
  spreadsheet.getRange("G3").activate();
  spreadsheet
    .getCurrentCell()
    .setFormula(
      "=countif(index('Individual Scoring Log'!B5:Z45,,match(D1,'Individual Scoring Log'!B4:Z4))," +
        num +
        ")",
    );

  spreadsheet.getRange("B3").activate();
  spreadsheet
    .getCurrentCell()
    .offset(1 + spreadsheet.getRange("G3").getValue(), 0)
    .activate();
  spreadsheet.getCurrentCell().setValue("Low Net Round:");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("right");
  spreadsheet.getCurrentCell().offset(0, 1).activate();
  spreadsheet
    .getCurrentCell()
    .setFormula(
      "=min(index('Individual Scoring Log'!$B$49:$Z$88,,match($D$1,'Individual Scoring Log'!$B$48:$Z$48,0)))",
    );
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  var num = spreadsheet.getActiveCell().getValue();
  spreadsheet.getCurrentCell().offset(0, 1).activate();
  spreadsheet
    .getCurrentCell()
    .setFormula(
      "=filter('Individual Scoring Log'!A49:A88,index('Individual Scoring Log'!$B$49:$Z$88,,match($D$1,'Individual Scoring Log'!$B$48:$Z$48,0))=" +
        num +
        ")",
    );
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 3).activate();
  spreadsheet
    .getCurrentCell()
    .setFormula(
      "=countif(index('Individual Scoring Log'!$B$49:$Z$88,,match($D$1,'Individual Scoring Log'!$B$48:$Z$48))," +
        num +
        ")",
    );
  var num = spreadsheet.getActiveCell().getValue();
  spreadsheet
    .getCurrentCell()
    .offset(1 + num, -6)
    .activate();
  spreadsheet.getCurrentCell().setValue("Rank");
  spreadsheet.getActiveRangeList().setFontLine("underline");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setValue("Player");
  spreadsheet.getActiveRangeList().setFontLine("underline");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setValue("June +/-");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getActiveRangeList().setFontLine("underline");

  spreadsheet.getCurrentCell().offset(1, -3).activate();
  spreadsheet.getCurrentCell().setValue("1");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setFormula("='June Points'!B4");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setFormula("='June Points'!D4");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");

  spreadsheet.getCurrentCell().offset(1, -3).activate();
  spreadsheet.getCurrentCell().setValue("2");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setFormula("='June Points'!B5");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setFormula("='June Points'!D5");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");

  spreadsheet.getCurrentCell().offset(1, -3).activate();
  spreadsheet.getCurrentCell().setValue("3");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setFormula("='June Points'!B6");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setFormula("='June Points'!D6");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");

  spreadsheet.getCurrentCell().offset(1, -3).activate();
  spreadsheet.getCurrentCell().setValue("4");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setFormula("='June Points'!B7");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setFormula("='June Points'!D7");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");

  spreadsheet.getCurrentCell().offset(1, -3).activate();
  spreadsheet.getCurrentCell().setValue("5");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().offset(0, 1, 1, 2).activate().mergeAcross();
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");
  spreadsheet.getCurrentCell().setFormula("='June Points'!B8");
  spreadsheet.getCurrentCell().offset(0, 2).activate();
  spreadsheet.getCurrentCell().setFormula("='June Points'!D8");
  spreadsheet.getActiveRangeList().setHorizontalAlignment("center");

  spreadsheet.deleteColumn(7);
  spreadsheet.getDataRange().activate();
  spreadsheet
    .getActiveRangeList()
    .setBorder(
      true,
      true,
      true,
      true,
      null,
      null,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID_THICK,
    )
    .setBackground("#efefef");
  spreadsheet.getRange("J13").activate();
}

function CopyMonthlyCount() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange("O5").activate();
  var currentCell = spreadsheet.getCurrentCell();
  spreadsheet
    .getSelection()
    .getNextDataRange(SpreadsheetApp.Direction.DOWN)
    .activate();
  currentCell.activateAsCurrentCell();
  spreadsheet
    .getRange("O4")
    .copyTo(
      spreadsheet.getActiveRange(),
      SpreadsheetApp.CopyPasteType.PASTE_NORMAL,
      false,
    );
  spreadsheet.getRange("O1").activate();
}

function Test() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange("O4:O14").activate();
}

function CopyMonthlyCount3() {
  var spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getRange("A1").activate();
  spreadsheet.setActiveSheet(
    spreadsheet.getSheetByName("Scoring Log 2025"),
    true,
  );
  spreadsheet.getRange("Q5:Q1774").activate();
  spreadsheet
    .getRange("Q4")
    .copyTo(
      spreadsheet.getActiveRange(),
      SpreadsheetApp.CopyPasteType.PASTE_NORMAL,
      false,
    );
  spreadsheet.getRange("Q1").activate();
}
