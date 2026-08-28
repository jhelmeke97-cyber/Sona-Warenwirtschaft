/**
 * ============================================================================
 * SONA KARLI — BRUCHERFASSUNG 2.0 (GLÄSER, GESCHIRR, TABLET & SONA HUB)
 * ============================================================================
 * Tabelle: https://docs.google.com/spreadsheets/d/1EudAGrkHhqxA8ii2B07_wALa8USgI8tJhz4potS73KA
 */

const BRUCH_CONFIG = {
  LOCATION_NAME: 'SONA Karli',
  NAME_BRUCH_SHEET: 'BRUCH_NEU',
  NAME_START_SHEET: 'BRUCH_ERFASSEN',
  NAME_KATALOG_SHEET: 'BRUCH_KATALOG',
  BRUCH_SPREADSHEET_ID: '1EudAGrkHhqxA8ii2B07_wALa8USgI8tJhz4potS73KA',
  SONA_HUB_SPREADSHEET_ID: '1VZ2Q9tU3QcmVhYZRotYWkV-wgNwQFWsGZ6QLvH4goWE',
  SONA_HUB_TAB_WEEKLY: 'BRUCH_SONA_KARLI',
  SONA_HUB_TAB_RAW: 'BRUCH_ROHDATEN_KARLI'
};

const BRUCH_CATALOG_ITEMS = [
  { name: 'Nachtmann 0,2 l', unit: 'Stk', price: 2.88, cat: 'Glas', note: 'Standard-Nachtmann-Glas' },
  { name: 'Nachtmann 0,375 l', unit: 'Stk', price: 3.58, cat: 'Glas', note: 'Nachtmann Kristallglas' },
  { name: 'Aperitifglas', unit: 'Stk', price: 2.99, cat: 'Glas', note: 'Gastro-Aperitifglas' },
  { name: 'Espressoteller', unit: 'Stk', price: 1.24, cat: 'Geschirr', note: 'Unterteller Espresso' },
  { name: 'Glasstrohhalm', unit: 'Stk', price: 0.35, cat: 'Zubehör', note: 'Wiederverwendbarer Glasstrohhalm' },
  { name: 'Sake-Glas', unit: 'Stk', price: 2.00, cat: 'Glas', note: 'Japanisches Sake-Glas' },
  { name: 'Sake-Flasche 32 cl', unit: 'Stk', price: 15.00, cat: 'Karaffe', note: 'Sake-Servierflasche / Tokkuri 32 cl' },
  { name: 'Teeglas', unit: 'Stk', price: 5.30, cat: 'Glas', note: 'Hitzebeständiges Gastro-Teeglas' },
  { name: 'Warsteiner-/Weissbierglas 0,5 l', unit: 'Stk', price: 3.90, cat: 'Glas', note: 'Weizenglas 0,5 l' },
  { name: 'Warsteiner-Glas 0,3 l', unit: 'Stk', price: 2.00, cat: 'Glas', note: 'Pilsglas / Warsteiner 0,3 l' },
  { name: 'Wasserglas', unit: 'Stk', price: 3.50, cat: 'Glas', note: 'Gastro-Wasserglas' },
  { name: 'Weinglas', unit: 'Stk', price: 4.80, cat: 'Glas', note: 'Gastro-Weinglas (Schott Zwiesel/Spiegelau)' },
  { name: 'Cappuccino-Tasse', unit: 'Stk', price: 4.49, cat: 'Geschirr', note: 'Porzellantasse inkl. Untere' },
  { name: 'Sektglas', unit: 'Stk', price: 3.00, cat: 'Glas', note: 'Champagner-/Sektflöte' },
  { name: 'Sojaschale', unit: 'Stk', price: 5.00, cat: 'Geschirr', note: 'Keramik-/Porzellan-Sojaschale' },
  { name: 'Besteck, Teelöffel schwarz', unit: 'Stk', price: 5.00, cat: 'Besteck', note: 'Edelstahl beschichtet schwarz' },
  { name: 'Besteck, Teelöffel schwarz – alte Liste', unit: 'Stk', price: 15.00, cat: 'Besteck', note: 'Spezialserie / Altliste' },
  { name: 'Wasserflasche', unit: 'Stk', price: 2.85, cat: 'Flasche', note: 'Mehrweg-Gastroglasflasche' },
  { name: 'Martini-Glas', unit: 'Stk', price: 5.00, cat: 'Glas', note: 'Cocktail-/Martinikelch' },
  { name: 'Karaffe 1 l', unit: 'Stk', price: 9.30, cat: 'Karaffe', note: 'Wasserkaraffe 1,0 l' },
  { name: 'Whiskyglas', unit: 'Stk', price: 12.90, cat: 'Glas', note: 'Kristall-Whisky-Tumbler' },
  { name: 'Whiskyglas – Standardwert', unit: 'Stk', price: 3.50, cat: 'Glas', note: 'Standard-Gastro-Tumbler' },
  { name: 'Filter für V6 Kaffee', unit: 'Stk', price: 5.00, cat: 'Zubehör', note: 'V60 Handfilter / Einsatz' },
  { name: 'Wasserflasche 0,5 l', unit: 'Stk', price: 10.00, cat: 'Flasche', note: 'Sonder-Mehrwegflasche 0,5 l' },
  { name: 'Reisschüssel klein', unit: 'Stk', price: 8.99, cat: 'Geschirr', note: 'Japanische Keramik-Reisschale klein' },
  { name: 'Sojasossenbehälter', unit: 'Stk', price: 10.00, cat: 'Geschirr', note: 'Keramik-Sojasaucenspender mit Ausgießer' }
];

const BRUCH_STATIONS = [
  '🍸 Bar / Service',
  '🍽️ Restaurant / Gastraum',
  '🧼 Spülküche / Stewarding',
  '🍣 Sushi-Bar',
  '🍳 Warme Küche',
  '❄️ Lager / Keller'
];

const BRUCH_REASONS = [
  '1. Heruntergefallen / Im Service entglitten',
  '2. Spülküche / Thermoschock / Korbüberladung',
  '3. Polieren / Abtrocknen zerbrochen',
  '4. Gastverschulden (Umgestoßen/Bruch am Tisch)',
  '5. Absplitterung / Riss / Aussortiert',
  '6. Transport / Lagerung beschädigt',
  '7. Sonstiges'
];

/**
 * Web-App Entrypoint: Fullscreen Tablet/Smartphone Schnelleingabe für Bruch
 */
