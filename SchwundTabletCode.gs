/**
 * ============================================================================
 * SONA KARLI — SCHWUNDERFASSUNG 2.0 (TABLET, LIVE-PREISE & SONA HUB)
 * ============================================================================
 * Script-ID: 1FlvF4xfO4I_V1RihlfdX-yxSlMS5bJoyKLnlmMJHHqpNOXUnVlD7bs2j
 * Tabelle: https://docs.google.com/spreadsheets/d/1-eonw5BPF6zwCpfRXtQy9a2jyyRH9vevabiFtoA2Rno
 */

const SCHWUND_CONFIG = {
  LOCATION_NAME: 'SONA Karli',
  NAME_SCHWUND_SHEET: 'SCHWUND_NEU',
  NAME_START_SHEET: 'SCHWUND_ERFASSEN',
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

/**
 * Web-App Entrypoint: Ermöglicht das direkte Öffnen als Fullscreen-App auf Tablet/Handy
 */
function doGet() {
  const html = getTabletHtmlContent();
  return HtmlService.createHtmlOutput(html)
    .setTitle('🗑️ Schwunderfassung — SONA Karli')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🗑️ Schwunderfassung (' + SCHWUND_CONFIG.LOCATION_NAME + ')')
    .addItem('1. 📱 Tablet-Schnelleingabe öffnen', 'showTabletLossEntryDialog')
    .addItem('2. 📋 Tabellenblatt formatieren (SCHWUND_NEU)', 'setupSchwundNeuSheet')
    .addItem('3. 🔘 Start-Tab mit Schnellstart-Button einrichten', 'setupStartButtonSheet')
    .addSeparator()
    .addItem('4. 🔄 Preise mit Master-Zutaten synchronisieren', 'syncSchwundNeuPrices')
    .addItem('5. 📊 Wöchentlichen Schwund-Bericht anzeigen', 'showWeeklyLossReport')
    .addToUi();
}

function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    const row = range.getRow();
    const col = range.getColumn();
    
    // Klick auf den großen Start-Button im Tab SCHWUND_ERFASSEN
    if (sheetName === SCHWUND_CONFIG.NAME_START_SHEET && row >= 3 && row <= 7 && col >= 2 && col <= 6) {
      showTabletLossEntryDialog();
      return;
    }

    if (row < 4) return;
    if (sheetName === SCHWUND_CONFIG.NAME_SCHWUND_SHEET || sheetName === 'SCHWUND_NEU') {
      handleSchwundNeuEdit(sheet, row, col);
    }
  } catch(err) {
    Logger.log('onEdit Error: ' + err.toString());
  }
}

/**
 * Richtet das übersichtliche Start-Tab mit großem Klick-Button ein
 */
function setupStartButtonSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let startSheet = ss.getSheetByName(SCHWUND_CONFIG.NAME_START_SHEET);
  if (!startSheet) startSheet = ss.insertSheet(SCHWUND_CONFIG.NAME_START_SHEET, 0);
  else startSheet.clear();

  startSheet.getRange('B2:H2').merge()
    .setValue('SONA KARLI — SCHWUNDERFASSUNG')
    .setFontWeight('bold')
    .setFontSize(16)
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  startSheet.setRowHeight(2, 45);

  // Riesiger Touch-Button
  const buttonRange = startSheet.getRange('B4:H7');
  buttonRange.merge()
    .setValue('📱 HIER TIPPEN:\nSCHWUND JETZT BUCHEN')
    .setFontWeight('bold')
    .setFontSize(18)
    .setBackground('#991B1B')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  startSheet.getRange('B9:H10').merge()
    .setValue('💡 Hinweis für Mitarbeiter:\nTippe auf das rote Feld oben oder nutze das Menü "🗑️ Schwunderfassung" -> "1. Tablet-Schnelleingabe öffnen".')
    .setFontSize(11)
    .setFontColor('#475569')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  ss.setActiveSheet(startSheet);
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

