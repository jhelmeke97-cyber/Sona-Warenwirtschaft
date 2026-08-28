/**
 * ============================================================================
 * SONA KARLI — STANDALONE SCHWUND- & BRUCH-MANAGEMENT (TABLET & SONA HUB)
 * ============================================================================
 * Dieser Code wird direkt im Google Apps Script Editor der Schwund-Tabelle
 * (https://docs.google.com/spreadsheets/d/1-eonw5BPF6zwCpfRXtQy9a2jyyRH9vevabiFtoA2Rno) hinterlegt.
 * 
 * Er arbeitet eigenständig, liest die tagesaktuellen Preise aus der zentralen
 * Warenwirtschaft (Master-Zutaten) und ermöglicht die blitzschnelle Erfassung am Tablet.
 */

const SCHWUND_CONFIG = {
  LOCATION_NAME: 'SONA Karli',
  NAME_SCHWUND_SHEET: 'SCHWUND_NEU',
  MASTER_WARENWIRTSCHAFT_SHEET_ID: '1JebVj7LmD6gRqR88h0HAji5YM7lmDuiK7YWsVYSNTZA',
  MASTER_ZUTATEN_TAB: 'MASTER_ZUTATEN'
};

const LOSS_STATIONS = [
  '🍣 Sushi-Bar',
  '🍳 Warme Küche',
  '🔪 Vorbereitung / Mise en Place',
  '🍸 Bar / Service',
  '❄️ Kühlhaus / Lager'
];

const LOSS_REASONS = [
  '1. Schnitt- & Vorbereitungsverlust (Parieren/Abschnitt)',
  '2. Verdorben / MHD / Qualität',
  '3. Zubereitungsfehler / Angebrannt',
  '4. Bruch & Beschädigung',
  '5. Gäste-Reklamation / Fehlbon',
  '6. Personalessen / Verkostung / Probe',
  '7. Inventur-Differenz'
];

const LOSS_UNITS = [
  'g (Gramm)',
  'kg (Kilogramm)',
  'Stk (Stück)',
  'ml (Milliliter)',
  'l (Liter)',
  'Fl (Flasche)',
  'Portion'
];

const LOSS_EMPLOYEES = [
  'Julia',
  'Küchenchef',
  'Sushi-Chef 1',
  'Sushi-Chef 2',
  'Koch / Posten',
  'Bar-Chef',
  'Serviceleitung'
];

const AVERAGE_PIECE_WEIGHTS = {
  'gurke': { weightKg: 0.35, unit: 'kg' },
  'salatgurke': { weightKg: 0.35, unit: 'kg' },
  'avocado': { weightKg: 0.22, unit: 'kg' },
  'avocados': { weightKg: 0.22, unit: 'kg' },
  'limette': { weightKg: 0.06, unit: 'kg' },
  'limetten': { weightKg: 0.06, unit: 'kg' },
  'zitrone': { weightKg: 0.12, unit: 'kg' },
  'zitronen': { weightKg: 0.12, unit: 'kg' },
  'eisbergsalat': { weightKg: 0.50, unit: 'kg' },
  'salat': { weightKg: 0.50, unit: 'kg' },
  'paprika': { weightKg: 0.18, unit: 'kg' },
  'mango': { weightKg: 0.40, unit: 'kg' },
  'ananas': { weightKg: 1.20, unit: 'kg' }
};

