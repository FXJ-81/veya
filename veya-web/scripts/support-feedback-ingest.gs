/**
 * Google Apps Script — paste into the script editor attached to your Google Sheet
 * (Extensions → Apps Script), then Deploy → New deployment → Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Copy the Web app URL into Vercel / .env as SUPPORT_FEEDBACK_WEBAPP_URL.
 *
 * Optional: Project Settings → Script properties → add INGEST_SECRET (same value as
 * SUPPORT_FEEDBACK_WEBAPP_SECRET in Veya) so only your server can post.
 *
 * First row of the sheet can be headers, e.g.:
 *   submittedAt | email | name | topic | message | userId | source
 */

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: "empty body" });
    }
    var body = JSON.parse(e.postData.contents);

    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty("INGEST_SECRET");
    if (expected && body.ingestSecret !== expected) {
      return jsonOut({ ok: false, error: "forbidden" });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    sheet.appendRow([
      body.submittedAt || "",
      body.email || "",
      body.name || "",
      body.topic || "",
      body.message || "",
      body.userId || "",
      body.source || "",
    ]);

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