function validateUnitCompatibility(ingredientName, chosenUnit, baseUnit, category) {
  const u = (chosenUnit || '').toLowerCase().trim();
  const name = (ingredientName || '').toLowerCase().trim();
  const bUnit = (baseUnit || '').toLowerCase().trim();
  const cat = (category || '').toLowerCase().trim();

  const isLiquid = bUnit === 'l' || bUnit === 'ml' || cat.includes('beverage') || cat.includes('getränk') || 
                   /\b(cola|wasser|bier|wein|saft|sirup|sauce|soße|öl|essig|likör|gin|wodka|rum|prosecco|sake)\b/i.test(name);

  const isSolid = (bUnit === 'kg' || bUnit === 'g' || cat.includes('food') || cat.includes('küche')) && !isLiquid &&
                  /\b(lachs|rind|schwein|huhn|gurke|avocado|salat|reis|nudel|tomate|zwiebel|mehl|zucker)\b/i.test(name);

  if (isLiquid && (u === 'g' || u === 'kg' || u.includes('gramm') || u.includes('kilogramm'))) {
    return {
      valid: false,
      error: `Ungültige Einheit: "${ingredientName}" ist eine Flüssigkeit/Getränk und kann nicht in Gramm/Kilogramm gebucht werden! Bitte Flasche (Fl), Liter (l), Milliliter (ml) oder Stück (Stk) wählen.`
    };
  }

  if (isSolid && (u === 'l' || u === 'ml' || u.includes('liter') || u.includes('milliliter'))) {
    return {
      valid: false,
      error: `Ungültige Einheit: "${ingredientName}" ist ein Feststoff und kann nicht in Liter/Milliliter gebucht werden! Bitte Gramm (g), Kilogramm (kg) oder Stück (Stk) wählen.`
    };
  }

  return { valid: true };
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
        const kat = String(r[3] || 'Food').trim();
        const unit = String(r[5] || 'kg').trim();
        const price = parseFloat(r[6]) || 0;
        if (name) {
          priceMap[name.toLowerCase()] = { name: name, unit: unit, price: price, kat: kat };
        }
        if (id) {
          priceMap[id] = { name: name, unit: unit, price: price, kat: kat };
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

  // 1. Banner
  sheet.getRange('A1:P1').merge()
    .setValue('🗑️ SCHWUNDERFASSUNG (SONA KARLI — TABLET & MASTER-ZUTATEN ANBINDUNG)')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#7F1D1D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  // 2. Tabellen-Header
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

  // 3. Dropdowns
  const stationRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_STATIONS, true).setAllowInvalid(true).build();
  sheet.getRange('E4:E2000').setDataValidation(stationRule);

  const unitRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_UNITS, true).setAllowInvalid(true).build();
  sheet.getRange('H4:H2000').setDataValidation(unitRule);

  const reasonRule = SpreadsheetApp.newDataValidation().requireValueInList(LOSS_REASONS, true).setAllowInvalid(true).build();
  sheet.getRange('M4:M2000').setDataValidation(reasonRule);

  refreshSchwundNeuMasterDropdown(sheet);

  // 4. Formate
  sheet.getRange('B4:B2000').setNumberFormat('dd.MM.yyyy');
  sheet.getRange('G4:G2000').setNumberFormat('#,##0.00');
  sheet.getRange('I4:I2000').setNumberFormat('#,##0.000');
  sheet.getRange('K4:L2000').setNumberFormat('[$€-de-DE] #,##0.00');

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

    // 1. Pflichtfeld-Prüfung
    const employee = (formData.employee || '').trim();
    const zutat = (formData.ingredient || '').trim();
    const rawQty = parseFloat(formData.quantity) || 0;
    const rawUnit = (formData.unit || 'kg').trim();
    const station = (formData.station || '').trim();
    const reason = (formData.reason || '').trim();
    const note = (formData.note || '').trim();

    if (!formData.date) return { success: false, error: 'Bitte ein gültiges Datum angeben!' };
    if (!employee) return { success: false, error: 'Mitarbeiter-Name ist ein Pflichtfeld!' };
    if (!station) return { success: false, error: 'Bereich / Station ist ein Pflichtfeld!' };
    if (!zutat) return { success: false, error: 'Master-Zutat / Artikel ist ein Pflichtfeld!' };
    if (rawQty <= 0) return { success: false, error: 'Schwundmenge muss größer als 0 sein!' };
    if (!reason) return { success: false, error: 'Grund für Schwund ist ein Pflichtfeld!' };

    // 2. Preis- & Plausibilitäts-Check
    const priceMap = getMasterPriceMap();
    const info = priceMap[zutat.toLowerCase()];
    const calcPrice = (info && info.price > 0) ? info.price : 0;
    const masterUnit = (info && info.unit) ? info.unit : 'kg';
    const category = (info && info.kat) ? info.kat : (formData.isNewCategory || 'Food');

    const compat = validateUnitCompatibility(zutat, rawUnit, masterUnit, category);
    if (!compat.valid) {
      return { success: false, error: compat.error };
    }

    const dateVal = new Date(formData.date);
    const ym = Utilities.formatDate(dateVal, 'Europe/Berlin', 'yyyy-MM');
    const kw = 'KW ' + Utilities.formatDate(dateVal, 'Europe/Berlin', 'w');
    const nextRow = Math.max(4, sheet.getLastRow() + 1);
    const entryId = 'SB-' + ym.replace('-', '') + '-' + String(nextRow - 3).padStart(4, '0');

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