function doGet() {
  const html = getBruchTabletHtmlContent();
  return HtmlService.createHtmlOutput(html)
    .setTitle('💥 Brucherfassung — SONA Karli')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💥 Brucherfassung (' + BRUCH_CONFIG.LOCATION_NAME + ')')
    .addItem('1. 📱 Tablet-Schnelleingabe öffnen', 'showBruchTabletDialog')
    .addItem('2. 📋 Tabellenblätter komplett einrichten (BRUCH_NEU & KATALOG)', 'setupAllBruchSheets')
    .addItem('3. 🔘 Start-Tab mit Schnellstart-Button einrichten', 'setupBruchStartButtonSheet')
    .addSeparator()
    .addItem('4. 🔄 Preise mit Bruch-Katalog synchronisieren', 'syncBruchPricesWithCatalog')
    .addItem('5. 📊 Wöchentlichen Bruch-Bericht anzeigen', 'showWeeklyBruchReport')
    .addSeparator()
    .addItem('6. 🚀 Bruchdaten an SONA Hub übertragen', 'syncBruchDataToSonaHub')
    .addItem('7. ⏰ Automatischen wöchentlichen Sync einrichten', 'setupAutomaticBruchHubSync')
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
    if (sheetName === BRUCH_CONFIG.NAME_BRUCH_SHEET || sheetName === 'BRUCH_NEU') {
      handleBruchNeuEdit(sheet, row, col);
    }
  } catch(err) {
    Logger.log('Bruch onEdit Error: ' + err.toString());
  }
}

/**
 * Richtet alle Tabellenblätter (BRUCH_NEU, BRUCH_KATALOG, BRUCH_ERFASSEN) ein
 */
function setupAllBruchSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupBruchKatalogSheet(ss);
  setupBruchNeuSheet(ss);
  setupBruchStartButtonSheet(ss);

  const ui = SpreadsheetApp.getUi();
  if (ui) {
    ui.alert(
      'Brucherfassung 2.0 erfolgreich eingerichtet!',
      'Folgende Tabellenblätter wurden im SONA Design eingerichtet:\n\n' +
      '• 🔘 BRUCH_ERFASSEN: Startseite mit Schnellstart-Button für Tablet/Handy\n' +
      '• 📋 BRUCH_NEU: Erfassungstabelle mit automatischer Preisberechnung\n' +
      '• 📖 BRUCH_KATALOG: ' + BRUCH_CATALOG_ITEMS.length + ' Referenz-Artikel (Gläser, Geschirr, Besteck)',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Richtet das übersichtliche Start-Tab mit großem Klick-Button ein
 */
function setupBruchStartButtonSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let startSheet = ss.getSheetByName(BRUCH_CONFIG.NAME_START_SHEET);
  if (!startSheet) startSheet = ss.insertSheet(BRUCH_CONFIG.NAME_START_SHEET, 0);
  else startSheet.clear();

  startSheet.getRange('B2:H2').merge()
    .setValue('SONA KARLI — BRUCHERFASSUNG (GLÄSER & GESCHIRR)')
    .setFontWeight('bold')
    .setFontSize(16)
    .setBackground('#1C1A18')
    .setFontColor('#D4AF37')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  startSheet.setRowHeight(2, 45);

  let webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl() || '';
  } catch(e) {}

  if (!webAppUrl) {
    webAppUrl = 'https://script.google.com/macros/s/AKfycbx4nC6bTH4knJBm6ykRmKgstNz-WN_DxKb54f6b8F2D2o4Ofaz0CULogY-xGMav7zbh/exec';
  }

  // Riesiger Touch-Button im edlen Sona Warm-Braun / Gold Stil
  const buttonRange = startSheet.getRange('B4:H7');
  buttonRange.merge()
    .setFormula(`=HYPERLINK("${webAppUrl}"; "📱 HIER TIPPEN: BRUCHERFASSUNG ÖFFNEN")`)
    .setFontWeight('bold')
    .setFontSize(16)
    .setBackground('#3A2F24')
    .setFontColor('#F5EBE1')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  startSheet.getRange('B9:H11').merge()
    .setValue(
      '💡 Anleitung für Mitarbeiter:\n' +
      '• 📱 Auf Smartphone / Tablet: Tippe auf das Feld oben, um die Bruchmaske im Vollbild zu öffnen.\n' +
      '• 💻 Am PC / Browser: Klicke im Menü oben auf "💥 Brucherfassung" -> "1. 📱 Tablet-Schnelleingabe öffnen".'
    )
    .setFontSize(11)
    .setFontColor('#4A4237')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  ss.setActiveSheet(startSheet);
}

/**
 * Richtet den Stammkatalog für Gläser & Geschirr ein
 */
function setupBruchKatalogSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_KATALOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(BRUCH_CONFIG.NAME_KATALOG_SHEET);
  else sheet.clear();

  // Banner
  sheet.getRange('A1:E1').merge()
    .setValue('📖 SONA KARLI — BRUCH-KATALOG & LISTENPREISE (GLÄSER, GESCHIRR, BESTECK)')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#1C1A18')
    .setFontColor('#D4AF37')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  const headers = ['Artikel-Bezeichnung', 'Kategorie', 'Standard-Einheit', 'Netto-Listenpreis (€ / Stk)', 'Einschätzung / Beschreibung'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange('A3:E3').setFontWeight('bold').setBackground('#2A2621').setFontColor('#F5EBE1').setHorizontalAlignment('center');
  sheet.setRowHeight(3, 35);
  sheet.setFrozenRows(3);

  const catalogRows = BRUCH_CATALOG_ITEMS.map(item => [
    item.name,
    item.cat,
    item.unit,
    item.price,
    item.note
  ]);

  sheet.getRange(4, 1, catalogRows.length, headers.length).setValues(catalogRows);
  sheet.getRange(4, 4, catalogRows.length, 1).setNumberFormat('[$€-de-DE] #,##0.00');
  sheet.getRange(4, 2, catalogRows.length, 2).setHorizontalAlignment('center');

  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Gibt eine Map aller Artikel aus BRUCH_KATALOG zurück
 */
function getBruchCatalogMap(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = {};
  
  // Fallback aus Code-Definition
  BRUCH_CATALOG_ITEMS.forEach(item => {
    map[item.name.toLowerCase()] = { name: item.name, unit: item.unit, price: item.price, cat: item.cat };
  });

  try {
    const sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_KATALOG_SHEET);
    if (sheet && sheet.getLastRow() >= 4) {
      const data = sheet.getRange(4, 1, sheet.getLastRow() - 3, 4).getValues();
      data.forEach(r => {
        const name = String(r[0] || '').trim();
        const cat = String(r[1] || 'Glas').trim();
        const unit = String(r[2] || 'Stk').trim();
        const price = parseFloat(r[3]) || 0;
        if (name) {
          map[name.toLowerCase()] = { name, unit, price, cat };
        }
      });
    }
  } catch(e) {
    Logger.log('Bruch-Katalog Lesefehler: ' + e.toString());
  }

  return map;
}

