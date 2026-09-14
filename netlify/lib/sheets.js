// Sinkronisasi ke Google Sheets — sifatnya "best-effort":
// - Kalau env var belum di-setup, semua fungsi di sini diam-diam tidak
//   melakukan apapun (return langsung), TIDAK melempar error.
// - Kalau Google Sheets API error/timeout, error-nya cuma di-log ke console,
//   TIDAK dilempar ke pemanggil — supaya create/edit/hapus/upload agenda
//   tetap berhasil normal walau sinkronisasi ke spreadsheet-nya gagal.
const SHEET_TITLE = "Agenda";
const HEADER = ["ID", "Tanggal", "Jam", "Asal Surat", "Keterangan", "Disposisi", "No. Disposisi", "No. Surat", "Dokumen"];

function isConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID);
}

async function getSheet() {
  if (!isConfigured()) return null;

  const { GoogleSpreadsheet } = require("google-spreadsheet");
  const { JWT } = require("google-auth-library");

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADER });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      // Sheet ada tapi belum ada baris header (baru dibuat manual) -> buatkan
      await sheet.setHeaderRow(HEADER);
    }
  }
  return sheet;
}

function rowValuesFromItem(item) {
  return {
    ID: String(item.id),
    Tanggal: item.tanggal,
    Jam: item.jam,
    "Asal Surat": item.asalSurat,
    Keterangan: item.keterangan,
    Disposisi: (item.tags || []).join(", "),
    "No. Disposisi": item.noDisposisi || "",
    "No. Surat": item.noSurat || "",
    Dokumen: (item.attachments || []).map((a) => a.name).join(", "),
  };
}

// Buat baris baru kalau agenda ini belum pernah disinkronkan, atau update baris
// yang sudah ada (dicocokkan lewat kolom ID) kalau sudah pernah — dipakai untuk
// create, edit, maupun setelah upload dokumen (supaya kolom Dokumen ikut update).
async function upsertAgendaRow(item) {
  try {
    const sheet = await getSheet();
    if (!sheet) return;

    const rows = await sheet.getRows();
    const existing = rows.find((r) => r.get("ID") === String(item.id));
    const values = rowValuesFromItem(item);

    if (existing) {
      Object.entries(values).forEach(([key, val]) => existing.set(key, val));
      await existing.save();
    } else {
      await sheet.addRow(values);
    }
  } catch (err) {
    console.error("[sheets] Gagal sinkron ke Google Sheets:", err.message);
  }
}

async function deleteAgendaRow(itemId) {
  try {
    const sheet = await getSheet();
    if (!sheet) return;

    const rows = await sheet.getRows();
    const existing = rows.find((r) => r.get("ID") === String(itemId));
    if (existing) await existing.delete();
  } catch (err) {
    console.error("[sheets] Gagal hapus baris di Google Sheets:", err.message);
  }
}

module.exports = { upsertAgendaRow, deleteAgendaRow, isConfigured };