function getTabletHtmlContent() {
  const ingredients = getMasterIngredientsForTablet();
  const todayStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; margin: 0; padding: 12px; color: #1e293b; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
        .container { width: 100%; max-width: 520px; background: #ffffff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); border: 1px solid #e2e8f0; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fee2e2; padding-bottom: 12px; margin-bottom: 16px; }
        .header h2 { margin: 0; color: #991b1b; font-size: 1.35rem; display: flex; align-items: center; gap: 8px; }
        .badge { font-size: 0.8rem; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 8px; font-weight: 800; }
        .form-row { margin-bottom: 14px; position: relative; }
        label { display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.88rem; color: #334155; }
        label .req { color: #dc2626; margin-left: 2px; }
        input, select, textarea { width: 100%; padding: 12px 14px; border: 2px solid #cbd5e1; border-radius: 10px; font-size: 1rem; background: #fff; transition: all 0.15s; }
        input:focus, select:focus, textarea:focus { border-color: #991b1b; outline: none; box-shadow: 0 0 0 4px rgba(153, 27, 27, 0.15); }
        .input-error { border-color: #ef4444 !important; background-color: #fef2f2 !important; }
        .error-hint { color: #dc2626; font-size: 0.78rem; font-weight: 700; margin-top: 4px; display: none; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .unit-buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .unit-btn { flex: 1; min-width: 52px; padding: 10px 4px; background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px; font-weight: 800; text-align: center; cursor: pointer; font-size: 0.9rem; transition: all 0.15s; user-select: none; }
        .unit-btn.active { background: #991b1b; color: #ffffff; border-color: #991b1b; box-shadow: 0 2px 8px rgba(153,27,27,0.35); }
        .unit-btn.disabled { opacity: 0.35; pointer-events: none; }
        .new-product-box { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 10px 12px; margin-top: 8px; display: none; font-size: 0.85rem; color: #92400e; }
        .preview-box { background: #fef2f2; border: 2px dashed #f87171; border-radius: 12px; padding: 14px; text-align: center; margin: 16px 0; }
        .preview-title { font-size: 0.8rem; font-weight: 800; color: #7f1d1d; letter-spacing: 0.5px; }
        .preview-amount { font-size: 1.75rem; font-weight: 900; color: #991b1b; margin-top: 2px; }
        .btn-submit { width: 100%; padding: 16px; background: #991b1b; color: #ffffff; border: none; border-radius: 12px; font-size: 1.15rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.15s; box-shadow: 0 4px 12px rgba(153,27,27,0.3); }
        .btn-submit:hover { background: #7f1d1d; transform: translateY(-1px); }
        .btn-submit:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
        .status-msg { margin-top: 14px; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.95rem; text-align: center; display: none; }
        .status-msg.success { background: #dcfce7; color: #166534; display: block; border: 1.5px solid #86efac; }
        .status-msg.error { background: #fee2e2; color: #991b1b; display: block; border: 1.5px solid #fca5a5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🗑️ SCHWUNDERFASSUNG</h2>
          <span class="badge">SONA Karli</span>
        </div>

        <form id="lossForm" onsubmit="submitLossEntry(event)">
          <div class="grid-2">
            <div class="form-row">
              <label>📅 Datum <span class="req">*</span></label>
              <input type="date" id="entryDate" value="${todayStr}" required onchange="validateFields()">
              <div id="errDate" class="error-hint">Datum erforderlich</div>
            </div>
            <div class="form-row">
              <label>👤 Mitarbeiter <span class="req">*</span></label>
              <input type="text" id="employeeInput" placeholder="Name / Kürzel (z. B. Julia, Alex)" required oninput="validateFields()">
              <div id="errEmployee" class="error-hint">Name eingeben</div>
            </div>
          </div>

          <div class="form-row">
            <label>📍 Bereich / Station <span class="req">*</span></label>
            <select id="stationSelect" required onchange="validateFields()">
              <option value="">-- Station wählen --</option>
              ${LOSS_STATIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <div id="errStation" class="error-hint">Bitte Station wählen</div>
          </div>

          <div class="form-row">
            <label>🍣 Master-Zutat / Artikel <span class="req">*</span></label>
            <input list="ingredientList" id="ingredientInput" placeholder="Tippen zum Suchen (z. B. Gurke, Lachs, Cola)..." oninput="handleIngredientChange()" required autocomplete="off">
            <datalist id="ingredientList">
              ${ingredients.map(i => `<option value="${i.name}">${i.name} (${i.price.toFixed(2)} € / ${i.unit})</option>`).join('')}
            </datalist>
            <div id="errIngredient" class="error-hint">Zutat erforderlich</div>

            <div id="newProductBox" class="new-product-box">
              ⚠️ <b>Neue Zutat (noch nicht im Stamm):</b>
              <div style="margin-top: 4px; display: flex; gap: 8px;">
                <label style="font-size: 0.8rem; font-weight: normal;"><input type="radio" name="newCat" value="Food" checked> 🥗 Küche/Food</label>
                <label style="font-size: 0.8rem; font-weight: normal;"><input type="radio" name="newCat" value="Beverage"> 🍷 Bar/Getränke</label>
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-row">
              <label>⚖️ Menge <span class="req">*</span></label>
              <input type="number" step="any" id="quantityInput" placeholder="z. B. 350 oder 1.5" required oninput="handleQuantityChange()">
              <div id="errQuantity" class="error-hint">Menge > 0 erforderlich</div>
            </div>
            <div class="form-row">
              <label>📏 Einheit <span class="req">*</span></label>
              <div class="unit-buttons" id="unitBtnContainer">
                <div class="unit-btn active" onclick="selectUnit('g (Gramm)', this)">g</div>
                <div class="unit-btn" onclick="selectUnit('kg (Kilogramm)', this)">kg</div>
                <div class="unit-btn" onclick="selectUnit('Stk (Stück)', this)">Stk</div>
                <div class="unit-btn" onclick="selectUnit('ml (Milliliter)', this)">ml</div>
                <div class="unit-btn" onclick="selectUnit('l (Liter)', this)">l</div>
                <div class="unit-btn" onclick="selectUnit('Fl (Flasche)', this)">Fl</div>
              </div>
              <input type="hidden" id="selectedUnit" value="g (Gramm)">
              <div id="errUnit" class="error-hint">Einheit unpassend</div>
            </div>
          </div>

          <div class="form-row">
            <label>⚠️ Grund für Schwund (PFLICHTFELD) <span class="req">*</span></label>
            <select id="reasonSelect" required onchange="validateFields()">
              <option value="">-- Verlustgrund wählen --</option>
              ${LOSS_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
            <div id="errReason" class="error-hint">Bitte Grund wählen</div>
          </div>

          <div class="form-row">
            <label>📝 Bemerkung / Maßnahme (optional)</label>
            <input type="text" id="noteInput" placeholder="z. B. Überreif geliefert, Glasbruch im Service...">
          </div>

          <div class="preview-box">
            <div class="preview-title">BERECHNETER SCHWUND-VERLUST</div>
            <div class="preview-amount" id="previewAmount">0,00 €</div>
            <div id="previewDetails" style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">Bitte alle Pflichtfelder ausfüllen</div>
          </div>

          <button type="submit" class="btn-submit" id="submitBtn">
            <span>⚡ SCHWUND JETZT BUCHEN</span>
          </button>
          <div id="statusMsg" class="status-msg"></div>
        </form>
      </div>

      <script>
        const masterIngredients = ${JSON.stringify(ingredients)};
        const pieceWeights = ${JSON.stringify(AVERAGE_PIECE_WEIGHTS)};

        // Letzten Mitarbeiter-Namen aus LocalStorage laden
        window.addEventListener('DOMContentLoaded', () => {
          const savedEmp = localStorage.getItem('sona_last_employee');
          if (savedEmp) {
            document.getElementById('employeeInput').value = savedEmp;
          }
          validateFields();
        });

        function selectUnit(unit, btn) {
          document.getElementById('selectedUnit').value = unit;
          document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          handleQuantityChange();
        }

        function handleIngredientChange() {
          const zutatName = (document.getElementById('ingredientInput').value || '').trim().toLowerCase();
          const newBox = document.getElementById('newProductBox');
          
          if (!zutatName) {
            newBox.style.display = 'none';
            validateFields();
            return;
          }

          let matched = masterIngredients.find(i => i.name.toLowerCase() === zutatName || i.name.toLowerCase().includes(zutatName));
          if (!matched) {
            newBox.style.display = 'block';
          } else {
            newBox.style.display = 'none';
            // Auto-Select passende Standard-Einheit
            if (matched.unit === 'l' || matched.unit === 'ml') {
              autoSelectUnit('l (Liter)');
            } else if (matched.unit === 'stk' || matched.unit === 'fl') {
              autoSelectUnit('Stk (Stück)');
            }
          }
          validateFields();
          calculateLivePreview();
        }

        function autoSelectUnit(targetUnit) {
          const btns = document.querySelectorAll('.unit-btn');
          btns.forEach(b => {
            if (b.innerText.toLowerCase() === targetUnit.split(' ')[0].toLowerCase()) {
              selectUnit(targetUnit, b);
            }
          });
        }

        function handleQuantityChange() {
          validateFields();
          calculateLivePreview();
        }

        function validateFields() {
          const dateVal = document.getElementById('entryDate').value;
          const empVal = (document.getElementById('employeeInput').value || '').trim();
          const stationVal = document.getElementById('stationSelect').value;
          const zutatVal = (document.getElementById('ingredientInput').value || '').trim();
          const qtyVal = parseFloat(document.getElementById('quantityInput').value) || 0;
          const unitVal = document.getElementById('selectedUnit').value;
          const reasonVal = document.getElementById('reasonSelect').value;

          let isValid = true;

          // Date check
          setFieldState('entryDate', 'errDate', !!dateVal);
          if (!dateVal) isValid = false;

          // Employee check
          setFieldState('employeeInput', 'errEmployee', !!empVal);
          if (!empVal) isValid = false;

          // Station check
          setFieldState('stationSelect', 'errStation', !!stationVal);
          if (!stationVal) isValid = false;

          // Ingredient check
          setFieldState('ingredientInput', 'errIngredient', !!zutatVal);
          if (!zutatVal) isValid = false;

          // Quantity check
          setFieldState('quantityInput', 'errQuantity', qtyVal > 0);
          if (qtyVal <= 0) isValid = false;

          // Reason check
          setFieldState('reasonSelect', 'errReason', !!reasonVal);
          if (!reasonVal) isValid = false;

          // Plausibilitäts-Check Einheit vs Zutat
          if (zutatVal) {
            const matched = masterIngredients.find(i => i.name.toLowerCase() === zutatVal.toLowerCase() || i.name.toLowerCase().includes(zutatVal.toLowerCase()));
            const baseU = matched ? matched.unit : 'kg';
            const cat = matched ? (matched.kat || 'Food') : 'Food';
            
            const isLiquid = baseU === 'l' || baseU === 'ml' || cat.includes('beverage') || /(cola|bier|wein|wasser|saft|sirup|soße|öl)/i.test(zutatVal);
            const isSolid = (baseU === 'kg' || baseU === 'g' || cat.includes('food')) && !isLiquid && /(lachs|rind|fleisch|gurke|avocado|salat|reis)/i.test(zutatVal);

            const u = unitVal.toLowerCase();
            const errUnit = document.getElementById('errUnit');

            if (isLiquid && (u.includes('g') && !u.includes('kg') || u.includes('kg'))) {
              document.getElementById('unitBtnContainer').classList.add('input-error');
              errUnit.innerText = '❌ Flüssigkeit kann nicht in Gramm/kg gebucht werden!';
              errUnit.style.display = 'block';
              isValid = false;
            } else if (isSolid && (u.includes('ml') || u.includes('l') && !u.includes('fl'))) {
              document.getElementById('unitBtnContainer').classList.add('input-error');
              errUnit.innerText = '❌ Feststoff kann nicht in Liter/ml gebucht werden!';
              errUnit.style.display = 'block';
              isValid = false;
            } else {
              document.getElementById('unitBtnContainer').classList.remove('input-error');
              errUnit.style.display = 'none';
            }
          }

          document.getElementById('submitBtn').disabled = !isValid;
          return isValid;
        }

        function setFieldState(fieldId, errId, valid) {
          const el = document.getElementById(fieldId);
          const err = document.getElementById(errId);
          if (!valid) {
            el.classList.add('input-error');
            if (err) err.style.display = 'block';
          } else {
            el.classList.remove('input-error');
            if (err) err.style.display = 'none';
          }
        }

        function calculateLivePreview() {
          const zutatName = (document.getElementById('ingredientInput').value || '').trim().toLowerCase();
          const rawQty = parseFloat(document.getElementById('quantityInput').value) || 0;
          const unit = document.getElementById('selectedUnit').value.toLowerCase();
          
          if (!zutatName || rawQty <= 0) {
            document.getElementById('previewAmount').innerText = '0,00 €';
            document.getElementById('previewDetails').innerText = 'Bitte alle Pflichtfelder ausfüllen';
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
          if (!validateFields()) return;

          const btn = document.getElementById('submitBtn');
          const msg = document.getElementById('statusMsg');
          btn.disabled = true;
          btn.innerHTML = '<span>⏳ Buche Schwund...</span>';
          msg.style.display = 'none';

          const emp = document.getElementById('employeeInput').value.trim();
          localStorage.setItem('sona_last_employee', emp);

          const payload = {
            date: document.getElementById('entryDate').value,
            employee: emp,
            station: document.getElementById('stationSelect').value,
            ingredient: document.getElementById('ingredientInput').value.trim(),
            quantity: document.getElementById('quantityInput').value,
            unit: document.getElementById('selectedUnit').value,
            reason: document.getElementById('reasonSelect').value,
            note: document.getElementById('noteInput').value.trim(),
            isNewCategory: document.querySelector('input[name="newCat"]:checked') ? document.querySelector('input[name="newCat"]:checked').value : 'Food'
          };

          google.script.run
            .withSuccessHandler(function(res) {
              btn.disabled = false;
              btn.innerHTML = '<span>⚡ SCHWUND JETZT BUCHEN</span>';
              if (res.success) {
                msg.className = 'status-msg success';
                msg.innerText = '✅ Gebucht: ' + res.ingredient + ' (' + res.totalLoss.toFixed(2) + ' €) unter ID ' + res.entryId;
                document.getElementById('ingredientInput').value = '';
                document.getElementById('quantityInput').value = '';
                document.getElementById('noteInput').value = '';
                document.getElementById('reasonSelect').value = '';
                document.getElementById('newProductBox').style.display = 'none';
                document.getElementById('previewAmount').innerText = '0,00 €';
                document.getElementById('previewDetails').innerText = 'Erfolgreich verbucht. Bereit für nächsten Eintrag.';
                validateFields();
              } else {
                msg.className = 'status-msg error';
                msg.innerText = '❌ ' + res.error;
              }
            })
            .withFailureHandler(function(err) {
              btn.disabled = false;
              btn.innerHTML = '<span>⚡ SCHWUND JETZT BUCHEN</span>';
              msg.className = 'status-msg error';
              msg.innerText = '❌ Verbindungsfehler: ' + err.toString();
            })
            .saveTabletLossEntry(payload);
        }
      </script>
    </body>
    </html>
  `;
}

function showTabletLossEntryDialog() {
  const html = getTabletHtmlContent();
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(560)
    .setHeight(680)
    .setTitle('🗑️ SCHWUNDERFASSUNG — SONA Karli');
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🗑️ SCHWUNDERFASSUNG — SONA Karli');
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