/**
 * Richtet das Erfassungsblatt BRUCH_NEU ein
 */
function setupBruchNeuSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
  if (!sheet) sheet = ss.insertSheet(BRUCH_CONFIG.NAME_BRUCH_SHEET);
  else sheet.clear();

  // 1. Banner
  sheet.getRange('A1:N1').merge()
    .setValue('💥 BRUCHERFASSUNG (SONA KARLI — TABLET & KATALOG-ANBINDUNG)')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#1C1A18')
    .setFontColor('#D4AF37')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  // 2. Tabellen-Header
  const headers = [
    'Eintrags-ID', 'Datum', 'KW', 'Erfasst von (Mitarbeiter)', 'Bereich / Station', 
    'Bruch-Artikel / Glas / Geschirr', 'Menge (Stück)', 'Einheit', 
    'Listenpreis Netto (€ / Stk)', 'Gesamt-Bruchwert Netto (€)', 
    'Bruchgrund / Ursache', 'Status Preis', 'Bemerkung / Maßnahme', 'Jahr_Monat'
  ];

  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange('A3:N3').setFontWeight('bold').setBackground('#2A2621').setFontColor('#F5EBE1').setHorizontalAlignment('center').setWrap(true);
  sheet.setRowHeight(3, 38);
  sheet.setFrozenRows(3);

  // 3. Dropdowns
  const stationRule = SpreadsheetApp.newDataValidation().requireValueInList(BRUCH_STATIONS, true).setAllowInvalid(true).build();
  sheet.getRange('E4:E2000').setDataValidation(stationRule);

  const reasonRule = SpreadsheetApp.newDataValidation().requireValueInList(BRUCH_REASONS, true).setAllowInvalid(true).build();
  sheet.getRange('K4:K2000').setDataValidation(reasonRule);

  refreshBruchCatalogDropdown(sheet);

  // 4. Formate
  sheet.getRange('B4:B2000').setNumberFormat('dd.MM.yyyy');
  sheet.getRange('G4:G2000').setNumberFormat('#,##0');
  sheet.getRange('I4:J2000').setNumberFormat('[$€-de-DE] #,##0.00');

  applyBruchNeuConditionalFormatting(sheet);
  sheet.autoResizeColumns(1, headers.length);
}

function refreshBruchCatalogDropdown(sheet) {
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
  if (!sheet) return;

  const catalogMap = getBruchCatalogMap();
  const sortedList = Object.values(catalogMap).map(c => c.name).sort((a, b) => a.localeCompare(b, 'de'));
  
  if (sortedList.length > 0) {
    const artRule = SpreadsheetApp.newDataValidation().requireValueInList(sortedList, true).setAllowInvalid(true).build();
    sheet.getRange('F4:F2000').setDataValidation(artRule);
  }
}