const UNIT_CONVERSION_FACTORS = {
  'g': { baseUnit: 'kg', factor: 0.001 },
  'gramm': { baseUnit: 'kg', factor: 0.001 },
  'g (gramm)': { baseUnit: 'kg', factor: 0.001 },
  'kg': { baseUnit: 'kg', factor: 1.0 },
  'kilogramm': { baseUnit: 'kg', factor: 1.0 },
  'kg (kilogramm)': { baseUnit: 'kg', factor: 1.0 },
  'ml': { baseUnit: 'l', factor: 0.001 },
  'milliliter': { baseUnit: 'l', factor: 0.001 },
  'ml (milliliter)': { baseUnit: 'l', factor: 0.001 },
  'l': { baseUnit: 'l', factor: 1.0 },
  'liter': { baseUnit: 'l', factor: 1.0 },
  'l (liter)': { baseUnit: 'l', factor: 1.0 },
  'stk': { baseUnit: 'stk', factor: 1.0 },
  'stück': { baseUnit: 'stk', factor: 1.0 },
  'stk (stück)': { baseUnit: 'stk', factor: 1.0 },
  'fl': { baseUnit: 'stk', factor: 1.0 },
  'flasche': { baseUnit: 'stk', factor: 1.0 },
  'fl (flasche)': { baseUnit: 'stk', factor: 1.0 },
  'portion': { baseUnit: 'portion', factor: 1.0 }
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🗑️ Schwund & Bruch (' + SCHWUND_CONFIG.LOCATION_NAME + ')')
    .addItem('1. 📱 Tablet-Schnelleingabe öffnen', 'showTabletLossEntryDialog')
    .addItem('2. 📋 Tabellenblatt formatieren (SCHWUND_NEU)', 'setupSchwundNeuSheet')
    .addItem('3. 🔄 Preise mit Master-Zutaten synchronisieren', 'syncSchwundNeuPrices')
    .addItem('4. 📊 Wöchentlichen Schwund-Bericht anzeigen', 'showWeeklyLossReport')
    .addToUi();
}

function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    const row = range.getRow();
    const col = range.getColumn();
    
    if (row < 4) return;
    if (sheetName === SCHWUND_CONFIG.NAME_SCHWUND_SHEET || sheetName === 'SCHWUND_NEU') {
      handleSchwundNeuEdit(sheet, row, col);
    }
  } catch(err) {
    Logger.log('onEdit Error: ' + err.toString());
  }
}

function normalizeLossQuantity(rawQty, rawUnit, ingredientName, masterBaseUnit) {
  const u = (rawUnit || '').toLowerCase().trim();
  const name = (ingredientName || '').toLowerCase().trim();
  const qty = parseFloat(rawQty) || 0;
  
  if (qty <= 0) return { baseQty: 0, baseUnit: masterBaseUnit || 'kg' };

  if ((u.includes('stk') || u.includes('stück')) && (masterBaseUnit === 'kg' || !masterBaseUnit)) {
    for (const [key, info] of Object.entries(AVERAGE_PIECE_WEIGHTS)) {
      if (name.includes(key)) {
        return {
          baseQty: Math.round(qty * info.weightKg * 1000) / 1000,
          baseUnit: info.unit
        };
      }
    }
  }

  const conv = UNIT_CONVERSION_FACTORS[u];
  if (conv) {
    return {
      baseQty: Math.round(qty * conv.factor * 1000) / 1000,
      baseUnit: conv.baseUnit
    };
  }

  return {
    baseQty: qty,
    baseUnit: masterBaseUnit || 'kg'
  };
}

function getMasterPriceMap() {
  const priceMap = {};
  try {
    const masterSs = SpreadsheetApp.openById(SCHWUND_CONFIG.MASTER_WARENWIRTSCHAFT_SHEET_ID);
    const mzSheet = masterSs.getSheetByName(SCHWUND_CONFIG.MASTER_ZUTATEN_TAB);
    if (mzSheet && mzSheet.getLastRow() >= 2) {
      const data = mzSheet.getRange(2, 1, mzSheet.getLastRow() - 1, 8).getValues();
      data.forEach(r => {
        const id = String(r[0] || '').trim().toLowerCase();
        const name = String(r[1] || '').trim();
        const unit = String(r[5] || 'kg').trim();
        const price = parseFloat(r[6]) || 0;
        if (name) {
          priceMap[name.toLowerCase()] = { name: name, unit: unit, price: price };
        }
        if (id) {
          priceMap[id] = { name: name, unit: unit, price: price };
        }
      });
    }
  } catch(e) {
    Logger.log('Master-Zutaten Zugriff: ' + e.toString());
  }
  return priceMap;
}

function setupSchwundNeuSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
  if (!sheet) sheet = ss.insertSheet(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
  else sheet.clear();

  // 1. Interaktives Dashboard-Banner (Zeilen 1 & 2)
  sheet.getRange('A1:P1').merge()
    .setValue('🗑️ SCHWUND- & BRUCHLISTE (SONA KARLI — TABLET & MASTER-ZUTATEN ANBINDUNG)')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#7F1D1D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  // 2. Tabellen-Header (Zeile 3)
  const headers = [
    'Eintrags-ID', 'Datum', 'KW', 'Erfasst von (Mitarbeiter)', 'Bereich / Station', 
    'Master-Zutat / Artikel', 'Eingegebene Menge', 'Eingegebene Einheit', 
    'Menge (Basiseinheit)', 'Basiseinheit', 'Einkaufspreis Netto (€ / Einheit)', 
    'Gesamtverlust Netto (€)', 'Verlustgrund / Schwundkategorie', 'Status Preis', 
    'Bemerkung / Maßnahme', 'Jahr_Monat'
  ];

  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange('A3:P3').setFontWeight('bold').setBackground('#1B365D').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  sheet.setRowHeight(3, 38);
  sheet.setFrozenRows(3);

  // 3. Dropdowns & Validierungen
  const empRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_EMPLOYEES, true).setAllowInvalid(true).build();
  sheet.getRange('D4:D2000').setDataValidation(empRule);

  const stationRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_STATIONS, true).setAllowInvalid(true).build();
  sheet.getRange('E4:E2000').setDataValidation(stationRule);

  const unitRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_UNITS, true).setAllowInvalid(true).build();
  sheet.getRange('H4:H2000').setDataValidation(unitRule);

  const reasonRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_REASONS, true).setAllowInvalid(true).build();
  sheet.getRange('M4:M2000').setDataValidation(reasonRule);

  // Master-Zutaten Dropdown
  refreshSchwundNeuMasterDropdown(sheet);

  // 4. Zahlenformate
  sheet.getRange('B4:B2000').setNumberFormat('dd.MM.yyyy');
  sheet.getRange('G4:G2000').setNumberFormat('#,##0.00');
  sheet.getRange('I4:I2000').setNumberFormat('#,##0.000');
  sheet.getRange('K4:L2000').setNumberFormat('[$€-de-DE] #,##0.00');

  // Bedingte Formatierung für Status
  applySchwundNeuConditionalFormatting(sheet);
  sheet.autoResizeColumns(1, headers.length);
}

function refreshSchwundNeuMasterDropdown(sheet) {
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
  if (!sheet) return;

  const priceMap = getMasterPriceMap();
  const mzList = Object.values(priceMap).map(p => p.name).filter(n => n && !n.startsWith('Unbekannt'));
  const sortedList = Array.from(new Set(mzList)).sort((a, b) => a.localeCompare(b, 'de'));
  
  if (sortedList.length > 0) {
    const mzRule = SpreadsheetApp.newDataValidation().requireValueInList(sortedList, true).setAllowInvalid(true).build();
    sheet.getRange('F4:F2000').setDataValidation(mzRule);
  }
}

function applySchwundNeuConditionalFormatting(sheet) {
  const statusRange = sheet.getRange('N4:N2000');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('GUELTIG')
      .setBackground('#E6F4EA').setFontColor('#137333').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('PREIS_OFFEN')
      .setBackground('#FEF7E0').setFontColor('#B06000').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('MANUELL_ERFASST')
      .setBackground('#E8F0FE').setFontColor('#1967D2').setBold(true)
      .setRanges([statusRange]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function syncSchwundNeuPrices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
  const ui = SpreadsheetApp.getUi();
  if (!sheet || sheet.getLastRow() < 4) {
    if (ui) ui.alert('Hinweis', 'In der Schwundliste sind noch keine Buchungen vorhanden.', ui.ButtonSet.OK);
    return;
  }

  const priceMap = getMasterPriceMap();
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(4, 1, lastRow - 3, 16).getValues();
  let updatedCount = 0;
  let totalLossSum = 0;

  for (let i = 0; i < data.length; i++) {
    const zutat = String(data[i][5] || '').trim().toLowerCase();
    const rawQty = parseFloat(data[i][6]) || 0;
    const rawUnit = String(data[i][7] || 'kg').trim();
    const info = priceMap[zutat];

    if (info && info.price > 0) {
      const norm = normalizeLossQuantity(rawQty, rawUnit, data[i][5], info.unit);
      const totalLoss = Math.round(norm.baseQty * info.price * 100) / 100;
      sheet.getRange(4 + i, 9).setValue(norm.baseQty);
      sheet.getRange(4 + i, 10).setValue(norm.baseUnit);
      sheet.getRange(4 + i, 11).setValue(info.price);
      sheet.getRange(4 + i, 12).setValue(totalLoss);
      sheet.getRange(4 + i, 14).setValue('GUELTIG');
      totalLossSum += totalLoss;
      updatedCount++;
    }
  }

  refreshSchwundNeuMasterDropdown(sheet);

  if (ui) {
    ui.alert(
      'Schwundliste synchronisiert',
      `Erfolgreich ${updatedCount} Einträge mit den aktuellen Einkaufspreisen aus MASTER_ZUTATEN aktualisiert.\n\n` +
      `Gesamter monetärer Schwundwert: ${totalLossSum.toFixed(2)} €`,
      ui.ButtonSet.OK
    );
  }
}

function handleSchwundNeuEdit(sheet, row, col) {
  if (row < 4) return;
  
  if (col === 2) {
    const dateVal = sheet.getRange(row, 2).getValue();
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const ym = Utilities.formatDate(dateVal, 'Europe/Berlin', 'yyyy-MM');
      const kw = 'KW ' + Utilities.formatDate(dateVal, 'Europe/Berlin', 'w');
      sheet.getRange(row, 3).setValue(kw);
      sheet.getRange(row, 16).setValue(ym);
      const currId = sheet.getRange(row, 1).getValue();
      if (!currId) {
        const id = 'SB-' + ym.replace('-', '') + '-' + String(row - 3).padStart(4, '0');
        sheet.getRange(row, 1).setValue(id);
      }
    }
  }

  if (col === 6 || col === 7 || col === 8) {
    const zutat = String(sheet.getRange(row, 6).getValue() || '').trim();
    const rawQty = parseFloat(sheet.getRange(row, 7).getValue()) || 0;
    const rawUnit = String(sheet.getRange(row, 8).getValue() || 'kg').trim();
    
    if (zutat) {
      const priceMap = getMasterPriceMap();
      const info = priceMap[zutat.toLowerCase()];
      
      if (info && info.price > 0) {
        const norm = normalizeLossQuantity(rawQty, rawUnit, zutat, info.unit || 'kg');
        sheet.getRange(row, 9).setValue(norm.baseQty);
        sheet.getRange(row, 10).setValue(norm.baseUnit);
        sheet.getRange(row, 11).setValue(info.price);
        sheet.getRange(row, 12).setValue(Math.round(norm.baseQty * info.price * 100) / 100);
        sheet.getRange(row, 14).setValue('GUELTIG');
      } else {
        const norm = normalizeLossQuantity(rawQty, rawUnit, zutat, 'kg');
        sheet.getRange(row, 9).setValue(norm.baseQty);
        sheet.getRange(row, 10).setValue(norm.baseUnit);
        sheet.getRange(row, 14).setValue('⚠️ ZUTAT_NEU_PREIS_OFFEN');
      }
    }
  }
}