function applyBruchNeuConditionalFormatting(sheet) {
  const statusRange = sheet.getRange('L4:L2000');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('GUELTIG')
      .setBackground('#1C2E22').setFontColor('#6EE7B7').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('PREIS_OFFEN')
      .setBackground('#2E2619').setFontColor('#FDE047').setBold(true)
      .setRanges([statusRange]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function handleBruchNeuEdit(sheet, row, col) {
  if (row < 4) return;
  
  if (col === 2) {
    const dateVal = sheet.getRange(row, 2).getValue();
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const ym = Utilities.formatDate(dateVal, 'Europe/Berlin', 'yyyy-MM');
      const kw = 'KW ' + Utilities.formatDate(dateVal, 'Europe/Berlin', 'w');
      sheet.getRange(row, 3).setValue(kw);
      sheet.getRange(row, 14).setValue(ym);
      const currId = sheet.getRange(row, 1).getValue();
      if (!currId) {
        const id = 'BR-' + ym.replace('-', '') + '-' + String(row - 3).padStart(4, '0');
        sheet.getRange(row, 1).setValue(id);
      }
    }
  }

  if (col === 6 || col === 7) {
    const artikel = String(sheet.getRange(row, 6).getValue() || '').trim();
    const qty = parseInt(sheet.getRange(row, 7).getValue(), 10) || 0;
    
    if (artikel) {
      const catMap = getBruchCatalogMap();
      const info = catMap[artikel.toLowerCase()];
      
      sheet.getRange(row, 8).setValue('Stk');
      if (info && info.price > 0) {
        sheet.getRange(row, 9).setValue(info.price);
        sheet.getRange(row, 10).setValue(Math.round(qty * info.price * 100) / 100);
        sheet.getRange(row, 12).setValue('GUELTIG');
      } else {
        sheet.getRange(row, 12).setValue('⚠️ ARTIKEL_NEU_PREIS_OFFEN');
      }
    }
  }
}

function syncBruchPricesWithCatalog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
  const ui = SpreadsheetApp.getUi();
  if (!sheet || sheet.getLastRow() < 4) {
    if (ui) ui.alert('Hinweis', 'In der Bruchtabelle sind noch keine Buchungen vorhanden.', ui.ButtonSet.OK);
    return;
  }

  const catMap = getBruchCatalogMap(ss);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(4, 1, lastRow - 3, 14).getValues();
  let updatedCount = 0;
  let totalLossSum = 0;

  for (let i = 0; i < data.length; i++) {
    const art = String(data[i][5] || '').trim().toLowerCase();
    const qty = parseInt(data[i][6], 10) || 0;
    const info = catMap[art];

    if (info && info.price > 0) {
      const loss = Math.round(qty * info.price * 100) / 100;
      sheet.getRange(4 + i, 8).setValue('Stk');
      sheet.getRange(4 + i, 9).setValue(info.price);
      sheet.getRange(4 + i, 10).setValue(loss);
      sheet.getRange(4 + i, 12).setValue('GUELTIG');
      totalLossSum += loss;
      updatedCount++;
    }
  }

  refreshBruchCatalogDropdown(sheet);

  if (ui) {
    ui.alert(
      'Bruchliste synchronisiert',
      `Erfolgreich ${updatedCount} Einträge mit den aktuellen Katalogpreisen aktualisiert.\n\n` +
      `Gesamter monetärer Bruchwert: ${totalLossSum.toFixed(2)} €`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Backend-Funktion für die Web-App Brucherfassung
 */
function saveTabletBruchEntry(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
    if (!sheet) {
      setupBruchNeuSheet(ss);
      sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
    }

    // 1. Pflichtfeld-Prüfung
    const employee = (formData.employee || '').trim();
    const artikel = (formData.article || '').trim();
    const station = (formData.station || '').trim();
    const qty = parseInt(formData.quantity, 10) || 0;
    const reason = (formData.reason || '').trim();
    const note = (formData.note || '').trim();
    const customPrice = parseFloat(formData.customPrice) || 0;

    if (!employee) throw new Error('Mitarbeiter / Name ist ein Pflichtfeld.');
    if (!station) throw new Error('Bereich / Station ist ein Pflichtfeld.');
    if (!artikel) throw new Error('Artikel (Glas/Geschirr) ist ein Pflichtfeld.');
    if (qty <= 0) throw new Error('Menge muss mindestens 1 Stück sein.');
    if (!reason) throw new Error('Grund für Bruch ist ein Pflichtfeld.');

    // 2. Datum & Zeitstempel
    const dateStr = formData.date || Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
    const dateObj = new Date(dateStr + 'T12:00:00');
    const ym = Utilities.formatDate(dateObj, 'Europe/Berlin', 'yyyy-MM');
    const kw = 'KW ' + Utilities.formatDate(dateObj, 'Europe/Berlin', 'w');

    // 3. Preis ermitteln
    const catMap = getBruchCatalogMap(ss);
    const info = catMap[artikel.toLowerCase()];
    let price = 0;
    let status = '⚠️ ARTIKEL_NEU_PREIS_OFFEN';

    if (info && info.price > 0) {
      price = info.price;
      status = 'GUELTIG';
    } else if (customPrice > 0) {
      price = customPrice;
      status = 'GUELTIG';
    }

    const totalLoss = Math.round(qty * price * 100) / 100;

    // 4. Zeile schreiben
    const nextRow = Math.max(sheet.getLastRow() + 1, 4);
    const entryId = 'BR-' + ym.replace('-', '') + '-' + String(nextRow - 3).padStart(4, '0');

    const rowData = [
      entryId,
      dateObj,
      kw,
      employee,
      station,
      artikel,
      qty,
      'Stk',
      price,
      totalLoss,
      reason,
      status,
      note,
      ym
    ];

    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(nextRow, 2).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(nextRow, 7).setNumberFormat('#,##0');
    sheet.getRange(nextRow, 9, 1, 2).setNumberFormat('[$€-de-DE] #,##0.00');

    return {
      success: true,
      entryId: entryId,
      article: artikel,
      quantity: qty,
      totalLoss: totalLoss,
      station: station
    };

  } catch(err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Liefert das responsive HTML/CSS/JS Interface im exklusiven SONA Design
 */
function getBruchTabletHtmlContent() {
  const catMap = getBruchCatalogMap();
  const catalogList = Object.values(catMap).sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #121110; margin: 0; padding: 12px; color: #F5EBE1; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
        .container { width: 100%; max-width: 520px; background: #1C1A18; border-radius: 16px; padding: 22px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); border: 1.5px solid #38332D; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #38332D; padding-bottom: 14px; margin-bottom: 18px; }
        .header h2 { margin: 0; color: #F5EBE1; font-size: 1.35rem; display: flex; align-items: center; gap: 8px; font-weight: 800; letter-spacing: 0.5px; }
        .badge { font-size: 0.8rem; background: #2E271F; color: #D4AF37; padding: 5px 12px; border-radius: 8px; font-weight: 800; border: 1px solid #5C4826; letter-spacing: 0.5px; }
        .form-row { margin-bottom: 14px; position: relative; }
        label { display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.88rem; color: #D9CDBF; }
        label .req { color: #E06A55; margin-left: 2px; }
        input, select, textarea { width: 100%; padding: 12px 14px; border: 2px solid #453D34; border-radius: 10px; font-size: 1rem; background: #272421; color: #F5EBE1; transition: all 0.15s; }
        input::placeholder, textarea::placeholder { color: #8A7E70; opacity: 1; }
        input:focus, select:focus, textarea:focus { border-color: #C5A059; outline: none; box-shadow: 0 0 0 4px rgba(197, 160, 89, 0.25); background: #2D2A26; }
        .input-error { border-color: #E06A55 !important; background-color: #2D1E1C !important; }
        .error-hint { color: #F87171; font-size: 0.78rem; font-weight: 700; margin-top: 4px; display: none; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .new-product-box { background: #27221A; border: 1.5px solid #6E5325; border-radius: 10px; padding: 12px; margin-top: 8px; display: none; font-size: 0.85rem; color: #E5C378; }
        .preview-box { background: #24201B; border: 2px dashed #C5A059; border-radius: 12px; padding: 15px; text-align: center; margin: 18px 0; }
        .preview-title { font-size: 0.8rem; font-weight: 800; color: #C5A059; letter-spacing: 0.8px; }
        .preview-amount { font-size: 1.85rem; font-weight: 900; color: #F5EBE1; margin-top: 3px; }
        .btn-submit { width: 100%; padding: 16px; background: linear-gradient(135deg, #C5A059 0%, #8C6239 100%); color: #FFFFFF; border: none; border-radius: 12px; font-size: 1.15rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.15s; box-shadow: 0 4px 16px rgba(197,160,89,0.35); }
        .btn-submit:hover { background: linear-gradient(135deg, #D4AF37 0%, #9B783E 100%); transform: translateY(-1px); }
        .btn-submit:disabled { background: #35302A; color: #73695D; cursor: not-allowed; transform: none; box-shadow: none; }
        .status-msg { margin-top: 14px; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.95rem; text-align: center; display: none; }
        .status-msg.success { background: #182C1F; color: #6EE7B7; display: block; border: 1.5px solid #285437; }
        .status-msg.error { background: #301B1B; color: #FCA5A5; display: block; border: 1.5px solid #662B2B; }

        /* Sona Success Modal Popup */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); display: none; justify-content: center; align-items: center; z-index: 9999; padding: 16px; animation: modalFadeIn 0.2s ease-out; }
        .modal-card { width: 100%; max-width: 440px; background: #1C1A18; border: 2px solid #C5A059; border-radius: 18px; padding: 24px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.85); animation: modalSlideUp 0.25s ease-out; }
        .modal-icon { font-size: 3rem; margin-bottom: 6px; }
        .modal-title { margin: 0 0 16px 0; color: #D4AF37; font-size: 1.35rem; font-weight: 800; letter-spacing: 0.8px; }
        .modal-details { background: #25221D; border: 1px solid #453D34; border-radius: 12px; padding: 14px; margin-bottom: 20px; text-align: left; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #352F28; font-size: 0.92rem; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row .lbl { color: #A89B8C; font-weight: 600; }
        .detail-row .val { color: #F5EBE1; font-weight: 700; }
        .detail-row .pop-price { color: #E5C378; font-size: 1.2rem; font-weight: 900; }
        .detail-row .pop-id { color: #D9CDBF; font-family: monospace; font-size: 0.85rem; }
        .btn-new-entry { width: 100%; padding: 16px; background: linear-gradient(135deg, #C5A059 0%, #8C6239 100%); color: #FFFFFF; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(197,160,89,0.4); transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-new-entry:hover { background: linear-gradient(135deg, #D4AF37 0%, #9B783E 100%); transform: translateY(-1px); }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>💥 BRUCHERFASSUNG</h2>
          <span class="badge">SONA Karli</span>
        </div>

        <form id="bruchForm" onsubmit="submitBruchEntry(event)">
          <div class="grid-2">
            <div class="form-row">
              <label>📅 Datum <span class="req">*</span></label>
              <input type="date" id="entryDate" value="${todayStr}" required onchange="validateFields()">
              <div id="errDate" class="error-hint">Datum erforderlich</div>
            </div>
            <div class="form-row">
              <label>👤 Mitarbeiter <span class="req">*</span></label>
              <input type="text" id="employeeInput" placeholder="Name / Kürzel (z. B. Nate, Minh, Julian)" required oninput="validateFields()">
              <div id="errEmployee" class="error-hint">Name eingeben</div>
            </div>
          </div>

          <div class="form-row">
            <label>📍 Bereich / Station <span class="req">*</span></label>
            <select id="stationSelect" required onchange="validateFields()">
              <option value="">-- Station wählen --</option>
              ${BRUCH_STATIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <div id="errStation" class="error-hint">Bitte Station wählen</div>
          </div>

          <div class="form-row">
            <label>🍷 Bruch-Artikel (Glas / Geschirr) <span class="req">*</span></label>
            <input list="catalogList" id="articleInput" placeholder="Tippen zum Suchen (z. B. Weinglas, Nachtmann, Teeglas)..." oninput="handleArticleChange()" required autocomplete="off">
            <datalist id="catalogList">
              ${catalogList.map(item => `<option value="${item.name}">${item.name} (${item.price.toFixed(2)} € / Stk)</option>`).join('')}
            </datalist>
            <div id="errArticle" class="error-hint">Artikel erforderlich</div>

            <div id="newProductBox" class="new-product-box">
              ⚠️ <b>Anderer Bruch-Artikel (nicht im Katalog):</b>
              <div style="margin-top: 6px;">
                <label style="font-size: 0.8rem; font-weight: normal;">Geschätzter Einzelpreis Netto (€ / Stk):</label>
                <input type="number" step="0.01" id="customPriceInput" placeholder="z. B. 4.50" oninput="calculateLivePreview()" style="margin-top: 4px; padding: 8px 10px;">
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-row">
              <label>🔢 Anzahl (Stück) <span class="req">*</span></label>
              <input type="number" step="1" min="1" id="quantityInput" placeholder="z. B. 1 oder 2" value="1" required oninput="handleQuantityChange()">
              <div id="errQuantity" class="error-hint">Menge >= 1 erforderlich</div>
            </div>
            <div class="form-row">
              <label>📏 Einheit</label>
              <input type="text" id="unitInput" value="Stück (Stk)" readonly style="background: #201D1A; color: #A89B8C; cursor: not-allowed;">
            </div>
          </div>

          <div class="form-row">
            <label>⚠️ Grund für Bruch (PFLICHTFELD) <span class="req">*</span></label>
            <select id="reasonSelect" required onchange="validateFields()">
              <option value="">-- Bruchgrund wählen --</option>
              ${BRUCH_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
            <div id="errReason" class="error-hint">Bitte Bruchgrund wählen</div>
          </div>

          <div class="form-row">
            <label>📝 Bemerkung / Maßnahme (optional)</label>
            <input type="text" id="noteInput" placeholder="z. B. Im Service am 4er Tisch, Spülkorb nachbestellen...">
          </div>

          <div class="preview-box">
            <div class="preview-title">BERECHNETER BRUCH-SCHADEN</div>
            <div class="preview-amount" id="previewAmount">0,00 €</div>
            <div id="previewDetails" style="font-size: 0.8rem; color: #A89B8C; margin-top: 4px;">Bitte alle Pflichtfelder ausfüllen</div>
          </div>

          <button type="submit" class="btn-submit" id="submitBtn">
            <span>💥 BRUCH JETZT BUCHEN</span>
          </button>
          <div id="statusMsg" class="status-msg"></div>
        </form>
      </div>

      <!-- Sona Success Modal -->
      <div id="successModal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-icon">✨</div>
          <h3 class="modal-title">ERFOLGREICH GEBUCHT</h3>
          <div class="modal-details">
            <div class="detail-row"><span class="lbl">Artikel / Glas:</span> <span class="val" id="popArticle">-</span></div>
            <div class="detail-row"><span class="lbl">Stückzahl:</span> <span class="val" id="popQty">-</span></div>
            <div class="detail-row"><span class="lbl">Bruchschaden:</span> <span class="val pop-price" id="popLoss">0,00 €</span></div>
            <div class="detail-row"><span class="lbl">Eintrags-ID:</span> <span class="val pop-id" id="popId">-</span></div>
            <div class="detail-row"><span class="lbl">Station:</span> <span class="val" id="popStation">-</span></div>
          </div>
          <button type="button" class="btn-new-entry" onclick="closeSuccessModalAndReset()">
            <span>➕ NEUEN BRUCH EINTRAGEN</span>
          </button>
        </div>
      </div>

      <script>
        const catalogItems = ${JSON.stringify(catalogList)};

        // Mitarbeiterfeld immer sauber leer initialisieren
        window.addEventListener('DOMContentLoaded', () => {
          document.getElementById('employeeInput').value = '';
          validateFields();
          calculateLivePreview();
        });

        function handleArticleChange() {
          const artName = (document.getElementById('articleInput').value || '').trim().toLowerCase();
          const newBox = document.getElementById('newProductBox');
          
          if (!artName) {
            newBox.style.display = 'none';
            validateFields();
            return;
          }

          let matched = catalogItems.find(i => i.name.toLowerCase() === artName || i.name.toLowerCase().includes(artName));
          if (!matched) {
            newBox.style.display = 'block';
          } else {
            newBox.style.display = 'none';
          }
          validateFields();
          calculateLivePreview();
        }

        function handleQuantityChange() {
          validateFields();
          calculateLivePreview();
        }

        function validateFields() {
          const dateVal = document.getElementById('entryDate').value;
          const empVal = (document.getElementById('employeeInput').value || '').trim();
          const stationVal = document.getElementById('stationSelect').value;
          const artVal = (document.getElementById('articleInput').value || '').trim();
          const qtyVal = parseInt(document.getElementById('quantityInput').value, 10) || 0;
          const reasonVal = document.getElementById('reasonSelect').value;

          let valid = true;

          toggleError('entryDate', 'errDate', !dateVal);
          toggleError('employeeInput', 'errEmployee', !empVal);
          toggleError('stationSelect', 'errStation', !stationVal);
          toggleError('articleInput', 'errArticle', !artVal);
          toggleError('quantityInput', 'errQuantity', qtyVal <= 0);
          toggleError('reasonSelect', 'errReason', !reasonVal);

          if (!dateVal || !empVal || !stationVal || !artVal || qtyVal <= 0 || !reasonVal) {
            valid = false;
          }

          document.getElementById('submitBtn').disabled = !valid;
          return valid;
        }

        function toggleError(inputId, errId, hasError) {
          const input = document.getElementById(inputId);
          const err = document.getElementById(errId);
          if (hasError) {
            input.classList.add('input-error');
            if (err) err.style.display = 'block';
          } else {
            input.classList.remove('input-error');
            if (err) err.style.display = 'none';
          }
        }

        function calculateLivePreview() {
          const artName = (document.getElementById('articleInput').value || '').trim().toLowerCase();
          const qty = parseInt(document.getElementById('quantityInput').value, 10) || 0;
          const customPrice = parseFloat(document.getElementById('customPriceInput').value) || 0;

          if (!artName || qty <= 0) {
            document.getElementById('previewAmount').innerText = '0,00 €';
            document.getElementById('previewDetails').innerText = 'Bitte alle Pflichtfelder ausfüllen';
            return;
          }

          let matched = catalogItems.find(i => i.name.toLowerCase() === artName || i.name.toLowerCase().includes(artName));
          if (!matched) {
            if (customPrice > 0) {
              const loss = Math.round(qty * customPrice * 100) / 100;
              document.getElementById('previewAmount').innerText = loss.toFixed(2) + ' €';
              document.getElementById('previewDetails').innerText = qty + ' Stk × ' + customPrice.toFixed(2) + ' € (Neuer Artikel)';
            } else {
              document.getElementById('previewAmount').innerText = 'Preis offen';
              document.getElementById('previewDetails').innerText = '⚠️ Neuer Artikel: Wird zur Nachkalkulation verbucht';
            }
            return;
          }

          const loss = Math.round(qty * matched.price * 100) / 100;
          document.getElementById('previewAmount').innerText = loss.toFixed(2) + ' €';
          document.getElementById('previewDetails').innerText = qty + ' Stk × ' + matched.price.toFixed(2) + ' € (' + matched.name + ')';
        }

        function submitBruchEntry(e) {
          e.preventDefault();
          if (!validateFields()) return;

          const btn = document.getElementById('submitBtn');
          const msg = document.getElementById('statusMsg');
          btn.disabled = true;
          btn.innerHTML = '<span>⏳ Buche Bruch...</span>';
          msg.style.display = 'none';

          const emp = document.getElementById('employeeInput').value.trim();

          const payload = {
            date: document.getElementById('entryDate').value,
            employee: emp,
            station: document.getElementById('stationSelect').value,
            article: document.getElementById('articleInput').value.trim(),
            quantity: document.getElementById('quantityInput').value,
            customPrice: document.getElementById('customPriceInput') ? document.getElementById('customPriceInput').value : 0,
            reason: document.getElementById('reasonSelect').value,
            note: document.getElementById('noteInput').value.trim()
          };

          google.script.run
            .withSuccessHandler(function(res) {
              btn.disabled = false;
              btn.innerHTML = '<span>💥 BRUCH JETZT BUCHEN</span>';
              if (res.success) {
                document.getElementById('popArticle').innerText = res.article;
                document.getElementById('popQty').innerText = res.quantity + ' Stk';
                document.getElementById('popLoss').innerText = res.totalLoss.toFixed(2) + ' €';
                document.getElementById('popId').innerText = res.entryId;
                document.getElementById('popStation').innerText = payload.station;

                document.getElementById('successModal').style.display = 'flex';
              } else {
                msg.className = 'status-msg error';
                msg.innerText = '❌ ' + res.error;
              }
            })
            .withFailureHandler(function(err) {
              btn.disabled = false;
              btn.innerHTML = '<span>💥 BRUCH JETZT BUCHEN</span>';
              msg.className = 'status-msg error';
              msg.innerText = '❌ Verbindungsfehler: ' + err.toString();
            })
            .saveTabletBruchEntry(payload);
        }

        function closeSuccessModalAndReset() {
          document.getElementById('successModal').style.display = 'none';
          document.getElementById('employeeInput').value = '';
          document.getElementById('articleInput').value = '';
          document.getElementById('quantityInput').value = '1';
          document.getElementById('noteInput').value = '';
          document.getElementById('reasonSelect').value = '';
          if (document.getElementById('customPriceInput')) document.getElementById('customPriceInput').value = '';
          document.getElementById('newProductBox').style.display = 'none';
          document.getElementById('previewAmount').innerText = '0,00 €';
          document.getElementById('previewDetails').innerText = 'Bitte alle Pflichtfelder ausfüllen';
          validateFields();
          document.getElementById('employeeInput').focus();
        }
      </script>
    </body>
    </html>
  `;
}

function showBruchTabletDialog() {
  const html = getBruchTabletHtmlContent();
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(560)
    .setHeight(680)
    .setTitle('💥 BRUCHERFASSUNG — SONA Karli');
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💥 BRUCHERFASSUNG — SONA Karli');
}

/**
 * Wöchentlicher Controlling-Bericht für Bruch
 */
function showWeeklyBruchReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
  const ui = SpreadsheetApp.getUi();
  if (!sheet || sheet.getLastRow() < 4) {
    if (ui) ui.alert('Keine Daten', 'Es liegen noch keine Bruchbuchungen in BRUCH_NEU vor.', ui.ButtonSet.OK);
    return;
  }

  const data = sheet.getRange(4, 1, sheet.getLastRow() - 3, 14).getValues();
  let totalLoss = 0;
  let totalPieces = 0;
  const kwStats = {};
  const stationStats = {};
  const reasonStats = {};

  data.forEach(r => {
    const kw = String(r[2] || 'KW Unbekannt');
    const station = String(r[4] || 'Sonstige');
    const pieces = parseInt(r[6], 10) || 0;
    const loss = parseFloat(r[9]) || 0;
    const reason = String(r[10] || 'Sonstiges');

    totalLoss += loss;
    totalPieces += pieces;
    kwStats[kw] = (kwStats[kw] || 0) + loss;
    stationStats[station] = (stationStats[station] || 0) + loss;
    reasonStats[reason] = (reasonStats[reason] || 0) + loss;
  });

  let msg = `📊 WÖCHENTLICHER BRUCH-BERICHT (${BRUCH_CONFIG.LOCATION_NAME})\n\n`;
  msg += `GESAMTER BRUCHSCHADEN: ${totalLoss.toFixed(2)} € (${totalPieces} Stück)\n\n`;
  
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

  if (ui) ui.alert('Bruch-Controlling Report', msg, ui.ButtonSet.OK);
}

/**
 * Synchronisiert wöchentlich aggregierte Bruchdaten in das zentrale SONA Hub
 */
function syncBruchDataToSonaHub() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch(e) {}

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName(BRUCH_CONFIG.NAME_BRUCH_SHEET);
    if (!sourceSheet || sourceSheet.getLastRow() < 4) {
      if (ui) ui.alert('Keine Daten', 'In ' + BRUCH_CONFIG.NAME_BRUCH_SHEET + ' liegen noch keine Buchungen vor.', ui.ButtonSet.OK);
      return;
    }

    const rawData = sourceSheet.getRange(4, 1, sourceSheet.getLastRow() - 3, 14).getValues();
    const kwMap = {};
    let totalAllLoss = 0;
    let totalAllPieces = 0;

    const catMap = getBruchCatalogMap(ss);

    rawData.forEach(r => {
      const art = String(r[5] || '').trim();
      if (!art) return;

      const ym = String(r[13] || '2026-08');
      const kw = String(r[2] || 'KW 01');
      const kwKey = ym.substring(0, 4) + '-' + kw;
      const employee = String(r[3] || '').trim();
      const station = String(r[4] || 'Sonstige').trim();
      const qty = parseInt(r[6], 10) || 0;
      const loss = parseFloat(r[9]) || 0;
      const reason = String(r[10] || 'Sonstiges').trim();

      totalAllLoss += loss;
      totalAllPieces += qty;

      if (!kwMap[kwKey]) {
        kwMap[kwKey] = {
          location: BRUCH_CONFIG.LOCATION_NAME,
          kwKey: kwKey,
          year: ym.substring(0, 4),
          kw: kw,
          totalLoss: 0,
          totalPieces: 0,
          glasLoss: 0,
          geschirrLoss: 0,
          zubehoerLoss: 0,
          bookingCount: 0,
          employees: new Set(),
          stationLosses: {},
          reasonLosses: {},
          articleLosses: {}
        };
      }

      const obj = kwMap[kwKey];
      obj.totalLoss += loss;
      obj.totalPieces += qty;
      obj.bookingCount++;
      if (employee) obj.employees.add(employee);

      const info = catMap[art.toLowerCase()];
      const cat = info ? info.cat : 'Glas';

      if (cat === 'Glas' || cat === 'Karaffe' || cat === 'Flasche') {
        obj.glasLoss += loss;
      } else if (cat === 'Geschirr' || cat === 'Besteck') {
        obj.geschirrLoss += loss;
      } else {
        obj.zubehoerLoss += loss;
      }

      obj.stationLosses[station] = (obj.stationLosses[station] || 0) + loss;
      obj.reasonLosses[reason] = (obj.reasonLosses[reason] || 0) + loss;
      obj.articleLosses[art] = (obj.articleLosses[art] || 0) + loss;
    });

    const nowStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');

    const summaryRows = Object.values(kwMap).map(kwObj => {
      let topStation = '-', maxStationLoss = -1;
      for (const [st, val] of Object.entries(kwObj.stationLosses)) {
        if (val > maxStationLoss) { maxStationLoss = val; topStation = st; }
      }

      let topReason = '-', maxReasonLoss = -1;
      for (const [re, val] of Object.entries(kwObj.reasonLosses)) {
        if (val > maxReasonLoss) { maxReasonLoss = val; topReason = re; }
      }

      let topArticle = '-', maxArtLoss = -1;
      for (const [art, val] of Object.entries(kwObj.articleLosses)) {
        if (val > maxArtLoss) { maxArtLoss = val; topArticle = art + ` (${val.toFixed(2)} €)`; }
      }

      return [
        kwObj.location,
        kwObj.kwKey,
        kwObj.year,
        kwObj.kw,
        Math.round(kwObj.totalLoss * 100) / 100,
        kwObj.totalPieces,
        Math.round(kwObj.glasLoss * 100) / 100,
        Math.round(kwObj.geschirrLoss * 100) / 100,
        Math.round(kwObj.zubehoerLoss * 100) / 100,
        topStation,
        topReason,
        topArticle,
        kwObj.bookingCount,
        Array.from(kwObj.employees).join(', '),
        nowStr
      ];
    });

    summaryRows.sort((a, b) => b[1].localeCompare(a[1], 'de'));

    // Sona Hub öffnen & befüllen
    const hubSs = SpreadsheetApp.openById(BRUCH_CONFIG.SONA_HUB_SPREADSHEET_ID);
    
    // Weekly Tab
    let hubWeeklySheet = hubSs.getSheetByName(BRUCH_CONFIG.SONA_HUB_TAB_WEEKLY);
    if (!hubWeeklySheet) {
      hubWeeklySheet = hubSs.insertSheet(BRUCH_CONFIG.SONA_HUB_TAB_WEEKLY);
    }
    hubWeeklySheet.clear();

    hubWeeklySheet.getRange('A1:O1').merge()
      .setValue('🏢 SONA HUB — WÖCHENTLICHES BRUCH-CONTROLLING (STANDORT: ' + BRUCH_CONFIG.LOCATION_NAME.toUpperCase() + ')')
      .setFontWeight('bold')
      .setFontSize(13)
      .setBackground('#1C1A18')
      .setFontColor('#D4AF37')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    hubWeeklySheet.setRowHeight(1, 40);

    const weeklyHeaders = [
      'Standort', 'Jahr_KW', 'Jahr', 'Kalenderwoche', 'Gesamt-Bruchwert (€)', 
      'Bruchmenge (Stück)', 'Verlust Gläser (€)', 'Verlust Geschirr/Besteck (€)', 
      'Verlust Zubehör (€)', 'Haupt-Bruchstation', 'Haupt-Bruchgrund', 
      'Top-Bruchartikel', 'Anzahl Buchungen', 'Erfasste Mitarbeiter', 'Letzte Synchronisation'
    ];

    hubWeeklySheet.getRange(3, 1, 1, weeklyHeaders.length).setValues([weeklyHeaders]);
    hubWeeklySheet.getRange('A3:O3').setFontWeight('bold').setBackground('#2A2621').setFontColor('#F5EBE1').setHorizontalAlignment('center').setWrap(true);
    hubWeeklySheet.setRowHeight(3, 38);
    hubWeeklySheet.setFrozenRows(3);

    if (summaryRows.length > 0) {
      hubWeeklySheet.getRange(4, 1, summaryRows.length, weeklyHeaders.length).setValues(summaryRows);
      hubWeeklySheet.getRange(4, 5, summaryRows.length, 1).setNumberFormat('[$€-de-DE] #,##0.00');
      hubWeeklySheet.getRange(4, 6, summaryRows.length, 1).setNumberFormat('#,##0');
      hubWeeklySheet.getRange(4, 7, summaryRows.length, 3).setNumberFormat('[$€-de-DE] #,##0.00');
      hubWeeklySheet.getRange(4, 1, summaryRows.length, 4).setHorizontalAlignment('center');
      hubWeeklySheet.getRange(4, 13, summaryRows.length, 1).setHorizontalAlignment('center');
      hubWeeklySheet.getRange(4, 15, summaryRows.length, 1).setHorizontalAlignment('center');
    }
    hubWeeklySheet.autoResizeColumns(1, weeklyHeaders.length);

    // Rohdaten-Tab
    let hubRawSheet = hubSs.getSheetByName(BRUCH_CONFIG.SONA_HUB_TAB_RAW);
    if (!hubRawSheet) {
      hubRawSheet = hubSs.insertSheet(BRUCH_CONFIG.SONA_HUB_TAB_RAW);
    }
    hubRawSheet.clear();

    hubRawSheet.getRange('A1:N1').merge()
      .setValue('📋 SONA HUB — BRUCH ROHDATEN LIVE-SPIEGEL (STANDORT: ' + BRUCH_CONFIG.LOCATION_NAME.toUpperCase() + ')')
      .setFontWeight('bold')
      .setFontSize(13)
      .setBackground('#1C1A18')
      .setFontColor('#D4AF37')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    hubRawSheet.setRowHeight(1, 40);

    const rawHeaders = [
      'Eintrags-ID', 'Datum', 'KW', 'Erfasst von (Mitarbeiter)', 'Bereich / Station', 
      'Bruch-Artikel / Glas / Geschirr', 'Menge (Stück)', 'Einheit', 
      'Listenpreis Netto (€ / Stk)', 'Gesamt-Bruchwert Netto (€)', 
      'Bruchgrund / Ursache', 'Status Preis', 'Bemerkung / Maßnahme', 'Jahr_Monat'
    ];

    hubRawSheet.getRange(3, 1, 1, rawHeaders.length).setValues([rawHeaders]);
    hubRawSheet.getRange('A3:N3').setFontWeight('bold').setBackground('#2A2621').setFontColor('#F5EBE1').setHorizontalAlignment('center').setWrap(true);
    hubRawSheet.setRowHeight(3, 38);
    hubRawSheet.setFrozenRows(3);

    if (rawData.length > 0) {
      hubRawSheet.getRange(4, 1, rawData.length, rawHeaders.length).setValues(rawData);
      hubRawSheet.getRange('B4:B' + (rawData.length + 3)).setNumberFormat('dd.MM.yyyy');
      hubRawSheet.getRange('G4:G' + (rawData.length + 3)).setNumberFormat('#,##0');
      hubRawSheet.getRange('I4:J' + (rawData.length + 3)).setNumberFormat('[$€-de-DE] #,##0.00');
    }
    hubRawSheet.autoResizeColumns(1, rawHeaders.length);

    const successInfo = 
      `Erfolgreich synchronisiert mit SONA Hub!\n\n` +
      `🏢 Hub-ID: ${BRUCH_CONFIG.SONA_HUB_SPREADSHEET_ID}\n` +
      `📊 Synchronisierte Kalenderwochen: ${summaryRows.length}\n` +
      `📋 Übertragene Bruch-Buchungen: ${rawData.length}\n` +
      `💥 Gesamter Bruchschaden: ${totalAllLoss.toFixed(2)} € (${totalAllPieces} Stk)\n\n` +
      `Reiter im Hub aktualisiert:\n` +
      `• ${BRUCH_CONFIG.SONA_HUB_TAB_WEEKLY} (Wochen-Zusammenfassung)\n` +
      `• ${BRUCH_CONFIG.SONA_HUB_TAB_RAW} (Live-Rohdaten)`;

    Logger.log(successInfo);
    if (ui) ui.alert('🚀 SONA Hub Synchronisation', successInfo, ui.ButtonSet.OK);

  } catch(err) {
    Logger.log('Fehler bei Hub-Synchronisation: ' + err.toString());
    if (ui) ui.alert('Fehler bei Hub-Synchronisation', err.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Automatik-Trigger (jeden Montag um 02:00 Uhr)
 */
function setupAutomaticBruchHubSync() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch(e) {}

  try {
    const functionName = 'syncBruchDataToSonaHub';
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(t);
      }
    });

    ScriptApp.newTrigger(functionName)
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(2)
      .create();

    const msg = 
      `Der automatische Wöchentliche Bruch-Hub-Sync wurde eingerichtet!\n\n` +
      `⏰ Rhythmus: Jeden Montag um 02:00 Uhr\n` +
      `🎯 Ziel: SONA Hub (${BRUCH_CONFIG.SONA_HUB_SPREADSHEET_ID})`;

    if (ui) ui.alert('⏰ Automatik-Trigger aktiv', msg, ui.ButtonSet.OK);
  } catch(e) {
    if (ui) ui.alert('Fehler bei Trigger-Erstellung', e.toString(), ui.ButtonSet.OK);
  }
}