function getMasterIngredientsForTablet() {
  const priceMap = getMasterPriceMap();
  return Object.values(priceMap).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function saveTabletLossEntry(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
    if (!sheet) {
      setupSchwundNeuSheet();
      sheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
    }

    const dateVal = formData.date ? new Date(formData.date) : new Date();
    const ym = Utilities.formatDate(dateVal, 'Europe/Berlin', 'yyyy-MM');
    const kw = 'KW ' + Utilities.formatDate(dateVal, 'Europe/Berlin', 'w');
    const nextRow = Math.max(4, sheet.getLastRow() + 1);
    const entryId = 'SB-' + ym.replace('-', '') + '-' + String(nextRow - 3).padStart(4, '0');

    const zutat = (formData.ingredient || '').trim();
    const rawQty = parseFloat(formData.quantity) || 0;
    const rawUnit = (formData.unit || 'kg').trim();
    const employee = (formData.employee || 'Mitarbeiter').trim();
    const station = (formData.station || '🍣 Sushi-Bar').trim();
    const reason = (formData.reason || '1. Schnitt- & Vorbereitungsverlust').trim();
    const note = (formData.note || '').trim();

    const priceMap = getMasterPriceMap();
    const info = priceMap[zutat.toLowerCase()];
    const calcPrice = (info && info.price > 0) ? info.price : 0;
    const masterUnit = (info && info.unit) ? info.unit : 'kg';

    const norm = normalizeLossQuantity(rawQty, rawUnit, zutat, masterUnit);
    const totalLoss = Math.round(norm.baseQty * calcPrice * 100) / 100;
    const status = calcPrice > 0 ? 'GUELTIG' : '⚠️ ZUTAT_NEU_PREIS_OFFEN';

    const rowData = [
      entryId,
      dateVal,
      kw,
      employee,
      station,
      zutat,
      rawQty,
      rawUnit,
      norm.baseQty,
      norm.baseUnit,
      calcPrice,
      totalLoss,
      reason,
      status,
      note,
      ym
    ];

    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(nextRow, 2).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(nextRow, 7).setNumberFormat('#,##0.00');
    sheet.getRange(nextRow, 9).setNumberFormat('#,##0.000');
    sheet.getRange(nextRow, 11).setNumberFormat('[$€-de-DE] #,##0.00');
    sheet.getRange(nextRow, 12).setNumberFormat('[$€-de-DE] #,##0.00');

    return {
      success: true,
      entryId: entryId,
      ingredient: zutat,
      baseQty: norm.baseQty,
      baseUnit: norm.baseUnit,
      price: calcPrice,
      totalLoss: totalLoss,
      status: status
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function showTabletLossEntryDialog() {
  const ingredients = getMasterIngredientsForTablet();
  const todayStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 12px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fee2e2; padding-bottom: 10px; margin-bottom: 14px; }
        .header h2 { margin: 0; color: #991b1b; font-size: 1.25rem; }
        .form-row { margin-bottom: 12px; }
        label { display: block; font-weight: 700; margin-bottom: 5px; font-size: 0.85rem; color: #475569; }
        input, select, textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; background: #fff; }
        input:focus, select:focus, textarea:focus { border-color: #991b1b; outline: none; box-shadow: 0 0 0 3px rgba(153, 27, 27, 0.15); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .unit-buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .unit-btn { flex: 1; min-width: 58px; padding: 9px 4px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; font-weight: 700; text-align: center; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
        .unit-btn.active { background: #991b1b; color: #ffffff; border-color: #991b1b; box-shadow: 0 2px 6px rgba(153,27,27,0.3); }
        .preview-box { background: #fef2f2; border: 1.5px dashed #f87171; border-radius: 10px; padding: 12px; text-align: center; margin: 14px 0; }
        .preview-title { font-size: 0.8rem; font-weight: 600; color: #7f1d1d; }
        .preview-amount { font-size: 1.5rem; font-weight: 900; color: #991b1b; margin-top: 2px; }
        .btn-submit { width: 100%; padding: 14px; background: #991b1b; color: #ffffff; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s; }
        .btn-submit:hover { background: #7f1d1d; }
        .btn-submit:disabled { background: #94a3b8; cursor: not-allowed; }
        .status-msg { margin-top: 10px; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; text-align: center; display: none; }
        .status-msg.success { background: #dcfce7; color: #166534; display: block; border: 1px solid #86efac; }
        .status-msg.error { background: #fee2e2; color: #991b1b; display: block; border: 1px solid #fca5a5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🗑️ Schwund & Bruch buchen</h2>
          <span style="font-size: 0.8rem; background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 6px; font-weight: 700;">SONA Karli</span>
        </div>

        <form id="lossForm" onsubmit="submitLossEntry(event)">
          <div class="grid-2">
            <div class="form-row">
              <label>📅 Datum</label>
              <input type="date" id="entryDate" value="${todayStr}" required>
            </div>
            <div class="form-row">
              <label>👤 Mitarbeiter</label>
              <select id="employeeSelect">
                ${LOSS_EMPLOYEES.map(e => `<option value="${e}">${e}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <label>📍 Bereich / Station</label>
            <select id="stationSelect">
              ${LOSS_STATIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <label>🍣 Master-Zutat / Artikel</label>
            <input list="ingredientList" id="ingredientInput" placeholder="Tippen zum Suchen (z. B. Gurke, Lachs)..." oninput="calculateLivePreview()" required autocomplete="off">
            <datalist id="ingredientList">
              ${ingredients.map(i => `<option value="${i.name}">${i.name} (${i.price.toFixed(2)} € / ${i.unit})</option>`).join('')}
            </datalist>
          </div>

          <div class="grid-2">
            <div class="form-row">
              <label>⚖️ Schwund-Menge</label>
              <input type="number" step="any" id="quantityInput" placeholder="z. B. 350 oder 1.5" required oninput="calculateLivePreview()">
            </div>
            <div class="form-row">
              <label>📏 Einheit</label>
              <div class="unit-buttons">
                <div class="unit-btn active" onclick="selectUnit('g (Gramm)', this)">g</div>
                <div class="unit-btn" onclick="selectUnit('kg (Kilogramm)', this)">kg</div>
                <div class="unit-btn" onclick="selectUnit('Stk (Stück)', this)">Stk</div>
                <div class="unit-btn" onclick="selectUnit('ml (Milliliter)', this)">ml</div>
                <div class="unit-btn" onclick="selectUnit('l (Liter)', this)">l</div>
                <div class="unit-btn" onclick="selectUnit('Fl (Flasche)', this)">Fl</div>
              </div>
              <input type="hidden" id="selectedUnit" value="g (Gramm)">
            </div>
          </div>

          <div class="form-row">
            <label>⚠️ Grund für Schwund / Bruch (PFLICHTFELD)</label>
            <select id="reasonSelect" required>
              ${LOSS_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <label>📝 Bemerkung / Maßnahme (optional)</label>
            <input type="text" id="noteInput" placeholder="z. B. Überreif geliefert, Glasbruch im Service...">
          </div>

          <div class="preview-box">
            <div class="preview-title">GESCHÄTZTER MONETÄRER VERLUST</div>
            <div class="preview-amount" id="previewAmount">0,00 €</div>
            <div id="previewDetails" style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">Bitte Zutat und Menge eingeben</div>
          </div>

          <button type="submit" class="btn-submit" id="submitBtn">
            <span>⚡ Schwund jetzt buchen</span>
          </button>
          <div id="statusMsg" class="status-msg"></div>
        </form>
      </div>

      <script>
        const masterIngredients = ${JSON.stringify(ingredients)};
        const pieceWeights = ${JSON.stringify(AVERAGE_PIECE_WEIGHTS)};

        function selectUnit(unit, btn) {
          document.getElementById('selectedUnit').value = unit;
          document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          calculateLivePreview();
        }

        function calculateLivePreview() {
          const zutatName = (document.getElementById('ingredientInput').value || '').trim().toLowerCase();
          const rawQty = parseFloat(document.getElementById('quantityInput').value) || 0;
          const unit = document.getElementById('selectedUnit').value.toLowerCase();
          
          if (!zutatName || rawQty <= 0) {
            document.getElementById('previewAmount').innerText = '0,00 €';
            document.getElementById('previewDetails').innerText = 'Bitte Zutat und Menge eingeben';
            return;
          }

          let matched = masterIngredients.find(i => i.name.toLowerCase() === zutatName || i.name.toLowerCase().includes(zutatName));
          if (!matched) {
            document.getElementById('previewAmount').innerText = 'Preis offen';
            document.getElementById('previewDetails').innerText = '⚠️ Neue Zutat: Wird als offener Posten zur Nachkalkulation gebucht';
            return;
          }

          let baseQty = rawQty;
          let baseUnit = matched.unit || 'kg';

          if (unit.includes('g') && !unit.includes('kg')) baseQty = rawQty * 0.001;
          else if (unit.includes('ml')) baseQty = rawQty * 0.001;
          else if (unit.includes('stk') || unit.includes('stück')) {
            for (const [k, info] of Object.entries(pieceWeights)) {
              if (zutatName.includes(k)) {
                baseQty = rawQty * info.weightKg;
                break;
              }
            }
          }

          const loss = Math.round(baseQty * matched.price * 100) / 100;
          document.getElementById('previewAmount').innerText = loss.toFixed(2) + ' €';
          document.getElementById('previewDetails').innerText = baseQty.toFixed(3) + ' ' + baseUnit + ' × ' + matched.price.toFixed(2) + ' €/' + baseUnit + ' (' + matched.name + ')';
        }

        function submitLossEntry(e) {
          e.preventDefault();
          const btn = document.getElementById('submitBtn');
          const msg = document.getElementById('statusMsg');
          btn.disabled = true;
          btn.innerHTML = '<span>⏳ Buche Schwund...</span>';
          msg.style.display = 'none';

          const payload = {
            date: document.getElementById('entryDate').value,
            employee: document.getElementById('employeeSelect').value,
            station: document.getElementById('stationSelect').value,
            ingredient: document.getElementById('ingredientInput').value,
            quantity: document.getElementById('quantityInput').value,
            unit: document.getElementById('selectedUnit').value,
            reason: document.getElementById('reasonSelect').value,
            note: document.getElementById('noteInput').value
          };

          google.script.run
            .withSuccessHandler(function(res) {
              btn.disabled = false;
              btn.innerHTML = '<span>⚡ Schwund jetzt buchen</span>';
              if (res.success) {
                msg.className = 'status-msg success';
                msg.innerText = '✅ Gebucht: ' + res.ingredient + ' (' + res.totalLoss.toFixed(2) + ' €) unter ID ' + res.entryId;
                document.getElementById('ingredientInput').value = '';
                document.getElementById('quantityInput').value = '';
                document.getElementById('noteInput').value = '';
                document.getElementById('previewAmount').innerText = '0,00 €';
                document.getElementById('previewDetails').innerText = 'Erfolgreich verbucht. Bereit für nächsten Eintrag.';
              } else {
                msg.className = 'status-msg error';
                msg.innerText = '❌ Fehler beim Buchen: ' + res.error;
              }
            })
            .withFailureHandler(function(err) {
              btn.disabled = false;
              btn.innerHTML = '<span>⚡ Schwund jetzt buchen</span>';
              msg.className = 'status-msg error';
              msg.innerText = '❌ Verbindungsfehler: ' + err.toString();
            })
            .saveTabletLossEntry(payload);
        }
      </script>
    </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(560)
    .setHeight(650)
    .setTitle('📱 Tablet-Schnelleingabe: Schwund & Bruch');
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📱 Tablet-Schnelleingabe: Schwund & Bruch');
}

function showWeeklyLossReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_SCHWUND_SHEET);
  const ui = SpreadsheetApp.getUi();
  if (!sheet || sheet.getLastRow() < 4) {
    if (ui) ui.alert('Keine Daten', 'Es liegen noch keine Schwundbuchungen in SCHWUND_NEU vor.', ui.ButtonSet.OK);
    return;
  }

  const data = sheet.getRange(4, 1, sheet.getLastRow() - 3, 16).getValues();
  let totalLoss = 0;
  const kwStats = {};
  const stationStats = {};
  const reasonStats = {};

  data.forEach(r => {
    const kw = String(r[2] || 'KW Unbekannt');
    const station = String(r[4] || 'Sonstige');
    const loss = parseFloat(r[11]) || 0;
    const reason = String(r[12] || 'Sonstiges');

    totalLoss += loss;
    kwStats[kw] = (kwStats[kw] || 0) + loss;
    stationStats[station] = (stationStats[station] || 0) + loss;
    reasonStats[reason] = (reasonStats[reason] || 0) + loss;
  });

  let msg = `📊 WÖCHENTLICHER SCHWUND- & BRUCHBERICHT (${SCHWUND_CONFIG.LOCATION_NAME})\n\n`;
  msg += `GESAMTVERLUST ERFASST: ${totalLoss.toFixed(2)} €\n\n`;
  
  msg += `VERLUST NACH KALENDERWOCHEN:\n`;
  for (const [kw, val] of Object.entries(kwStats)) {
    msg += `• ${kw}: ${val.toFixed(2)} €\n`;
  }
  msg += `\nVERLUST NACH STATIONEN:\n`;
  for (const [st, val] of Object.entries(stationStats)) {
    msg += `• ${st}: ${val.toFixed(2)} €\n`;
  }
  msg += `\nVERLUST NACH GRÜNDEN:\n`;
  for (const [re, val] of Object.entries(reasonStats)) {
    msg += `• ${re}: ${val.toFixed(2)} €\n`;
  }

  if (ui) ui.alert('Schwund-Controlling Report', msg, ui.ButtonSet.OK);
}
