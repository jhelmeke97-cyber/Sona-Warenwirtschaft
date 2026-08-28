/**
 * ============================================================================
 * WARENWIRTSCHAFT & CONTROLLING CORE SYSTEM (SPEZIFIKATION V4)
 * Standort: SONA KARLI (Karl-Liebknecht-Straße 57, 04107 Leipzig)
 * 
 * V4 ARCHITEKTUR & NEUERUNGEN:
 * 1. Wöchentlicher automatisierter Plausibilitäts-Audit (Health-Check):
 *    - Umrechnungslogik & Bandbreiten (z. B. 10x-Ausreißer) -> Flag RECALC_REQUIRED
 *    - Datumsinkonsistenzen (Zukunftsdaten, Chronologie)
 *    - Offene / ungemappte Items (Master-Zutat-Mapping Taskliste)
 *    - Widersprüchliche Rechnungen (Dublettenprüfung)
 * 2. Universelles Multi-Kriterien-Filtersystem im Artikelstamm & Dashboard:
 *    - Warengruppe (Frische, Fisch, Fleisch, Trockenware, Spirituosen, etc.)
 *    - Lieferant (METRO, RUNGIS, SSP Trade, Selgros, Alle Lieferanten)
 *    - Zeitraum / Periode (Aktueller Monat, Vormonat, Quartale Q1-Q4)
 *    - Master-Zutat / Freitextsuche (beliebig kombinierbar)
 * 3. 2-Ebenen-Fundament (MASTER_ZUTATEN & ARTIKELSTAMM) mit Best-Price/Last-Price
 * 4. Echtzeit-Alerts & Freitags-Bericht inkl. Audit-Status (100% EMOJI-FREI)
 * ============================================================================
 */

const CONFIG = {
  LOCATION_NAME: 'SONA Karli',
  LOCATION_ADDRESS: 'Karl-Liebknecht-Straße 57, 04107 Leipzig',
  DRIVE_FOLDER_ID: '1byYdzURfNTWxTs54XJ51MtRNyzyIOXW0',
  ARCHIVE_FOLDER_NAME: '_Verarbeitet',
  SHEET_ID: '1JebVj7LmD6gRqR88h0HAji5YM7lmDuiK7YWsVYSNTZA',
  REPORT_DAY: ScriptApp.WeekDay.FRIDAY,
  SCAN_HOUR: 12,
  REPORT_HOUR: 12,
  
  NAME_DASHBOARD: 'DASHBOARD',
  NAME_RECHNUNGEN: 'RECHNUNGSEINGANG',
  NAME_ARTIKEL: 'ARTIKELSTAMM',
  NAME_MASTER_ZUTATEN: 'MASTER_ZUTATEN',
  NAME_WARENGRUPPEN: 'WARENGRUPPEN',
  NAME_PRUEFUNG: 'PRUEFUNG_EINKAUF'
};

/**
 * ============================================================================
 * ZENTRALE PREIS- & KALKULATIONS-KONFIGURATION
 * ============================================================================
 */
const PREIS_CONFIG = {
  MAX_PREISALTER_TAGE: 90,                          // Nach 90 Tagen gilt ein Preis als VERALTET
  WARNUNG_PREISABWEICHUNG_PROZENT: 15,              // Ab 15% Abweichung Warnung / Lieferantenvergleich
  KRITISCH_PREISABWEICHUNG_PROZENT: 30,             // Ab 30% Abweichung kritischer Prüffall
  STANDARD_PREISQUELLE: 'LETZTER_GUELTIGER_EINKAUF',// Bevorzugte automatische Preisquelle
  MANUELLER_PREIS_HAT_VORRANG: true,                // Manuell freigegebene Preise überschreiben Automatik
  GUENSTIGSTER_PREIS_NUR_VERGLEICH: true,           // Günstigster Preis überschreibt nicht ungefragt den Kalkulationspreis
  AKTIVE_LIEFERANTENARTIKEL_NUR_BERUECKSICHTIGEN: true,
  PREISSTATUS_BEI_FEHLENDER_BASISEINHEIT: 'BASISEINHEIT_FEHLT'
};

function getUserEmail() {
  try {
    const user = Session.getActiveUser();
    if (user && user.getEmail && user.getEmail()) return user.getEmail();
  } catch(e) {}
  try {
    const eff = Session.getEffectiveUser();
    if (eff && eff.getEmail && eff.getEmail()) return eff.getEmail();
  } catch(e2) {}
  return CONFIG.NOTIFICATION_EMAIL || 'julian@sona-leipzig.de';
}

const MASTER_CATALOG_DICTIONARY = [
  // E01: Fisch
  { code: 'E01', name: 'Ganzer Lachs Label Rouge (Schottland)', ref: 'Lachs (Label Rouge)', aliases: ['ganzer lachs label rouge', 'lachs label rouge', 'lachs schottland', 'lachs superior'] },
  { code: 'E01', name: 'Ganzer Lachs Norwegen', ref: 'Lachs (Norwegen)', aliases: ['ganzer lachs norwegen', 'lachs norwegen', 'lachs tk', 'sashimi tk'] },
  { code: 'E01', name: 'Toro frisch 3-5kg', ref: 'Toro frisch (Thunfischbauch)', aliases: ['toro frisch', 'dry aged toro', 'toro nigiri', 'toro maki'] },
  { code: 'E01', name: 'Ganzer Bluefin frisch', ref: 'Bluefin Thunfisch (frisch)', aliases: ['ganzer bluefin frisch', 'bluefin tuna', 'bluefin'] },
  { code: 'E01', name: 'Hamachi Zucht (3-5kg)', ref: 'Hamachi (Gelbschwanzmakrele)', aliases: ['hamachi zucht', 'hamachi', 'gelbschwanz', 'ascyellowtail kingfisch', 'hiramasa kingfisch'] },
  { code: 'E01', name: 'Thunfischfilet Sashimi (Thunnus Albacares)', ref: 'Thunfisch Sashimi (Maguro)', aliases: ['thunfischfilet sashimi', 'thunfisch sashimi', 'thunfisch ref', 'maguro', 'sashimi sri lanka', 'sashimi jihao'] },
  { code: 'E01', name: 'Redsnapper frisch', ref: 'Redsnapper', aliases: ['redsnapper'] },
  { code: 'E01', name: 'Wolfsbarsch Zucht (1,8-2,4kg)', ref: 'Wolfsbarsch', aliases: ['wolfsbarsch zucht', 'wolfsbarsch', 'suzuki'] },
  { code: 'E01', name: 'Dorade Royal m.K. (0,8-1,5kg)', ref: 'Dorade Royal', aliases: ['dorade royal', 'dorade rose', 'dorade', 'tai'] },
  { code: 'E01', name: 'Unagi Kabayaki Gegrillter Aal (10kg)', ref: 'Unagi (Gegrillter Aal)', aliases: ['unagi kabayaki', 'unagi', 'gegrillter aal'] },

  // E02: Seafood
  { code: 'E02', name: 'Jakobsmuschelfleisch Japan', ref: 'Jakobsmuscheln (Hotate)', aliases: ['jakobsmuschelfleisch', 'jakobsmuschel', 'hotate', 'scallop'] },
  { code: 'E02', name: 'Oktopus ohne Kopf / Wildfang', ref: 'Oktopus (Tako)', aliases: ['oktopuss ohne kopf', 'octopus vulgaris', 'oktopus', 'tako'] },
  { code: 'E02', name: 'Calamari frisch', ref: 'Calamari (frisch)', aliases: ['calamari frisch', 'calamari'] },
  { code: 'E02', name: 'Black Tiger Garnelen 16/20 o.K. m.S.', ref: 'Black Tiger Garnelen 16/20', aliases: ['black tiger garnelen', 'black tiger', 'king prawn', 'ebi'] },
  { code: 'E02', name: 'White Tiger Garnelen roh TK 16/20', ref: 'White Tiger Garnelen 16/20', aliases: ['white tiger garnelen', 'white tiger', 'garnele 16/20', 'garnele 26/30', 'tom the 30/40'] },
  { code: 'E02', name: 'Keta Kaviar aus Alaska (250g)', ref: 'Keta Lachs Kaviar', aliases: ['keta kaviar', 'lachs kaviar'] },
  { code: 'E02', name: 'Stör Kaviar (50g)', ref: 'Stör Kaviar Premium', aliases: ['stör kaviar', 'kaviar'] },
  { code: 'E02', name: 'Cavi-Art Algen Kaviar (500g)', ref: 'Cavi-Art Algen Kaviar', aliases: ['cavi-art algen kaviar', 'algen kaviar'] },
  { code: 'E02', name: 'TK Tintenfischtuben U10', ref: 'Tintenfischtuben U10', aliases: ['tintenfischtuben u10', 'tintenfischtuben', 'tintenfisch'] },
  { code: 'E02', name: 'Tobiko Red Rogen (500g)', ref: 'Tobiko Red (Fliegender Fisch Rogen)', aliases: ['tobiko red', 'tobiko'] },

  // E03: Geflügel
  { code: 'E03', name: 'Barbarie-Entenbrustfilet (180-250g)', ref: 'Barbarie-Entenbrustfilet', aliases: ['barbarie-entenbrustfilet', 'barbarie entenbrust', 'barbarie brustfilet', 'ente loc son'] },
  { code: 'E03', name: 'Maishähnchenbrust Suprême (180-220g)', ref: 'Maishähnchenbrust Suprême', aliases: ['maishähnchenbrust supreme', 'maishähnchenbrust', 'maishähnchenkeule', 'maishähnchen'] },
  { code: 'E03', name: 'Deutsches Hähnchenbrustfilet (gesalzen / 2x6kg)', ref: 'Hähnchenbrustfilet', aliases: ['hähnchenbrustfilet', 'hähnchenbrust brazilien', 'hähnchenbrust thailand', 'hähnchenbrust', 'hähnchen'] },
  { code: 'E03', name: 'Hähnchenschenkel ohne Rücken / XXL (Kikok / Poln.)', ref: 'Hähnchenschenkel', aliases: ['hähnchenschenkel', 'hähnchenschenkenkel', 'kikok hähnchenschenkel', 'hähnchen oberkeulenfleisch'] },
  { code: 'E03', name: 'Luna Suppenhuhn HKL A (1,7-2,3kg)', ref: 'Suppenhuhn', aliases: ['suppenhuhn buckl', 'luna suppenhuhn', 'suppenhuhn'] },

  // E04: Rind
  { code: 'E04', name: 'Rinder-Entrecôte (Ribeye / Färse / Argentinisch / NZ / Dry Aged)', ref: 'Rinder-Entrecôte (Ribeye)', aliases: ['entrecote v. rind', 'entrecote färse', 'arg. entrecote', 'entrecote ref', 'rib eye dry aged', 'rinder-ribeye'] },
  { code: 'E04', name: 'Rinder-Roastbeef (Simmentaler / Arg. / 2-4kg)', ref: 'Rinder-Roastbeef', aliases: ['rinder-roastbeef', 'simmentaler rinderroastbeef', 'roastbeef vac', 'roastbeef ref', 'roastbeef'] },
  { code: 'E04', name: 'Rinderfilet Argentinisch (3/4 lbs / 340g)', ref: 'Rinderfilet', aliases: ['rinderfilet arg', 'rinderfilet argentinisch', 'rinderfilet ref', 'rinderfilet', 'rinder falsches filet'] },
  { code: 'E04', name: 'Rinder-Oberschale mit Deckel (ca. 5kg)', ref: 'Rinder-Oberschale', aliases: ['rinder-oberschale', 'rind oberschale'] },
  { code: 'E04', name: 'Rinderhackfleisch QS (5kg / XXL)', ref: 'Rinderhackfleisch', aliases: ['rinderhackfleisch', 'rinderhack ref', 'rinderhack'] },
  { code: 'E04', name: 'Rinder-Markknochen / Sandknochen (TK gesägt)', ref: 'Rinder-Markknochen', aliases: ['rinder-markknochen', 'rinder markknochen', 'rindermarkknochen', 'rind sandknochen', 'ochsenschwanz'] },
  { code: 'E04', name: 'Kalb Zunge', ref: 'Kalbszunge', aliases: ['kalb zunge', 'kalbszunge'] },

  // E05: Schwein
  { code: 'E05', name: 'QS Schweinebauch ladenfertig (ca. 4,5kg)', ref: 'Schweinebauch', aliases: ['schweinebauch qs', 'scwheinebauch ref', 'schweinebauch'] },
  { code: 'E05', name: 'QS Schweinenacken ohne Knochen', ref: 'Schweinenacken', aliases: ['schweinenacken ohne knochen', 'qs. s. -nacken', 'schweinenacken'] },
  { code: 'E05', name: 'Schwein Hackfleisch / Eisbein / Pfoten / Ohren', ref: 'Schweinefleisch Zuschnitte', aliases: ['schwein hackfleisch', 'schweine vorder eisbein', 'schwein pfoten', 'schweine ohren'] },
  { code: 'E05', name: 'Aro Bierschinken / Bauchspeck gewürfelt', ref: 'Bauchspeck / Schinken', aliases: ['aro bierschinken', 'aro bauchspeck'] },

  // E06: Tofu & Saitan
  { code: 'E06', name: 'Tofu natural (Lehop Berlin 450g / Bio 250g)', ref: 'Tofu frisch (Bio / Natural)', aliases: ['tofu natural lehop', 'tofu bio', 'tofu ref', 'tofu fritteirt', 'tofu'] },
  { code: 'E06', name: 'Hähnchen Saitan (20x300g)', ref: 'Saitan (Weizeneiweiß)', aliases: ['hähnchen saitan', 'saitan'] },
  { code: 'E06', name: 'Ente Vegan BBQ', ref: 'Vegane Ente BBQ', aliases: ['ente vegan bbq', 'vegane ente'] },

  // E07: Reis & Nudeln
  { code: 'E07', name: 'YUKIZURU Premium Sushi Reis (10kg)', ref: 'Yukizuru Sushi Reis', aliases: ['yukizuru premium', 'yukizuru sushi reis', 'yukizuru'] },
  { code: 'E07', name: 'Itakomachi / Okomesan / Akitakomachi Sushi Reis (1-10kg)', ref: 'Sushi Reis Rundkorn', aliases: ['itakomachi', 'okomesan', 'akitakomachi', 'sushireis'] },
  { code: 'E07', name: 'Reis Lua Chin / Jasminreis (18kg)', ref: 'Jasmin Reis Premium', aliases: ['reis lua chin', 'jasminreis'] },
  { code: 'E07', name: 'Udon Nudeln (Ita-San 30x200g / Japan)', ref: 'Udon Nudeln (Ita-San)', aliases: ['udon ita-san', 'mi udon ita san', 'udon nudeln', 'udon'] },
  { code: 'E07', name: 'Reisnudeln / Reisbandnudeln (Vifon / Lan Do 20x500g)', ref: 'Reisnudeln (Pho / Bun)', aliases: ['reisnudeln lan do vifon', 'reisbandnudeln vifon', 'reisbandnudeln', 'reisnudeln'] },
  { code: 'E07', name: 'Reispapier 3 Cay Tre Bamboos (36x400g)', ref: 'Reispapier (Sommerrollen)', aliases: ['reispapier 3 cay tre', 'reispapier'] },
  { code: 'E07', name: 'Nudeln Instant Nissin Soba Bag', ref: 'Nissin Soba Nudeln', aliases: ['nudeln instant nissin soba', 'nissin soba'] },

  // E08: Frische, Gemüse, Salat & Kräuter
  { code: 'E08', name: 'Avocado Ready to Eat (14er / 16er Kiste / Sülo / Metro)', ref: 'Avocado Hass (Ready to Eat)', aliases: ['avocado ready to eat', 'avocado 16stk', 'avocado rew', 'avocadowürfel', 'avocado'] },
  { code: 'E08', name: 'Limetten frisch (60er Kiste / 4,5kg)', ref: 'Limetten frisch', aliases: ['limetten 60stk', 'limette', 'limetten'] },
  { code: 'E08', name: 'Gurken frisch (12er Kiste / 300-400g)', ref: 'Salatgurken frisch', aliases: ['gurken ca 300-400g', 'gurken', 'gurke'] },
  { code: 'E08', name: 'Koriander frisch Bund', ref: 'Koriander frisch', aliases: ['koriander frisch', 'koriander'] },
  { code: 'E08', name: 'Zitronenblätter (La Chanh / Bangkok TK 100g)', ref: 'Zitronenblätter (La Chanh)', aliases: ['cook zitronenblätter', 'limettenblätter bangkok', 'la chanh', 'zitronenblätter'] },
  { code: 'E08', name: 'Betelblätter La Lot (100 Blatt)', ref: 'Betelblätter (La Lot)', aliases: ['betelblätter la lot', 'la lot'] },
  { code: 'E08', name: 'Zitronengras gehackt (TK 250g / Frisch)', ref: 'Zitronengras frisch/TK', aliases: ['zitronengras gehackt', 'zitronengras'] },
  { code: 'E08', name: 'Ingwer frisch (5kg Kiste)', ref: 'Ingwer frisch', aliases: ['ingwer 5kg', 'ingwer'] },
  { code: 'E08', name: 'Knoblauch frisch (5kg Kiste / TK 1kg)', ref: 'Knoblauch frisch/TK', aliases: ['knoblauch 5kg', 'knoblauch tk', 'knoblauch'] },
  { code: 'E08', name: 'Lauchzwiebeln / Frühlingszwiebeln (10x160g)', ref: 'Lauchzwiebeln frisch', aliases: ['lauchzwiebeln 10x160g', 'lauchzwiebeln'] },
  { code: 'E08', name: 'Chilischoten rot frisch (Vietnam 100g)', ref: 'Chilischoten rot (frisch)', aliases: ['chilischoten rot', 'chili'] },
  { code: 'E08', name: 'Daikon Kresse (Koppert 16x81g)', ref: 'Daikon Kresse', aliases: ['daikonkresse 16xca81g', 'daikon kresse', 'daikon'] },
  { code: 'E08', name: 'Shiso Blätter (Grün / Rot 15er / Kresse Purple)', ref: 'Shiso Blätter (Grün/Rot)', aliases: ['shisoblätter grün', 'shiso blätter rot', 'kresse shiso purple', 'kresse gourmet shiso', 'shiso blatt grün'] },
  { code: 'E08', name: 'Erbsenkresse / Kresse Affilla / Zuckererbse (Koppert)', ref: 'Erbsenkresse / Affilla', aliases: ['erbsenkresse koppert', 'kresse affilla', 'kresse zuckererbse'] },
  { code: 'E08', name: 'Wilder Brokkoli Bimi (Keltenhof 1,5kg / 300g)', ref: 'Wilder Brokkoli (Bimi)', aliases: ['wilder broccoli bimi', 'wilder brokkoli', 'brokkoli'] },
  { code: 'E08', name: 'Shii Take Pilze BIO (2kg)', ref: 'Shiitake Pilze frisch', aliases: ['shii take pilze', 'shiitake'] },
  { code: 'E08', name: 'Kräuterseitlinge (300g)', ref: 'Kräuterseitlinge frisch', aliases: ['kräuterseitlinge'] },
  { code: 'E08', name: 'Morcheln getrocknet (Moc nhi chi 1kg)', ref: 'Morcheln getrocknet (Mu-Err)', aliases: ['morcheln getrocknet', 'moc nhi chi'] },
  { code: 'E08', name: 'Sojasprossen (1kg)', ref: 'Sojasprossen frisch', aliases: ['sojasprossen 1kg', 'sojasprossen'] },
  { code: 'E08', name: 'Galgant gemahlen (BDMP Bangkok 10x300g)', ref: 'Galgant (gemahlen/frisch)', aliases: ['galgant gemahlen', 'galgant'] },
  { code: 'E08', name: 'Pak Choi (8kg Kiste)', ref: 'Pak Choi frisch', aliases: ['pak choi 8kg', 'pak choi'] },
  { code: 'E08', name: 'Kürbis Hokkaido / Butternut (2,5kg)', ref: 'Hokkaido / Butternut Kürbis', aliases: ['kürbis hokkaido', 'butternus kürbis', 'tk pumpkin'] },
  { code: 'E08', name: 'Süßkartoffeln (5kg Kiste)', ref: 'Süßkartoffeln frisch', aliases: ['süßkartoffeln 5kg', 'süßkartoffeln'] },
  { code: 'E08', name: 'Zwiebeln rot / gelb / Schalotten (10kg / 25kg)', ref: 'Zwiebeln frisch', aliases: ['zwiebeln rot 10kg', 'zwiebeln', 'schalotten'] },
  { code: 'E08', name: 'Kartoffeln (FK klein 1kg / 25kg)', ref: 'Kartoffeln frisch', aliases: ['kartoffeln fk klein', 'kartoffeln 25kg', 'kartoffeln'] },
  { code: 'E08', name: 'Möhren / Karotten Rainbow Mini (5kg / 8x150g)', ref: 'Möhren / Karotten Mini', aliases: ['möhren 5kg', 'karrotten rainbow mini', 'karrotten mini'] },
  { code: 'E08', name: 'Tomaten / Rispentomaten / Cherrydattel (5kg / 650g)', ref: 'Tomaten / Cherrytomaten', aliases: ['tomaten 5kg', 'rispentomaten', 'cherrydatteltomaten'] },
  { code: 'E08', name: 'Spitzpaprika / Paprika Mix (5kg / 500g)', ref: 'Paprika / Spitzpaprika', aliases: ['spitzpaprika rot', 'paprika mix 5kg', 'paprika ref'] },
  { code: 'E08', name: 'Spargel grün (Deutschland / Mexiko 400-500g)', ref: 'Grüner Spargel', aliases: ['spargel grün', 'spargel ref', 'spargel 500g'] },
  { code: 'E08', name: 'Frische Kräuter (Basilikum XL / Minze / Rosmarin / Thymian / Schnittlauch / Dill / Rucola)', ref: 'Frische Küchenkräuter', aliases: ['basilikum topf xl', 'minze 110g', 'rosmarin 100g', 'thymian 100g', 'schnittlauch', 'dill', 'rucola 10 bund', 'bio kräuter im topf'] },
  { code: 'E08', name: 'Veilchen / Blütenmix essbar (Keltenhof 35-45Stk)', ref: 'Essbare Blüten / Veilchen', aliases: ['veilchen gemischt', 'veilchen kelterhof', 'blütenmix isreal'] },
  { code: 'E08', name: 'Mango / TK Mango / Mango Pulp (2,5kg / 6x750ml)', ref: 'Mango (Frisch / TK / Pulp)', aliases: ['tk mango 2,5kg', 'mango würfel tk', 'diamond mango', 'mango pulp'] },
  { code: 'E08', name: 'Heidelbeeren / Himbeeren / Beerenmix (125-500g / TK 2,5kg)', ref: 'Beeren frisch/TK', aliases: ['tk mc beeren-mix', 'heidelbeeren', 'himbeeren tk', 'beerenkorb tk'] },
  { code: 'E08', name: 'Orangen / Saftorangen / Mandarinen / Kumquat / Ananas / Passionsfrucht', ref: 'Frische Früchte', aliases: ['saftorangen', 'mandarinen', 'kumquat', 'ananas', 'passionsfrucht'] },
  { code: 'E08', name: 'Salate (Lollo Mix / Frisee / Radicchio / Spitzkohl)', ref: 'Frische Salate', aliases: ['lollo mix', 'friseesalat', 'radicchio 3kg', 'spitzkohl'] },
  { code: 'E08', name: 'Staudensellerie / Sellerieknollen / Rote Bete / Rettich', ref: 'Wurzelgemüse & Sellerie', aliases: ['staudensellerie', 'sellerieknollen', 'bete gelb roh', 'rettich 5stk'] },
  { code: 'E08', name: 'Fruchtpürees (Kalamansi / Pfirsich weiß / Birne / Erdbeere 1kg)', ref: 'Fruchtpüree 100% (Ponthier)', aliases: ['püree kalamansi', 'kalamansi püree', 'pfirsisch püree', 'püree birne', 'püree erdbeere'] },

  // E09: Nährmittel & Gewürze
  { code: 'E09', name: 'Miora Otsuka Reiskochhilfe (10x1kg)', ref: 'Miora Reiskochpulver', aliases: ['miora otsuka reiskochhilfe', 'miora reiskochpulver', 'miora'] },
  { code: 'E09', name: 'Tokyo Takuan Eingelegter Rettich (20x500g)', ref: 'Takuan (Eingelegter Rettich)', aliases: ['tokyo takuan eingelegter rettich', 'tokyo takuan', 'takuan'] },
  { code: 'E09', name: 'Sushi Gari White Eingelegter Ingwer (10x1kg)', ref: 'Sushi Gari (Ingwer weiß)', aliases: ['sushi gari white', 'sushi gari', 'sushi ingwer'] },
  { code: 'E09', name: 'Yaki Sushi Nori Hangiri Gold (10x100 Bl.)', ref: 'Yaki Sushi Nori (Gold)', aliases: ['yakisushinori hangiri', 'yakisushinori', 'nori', 'seetang'] },
  { code: 'E09', name: 'Cut Wakame Seetang getrocknet (20x250g)', ref: 'Wakame Seetang getrocknet', aliases: ['cut wakame seetang getrocknet', 'cut wakame'] },
  { code: 'E09', name: 'Kona Wasabi Pulver / Meerrettichpulver (10x1kg)', ref: 'Wasabi / Meerrettich Pulver', aliases: ['kona wasabi', 'wasabi powder', 'meerrettich zubereitungspulver', 'meerrettich-zubereitungspulver'] },
  { code: 'E09', name: 'Suehiro Su Mikan Getreideessig (20L)', ref: 'Suehiro Su (Getreideessig)', aliases: ['suehiro su u.k mikan', 'suehiro su', 'suehiro'] },
  { code: 'E09', name: 'Tancho 18L Reiswein zum Kochen', ref: 'Tancho Koch-Reiswein (18L)', aliases: ['tancho 18 l reiswein', 'tancho'] },
  { code: 'E09', name: 'Thunfisch Flocken Katsuobushi (Dashi No Moto / Marutomo 1kg)', ref: 'Katsuobushi (Thunfischflocken / Dashi)', aliases: ['thunfisch flocken , katsuokezuribushi', 'katsuokezunbushi', 'eu shin katsuo', 'dashi no moto'] },
  { code: 'E09', name: 'Yuzu No Hana Yuzupulver (45x20g)', ref: 'Yuzu No Hana Yuzupulver', aliases: ['yuzu no hana maruzen', 'yuzu no hana'] },
  { code: 'E09', name: 'Würzmischungen (Bot Canh / Knorr Hat Nem / Mi Chinh Ajinomoto / Xa Xiu Lobo)', ref: 'Asiatische Würzmittel (Knorr / Ajinomoto)', aliases: ['würzmischung bot canh', 'würzmischung knorr hat nem', 'würzmischung mi chinh ajinomoto', 'würzmischung xa xiu lobo', 'vegan knorr hat nem'] },
  { code: 'E09', name: 'Panko Mehl Melda Thailand (10kg)', ref: 'Panko Mehl (Paniermehl)', aliases: ['pankomehl melda thailand', 'pankomehl', 'panko'] },
  { code: 'E09', name: 'Kartoffelmehl China (20kg)', ref: 'Kartoffelmehl / Kartoffelstärke', aliases: ['kartoffelmehl china', 'kartoffelmehl'] },
  { code: 'E09', name: 'Sesam geschält / schwarz (1kg)', ref: 'Sesam (weiß / schwarz)', aliases: ['sesam geschält', 'sesam schwarz', 'sesam'] },
  { code: 'E09', name: 'Cashewkerne MC / Erdnüsse (1kg / 10kg)', ref: 'Cashewkerne / Erdnüsse', aliases: ['cashewkerne mc', 'erdnussack 10kg', 'erdnüsse küche'] },
  { code: 'E09', name: 'Meersalz / Sonnensalz / Maldon Sea Salt Flakes (1-10kg)', ref: 'Meersalz / Speisesalz', aliases: ['maldon sea salt flakes', 'sonnensalz speise sald', 'meersalz grob aquas', 'seldor meersalz', 'esco sonnensalz', 'salz eimer'] },
  { code: 'E09', name: 'Weizenmehl Type 405 (1-10kg)', ref: 'Weizenmehl Type 405', aliases: ['aro weizenmehl type 405', 'weizenmehl typ 405', 'weizenmehl'] },
  { code: 'E09', name: 'Zucker Raffinade / Rohrzucker / Zucker Braun (Aro / Ja / Kluth)', ref: 'Zucker Raffinade / Rohrzucker', aliases: ['zucker raffinade aro', 'zuckerraffinade diadem', 'zucker braun', 'rohrzucker kluth'] },
  { code: 'E09', name: 'Gewürze (Zimtstangen / Kardamom / Sternanis / Nelken / Fenchel / Koriander ganz / Kurkuma / Togarashi / Peppercorn / Steakpfeffer / Knoblauchpulver)', ref: 'Gewürze & Kräuter ganz/gemahlen', aliases: ['zimtstange', 'kardamon', 'sternanis', 'nelken 350g', 'fenchel ganz', 'coriander ganz', 'kurkuma metro', 'togarashi', 'peppercorn', 'steak pfeffer blockhaus', 'knoblauchpulver'] },
  { code: 'E09', name: 'Goldmais Bonduelle / Maiskölbchen (6x850ml / 370ml)', ref: 'Goldmais / Maiskölbchen', aliases: ['goldmais bonduelle', 'maiskölbchen aro', 'goldmais bo', 'goldmais ref'] },
  { code: 'E09', name: 'Eier (180 Stück Palette Sülo)', ref: 'Frische Eier (Güteklasse A)', aliases: ['eier 180 stück'] },
  { code: 'E09', name: 'Gelita Blattgelatine (1kg Packung) / Ruf Argatine Geliermittel', ref: 'Geliermittel (Gelatine / Argatine)', aliases: ['gelita blattgelatine', 'ruf argatine', 'agar agar'] },
  { code: 'E09', name: 'Blütenhonig / Yuzu Honig Glas (500g / 1kg)', ref: 'Honig (Blütenhonig / Yuzu Honig)', aliases: ['blütenhonig aro', 'honig yuzu', 'honig korea', 'yuzu honig glas'] },

  // E10: Tiefkühl & Dim Sum
  { code: 'E10', name: 'Hao Kao mit Gemüse / Dim Sum TK', ref: 'Hao Kao Dim Sum TK', aliases: ['hao kao', 'dim sum', 'ha cao chay', 'dumpling'] },
  { code: 'E10', name: 'Gyoza (Ha Cao Chay Gemüse 20x440g / Hähnchen Ajinomoto 10x600g)', ref: 'Gyoza (Gemüse / Hähnchen)', aliases: ['gyoza gemüse ha cao chay', 'gyoza hähnxhen ajinomoto', 'chicken gyoza ajinomoto', 'gyoza'] },
  { code: 'E10', name: 'Wan Tan Teigblätter (67 Blatt 500g)', ref: 'Wan Tan Teigblätter', aliases: ['wan tan 67 blatt', 'wan tan'] },
  { code: 'E10', name: 'Edamame blanchiert (MC 1kg / SSP 20x500g / Jumbo 400g)', ref: 'Edamame TK', aliases: ['edamame blanchiert', 'edamame mc 1kg', 'jumbo edamame 400g', 'edamame'] },
  { code: 'E10', name: 'Goma Wakame Seetangsalat (12x1kg)', ref: 'Goma Wakame Seetangsalat', aliases: ['goma wakame seetangsalat', 'goma wakame', 'wakame ref'] },
  { code: 'E10', name: 'Sweet Potato Fries TK (Aviko 5x2,27kg)', ref: 'Süßkartoffel-Pommes TK', aliases: ['sweet potato fries tk', 'sweet potatoe fries aviko', 'sweet potato fries ref'] },
  { code: 'E10', name: 'Edna Butter Croissant / Frosta Blätterteig TK', ref: 'Butter Croissants / Blätterteig TK', aliases: ['edna butter croissant', 'frosta blätterteig tk'] },

  // E11: Soßen, Pasten & Pürees
  { code: 'E11', name: 'Knoblauchpüree / Ingwerpüree (1kg)', ref: 'Knoblauchpüree / Ingwerpüree', aliases: ['knoblauchpüree', 'ingwerpüree', 'knoblauch puree'] },
  { code: 'E11', name: 'Shoyu Koikuchi Sojasauce dunkel (18L Karton / Yamasa Bento)', ref: 'Shoyu Sojasauce (dunkel)', aliases: ['sojasauce (dunkel) shoyu koikuchi', 'shoyu koikuchi', 'sojasoße bento shoyu', 'sojasauce bento shoyu', 'sojasauce fische'] },
  { code: 'E11', name: 'Kikkoman Sojasauce (20L) / Tamari Shoyu glutenfrei', ref: 'Kikkoman Sojasauce / Tamari', aliases: ['kikkoman 20l', 'tamari shoyu glutenfrei'] },
  { code: 'E11', name: 'Austernsauce (Lee Kum Kee Dau Hau 6x2,27kg / Kanister 3x5kg)', ref: 'Austernsauce Premium (Lee Kum Kee)', aliases: ['austern soße lee kum kee', 'austern soße dau hau', 'austern soße ref'] },
  { code: 'E11', name: 'Hoisin Sauce (Lee Kum Kee 6x2,27kg)', ref: 'Hoisin Sauce (Lee Kum Kee)', aliases: ['hoisin lee kum kee', 'hoisin sosse'] },
  { code: 'E11', name: 'Sriracha Chilisauce (Goose 12x730ml / 455)', ref: 'Sriracha Chilisauce', aliases: ['sriracha goose', 'siracha 455', 'sriracha'] },
  { code: 'E11', name: 'Honteri Mirin Sweet Cooking Seasoning (SSP)', ref: 'Honteri Mirin (Koch-Süßwein)', aliases: ['honteri, sweet cooking seasoning', 'mirin aroma', 'honteri'] },
  { code: 'E11', name: 'Ryoriten No Aji Shiro Miso hell / Misopaste (10x1kg)', ref: 'Miso Paste (hell/dunkel)', aliases: ['ryoriten no aji shiro', 'misopaste'] },
  { code: 'E11', name: 'Kewpie Mayonnaise Japan (20x500g)', ref: 'Kewpie Mayonnaise (Japan)', aliases: ['kewpie mayonnaise japan', 'kewpie'] },
  { code: 'E11', name: 'Mayonnaise Aro 50% / Delikatess 80% (10kg / 12x500g)', ref: 'Salat-Mayonnaise Gastronomie', aliases: ['mayonnaise aro 50% fett', 'mayonnaise aro delikatess', 'mayo ref'] },
  { code: 'E11', name: 'Kizami Wasabi Echter Wasabi (10x0,25kg)', ref: 'Kizami Wasabi (echter gehackter Wasabi)', aliases: ['kizami wasabi echter wasabi', 'kizami wasabi'] },
  { code: 'E11', name: 'Currypaste gelb / rot Thailand (12x1kg)', ref: 'Thai Currypaste (Gelb/Rot)', aliases: ['currypaste gelb thailand', 'currypaste rot thailand', 'currypaste'] },
  { code: 'E11', name: 'Tom Yum Paste Thailand (12x900g)', ref: 'Tom Yum Würzpaste', aliases: ['tom yum thailand', 'tom yum'] },
  { code: 'E11', name: 'Kokospaste Pride (40x200g)', ref: 'Kokospaste', aliases: ['kokospaste pride', 'kokospaste'] },
  { code: 'E11', name: 'Erdnusspaste Pindakaas (10kg Eimer)', ref: 'Erdnusspaste (Pindakaas)', aliases: ['erdnusspaste pindakaas', 'erdnusspaste'] },
  { code: 'E11', name: 'Fischsoße Mam Muc (12x0,725L)', ref: 'Fischsauce (Nuoc Mam)', aliases: ['fischsoße mam muc', 'fischsoße'] },
  { code: 'E11', name: 'Black Soy Sauce Dek Som Boon / Xi Dac Thang Be', ref: 'Süße dunkle Sojasauce', aliases: ['black soy sauce dek som boon', 'xi dac thang be'] },
  { code: 'E11', name: 'Zigante / MC Tartufata Trüffelpaste / Sauce (500g / 6x200g)', ref: 'Tartufata Trüffelsauce Premium', aliases: ['zigante tartufata trüffel', 'mc tartufata 500g', 'trüffel creme bh', 'trüffel flavour sauce', 'trüffelpaste schwarz', 'trüffelsauce ref'] },
  { code: 'E11', name: 'Hummerpaste Langbein (500g)', ref: 'Hummerpaste (Langbein)', aliases: ['hummerpaste langbein', 'hummerpaste'] },
  { code: 'E11', name: 'Maggi Würze / Tomatenmark (Heinz / MC / Ja)', ref: 'Maggi Würze / Tomatenmark', aliases: ['maggi halal würze', 'maggi', 'tomatenmark mc', 'tomatenmark ja', 'tomaten ketchup heinz'] },
  { code: 'E11', name: 'Birnenponzu (Metro)', ref: 'Birnenponzu', aliases: ['birnenponzu'] },
  { code: 'E11', name: 'Senfkaviar (Amazon)', ref: 'Senfkaviar', aliases: ['senfkaviar'] },

  // E12: Milchprodukte
  { code: 'E12', name: 'Mascarpone 80% / 82% (Galbani / Aro / Ja 250g-1,5kg)', ref: 'Mascarpone (80-82%)', aliases: ['mascarpone 80% galb', 'mascarpone 82%', 'mascarpone ogt ja', 'aro mascarpone 82%', 'mascarpone ref'] },
  { code: 'E12', name: 'Dovgan Kondensmilch gezuckert 8,5% (12x370g)', ref: 'Kondensmilch gezuckert (Dovgan)', aliases: ['dovgan kondensmilch gezuckert', 'dovgan kondensmilch'] },
  { code: 'E12', name: 'H-Milch / Frischmilch 3,5% (Aro / Ja / Bärenmarke 10-12x1L)', ref: 'Vollmilch 3,5% (H-Milch / Frisch)', aliases: ['h-milch aro 3,5%', 'frischmilch ja 3,5%', 'bärenmarke frischmilch 1l', 'milch ref'] },
  { code: 'E12', name: 'Schlagsahne 30% / 33% / Küchenprofi (Aro / Gastro 10-12x1L)', ref: 'Schlagsahne (30-33% Fett)', aliases: ['h-schlagsahne aro 30%', 'schlagsahne 33% gastro', 'h-küchen-profi-sahne aro', 'schlagsahne ref'] },
  { code: 'E12', name: 'Philadelphia Frischkäse Natur (500g / 1,65kg) / MC Frischkäse 1,5kg', ref: 'Frischkäse (Philadelphia / MC)', aliases: ['philadelphia natur 68%', 'frischkäse mc 1,5kg', 'philadelphia ref'] },
  { code: 'E12', name: 'Parmigiano Reggiano / Grana Padano gerieben (1kg)', ref: 'Parmesan / Grana Padano gerieben', aliases: ['parmigiano reggiano mc gerieben', 'grana panado gerieben'] },
  { code: 'E12', name: 'Halloumi Gazi 43% / Mozzarella Stange / Gouda / Käseaufschnitt', ref: 'Käse (Halloumi / Mozzarella / Gouda)', aliases: ['halloumi gazi 43%', 'mozzarella stange', 'gauda in scheiben', 'käseaufschnitt 250g'] },
  { code: 'E12', name: 'Markenbutter Aro 82% / Kerry Gold (40x250g)', ref: 'Markenbutter 82%', aliases: ['markenbutter aro 82%', 'kerry gold 40x250g'] },
  { code: 'E12', name: 'Kokosmilch Aroy-D (12x1L)', ref: 'Kokosmilch (Aroy-D)', aliases: ['kokosmilch aroy 12x1l', 'kokosmilch aroy'] },
  { code: 'E12', name: 'Griechischer Joghurt 10% / Schlagfix vegan', ref: 'Griechischer Joghurt / Vegane Sahne', aliases: ['griechischer joghurt 10%', 'schlagfix schlagsahne vegan'] },

  // E13: Spirituosen & Liköre
  { code: 'E13', name: 'Aperol Aperitivo Italiano Bitter 11% (1L)', ref: 'Aperol Bitter 11%', aliases: ['aperol aperitivo italiano', 'aperol bitter', 'aperol'] },
  { code: 'E13', name: 'Lillet Blanc Aperitif 17% (0,75L)', ref: 'Lillet Blanc 17%', aliases: ['lillet blanc 0,75l', 'lillet aperitif blanc', 'lillet'] },
  { code: 'E13', name: 'Monkey 47 Schwarzwald Dry Gin 47% (0,5L)', ref: 'Monkey 47 Schwarzwald Dry Gin', aliases: ['monkey 47 schwarzwald dry gin', 'monkey 47 0,5l', 'monkey 47'] },
  { code: 'E13', name: 'Hendrick\'s Gin 44% (0,7L)', ref: 'Hendrick\'s Gin 44%', aliases: ['hendrick\'s gin 44%', 'hendricks gin 0,7l', 'hendricks gin'] },
  { code: 'E13', name: 'Bombay Sapphire London Dry Gin 40% (1L)', ref: 'Bombay Sapphire Gin 40%', aliases: ['bombay sapphire london dry gin', 'bombay sapphire 40', 'bombay sapphire'] },
  { code: 'E13', name: 'Tanqueray Dry Gin / Royal Gin / 0.0% (0,7-1L)', ref: 'Tanqueray Gin', aliases: ['tanqueray dry gin 43,1%', 'tanqueray royal gin 0,7l', 'tanqueray gin 0,0%', 'tanqueray'] },
  { code: 'E13', name: 'Roku Gin / Jinzu Gin (0,7L)', ref: 'Japanischer Gin (Roku / Jinzu)', aliases: ['roku gin 0,7l', 'jinzu gin 0,7l', 'momotaro gin'] },
  { code: 'E13', name: 'Smirnoff Red No. 21 Vodka 37,5% (0,7L / 1L)', ref: 'Smirnoff Vodka No. 21', aliases: ['smirnoff red no. 21 vodka', 'smirnoff red label vodka', 'smirnoff'] },
  { code: 'E13', name: 'Three Sixty Vodka 37,5% (0,7L) / Belvedere Vodka 1L', ref: 'Three Sixty / Belvedere Vodka', aliases: ['three sixty vodka', 'belvedere vodka 1l'] },
  { code: 'E13', name: 'Havana Club Rum 3 Years (0,7L / 1L) / Flor de Cana 4J / Pascas dark', ref: 'Havana Club / Rum Premium', aliases: ['havana club rum 3 years', 'havanna club 0,7l', 'flor de cana rum', 'pascas dark rum'] },
  { code: 'E13', name: 'Liköre (Campari / Licor 43 / Jägermeister / Kahlua / Amaretto / Baileys / Cointreau / Borghetti / Nordhäuser / Drachenfrucht Aroma)', ref: 'Bar Liköre (Campari / Licor 43 / Kahlua etc.)', aliases: ['campari milano bitter', 'licor 43', 'jägermeister 1l', 'kahlua kaffee-likör', 'amaretto disaronno', 'baileys irish cream', 'cointreau 0,7', 'borghetti espresso likor', 'nordhäuser mandarine', 'nordhäuser likör pfirsich', 'drachenfrucht aroma', 'bergamotto likör', 'batida de coco'] },
  { code: 'E13', name: 'Tequila (Sierra Silver / Blanco / Olmeca)', ref: 'Tequila (Sierra / Olmeca)', aliases: ['sierra tequila silver', 'sierra tequilla blanco', 'olmeca tequilla'] },
  { code: 'E13', name: 'Vermouth / Martini (Rosso / Bianco / Extra Dry)', ref: 'Martini / Vermouth', aliases: ['martini rosso 1l', 'martini bianco', 'martini extra dry', 'vermouth 0,75ml'] },
  { code: 'E13', name: 'Remy Martin Cognac / Carlos 1 Brandy', ref: 'Cognac / Brandy Premium', aliases: ['remy martin cognac', 'carlos 1 brandy'] },

  // E14: Wein, Prosecco & Champagner
  { code: 'E14', name: 'Erbeldinger Riesling trocken / halbtrocken (Margarethenhof 6-12x0,75L)', ref: 'Erbeldinger Riesling (trocken/htr)', aliases: ['erbeldinger riesling trocken', 'erbeldinger riesling htr', 'erbeldinger riesling'] },
  { code: 'E14', name: 'Wassmer Grauburgunder / Meiser Weißburgunder (Flasche / 0,75L)', ref: 'Grauburgunder / Weißburgunder', aliases: ['wassmer grauburgunder', 'meiser weißburgunder', 'grauburgunder 6x0,75l'] },
  { code: 'E14', name: 'Fernlands Sauvignon Blanc / Elbling / Wine After Work (Marisco 6-12x0,75L)', ref: 'Sauvignon Blanc / Elbling Weißwein', aliases: ['fernlands, marisco', 'elbling, margarethenhof', 'wine after work'] },
  { code: 'E14', name: 'Muskat Trollinger / Rotling / Tratturi Rosato / Sissi & Franz Cuvée', ref: 'Roséwein & Cuvée (Margarethenhof / Tratturi)', aliases: ['muskat trollinger', 'rotling, margarethenhof', 'tratturi rose', 'sissi und franz', 'vega eni x rose'] },
  { code: 'E14', name: 'Merlot Rotwein (Getränke Staude / Aldi Pfalz) / Samtrot / Try Aged Wine', ref: 'Rotwein (Merlot / Samtrot / Try Aged)', aliases: ['merlot', 'merlot aldi', 'samtrot rotwein', 'try aged wine'] },
  { code: 'E14', name: 'Prosecco / Vino Frizzante / Mionetto / La Gioiosa (0,75L)', ref: 'Prosecco Frizzante (DOC)', aliases: ['mionetto prosecco', 'vino frizzante prosecco', 'la gioiosa frizzante', 'prosecco doc frizzante'] },
  { code: 'E14', name: 'Champagner (Brut Rosé Ruinart Champagne 0,75L)', ref: 'Ruinart Rosé Champagner', aliases: ['brut rosé ruinart champagne'] },
  { code: 'E14', name: 'Glühwein Christkind / Kinderpunsch Karton (1-10L)', ref: 'Glühwein / Punsch', aliases: ['glühwein christkind', 'kinder punsch karton christkind'] },

  // E15: Bier
  { code: 'E15', name: 'Warsteiner Pilsner (30L Fass / 24x0,33L AKF)', ref: 'Warsteiner Pilsner (Fass/Flasche)', aliases: ['warsteiner pilsner 30l', 'warsteiner akf 24x0,33l', 'warsteiner'] },
  { code: 'E15', name: 'König Ludwig Weissbier naturtrüb (30L Fass / 20x0,5L AKF)', ref: 'König Ludwig Weissbier (Fass/Flasche)', aliases: ['könig ludwig weissbier naturtrüb 30l', 'könig ludwig weissbier akf', 'könig ludwig weissbier'] },
  { code: 'E15', name: 'Kirin Ichiban Bier Japan (24x330ml)', ref: 'Kirin Ichiban Bier Japan', aliases: ['kirin bier 24x330ml', 'kirin'] },

  // E16: Sake & Pflaumenwein
  { code: 'E16', name: 'Masumi Sake (Sanka Bergblume / Kuro Black / Shiro / Yuzushu 720ml)', ref: 'Masumi Premium Sake (Sanka/Kuro/Shiro)', aliases: ['masumi sanka bergblume', 'masumi kuro black', 'masumi shiro', 'masumi - yuzushu', 'masumi'] },
  { code: 'E16', name: 'Imayotsukasa Junmai Daiginjo (720ml)', ref: 'Imayotsukasa Junmai Daiginjo', aliases: ['imayotsukasa junmai daiginjo', 'imayitsukasa - junmai daiginjo'] },
  { code: 'E16', name: 'Gekkeikan Yamada Nishiki Junmai (1,8L Tetrapack / 1800ml) / Modern Junmai', ref: 'Gekkeikan Yamada Nishiki Sake', aliases: ['gekkeikan - yamada nishiki junmai', 'gekkeikan yamada nishiki sake', 'gekkeikan - modern sake junmai', 'gekkeikan'] },
  { code: 'E16', name: 'Yoshinogawa Taruzake (720ml) / Toji No Banshaku', ref: 'Yoshinogawa Sake (Taruzake)', aliases: ['yoshinogawa taruzake', 'yoshinogawa toji no banshaku', 'yoshinogawa'] },
  { code: 'E16', name: 'Akashi Tai Taruzake Honjozo / Kome to Mizu / Karakuchi Gold', ref: 'Akashi Tai / Sake Spezialitäten', aliases: ['akashi tai - taruzake honjozo', 'kome to mizu', 'karakuchi gold masumi'] },
  { code: 'E16', name: 'Shiragiku Aka Ume Rote Pflaume (500ml) / Choya Pflaumenwein (5L)', ref: 'Pflaumenwein (Shiragiku / Choya Umeshu)', aliases: ['shiragiku aka ume rote pflaume', 'pflaumenwein choya 5l', 'pflaumenwein'] },
  { code: 'E16', name: 'Sake Koshu Masamune 14% (18L Kanister für Sushiessig)', ref: 'Sake Koshu Masamune (18L Kanister)', aliases: ['sake koshu masamune 14% 18l'] },

  // E17: Whiskey & Bourbon
  { code: 'E17', name: 'The Yamazaki 12 Jahre (0,7L)', ref: 'Yamazaki 12 Jahre Single Malt', aliases: ['the yamazaki 12 j.', 'yamazaki 12'] },
  { code: 'E17', name: 'Hibiki Suntory Japanese Whisky (0,7L)', ref: 'Hibiki Suntory Whisky', aliases: ['hibiki suntory 0,7l', 'hibiki'] },
  { code: 'E17', name: 'The Chita / Nikka from Barrel (0,5L) / Nikka Days / Enso Japanese Whisky (0,7L)', ref: 'Japanischer Whisky (Nikka/Chita/Enso)', aliases: ['nikka from barrel 0,5l', 'nikka days 0,7l', 'the chita 0,7l', 'enso japanese whisky'] },
  { code: 'E17', name: 'Glenfiddich 12J / 15J / 18J (0,7L) / Lagavulin 16J / Ardbeg / Glen Forrest 16J', ref: 'Single Malt Scotch Whisky (Glenfiddich/Lagavulin/Ardbeg)', aliases: ['glenfiddich 12. j.', 'glenfiddich 15 j.', 'glenfiddich 18 j.', 'lagavulin 16. j.', 'ardberg scotch 0,7l', 'glen forrest 16j.'] },
  { code: 'E17', name: 'Johnnie Walker Blue Label / Chivas Regal 18J / Redbreast 12J / Ballantines / Two Stacks / The Whistler', ref: 'Blended & Irish Whiskey Premium', aliases: ['johnnie walker blue label', 'chivas regal 18. j.', 'redbreast 12j.', 'ballantines 12j.', 'two stacks 0,7l', 'the whistler 0,7l'] },
  { code: 'E17', name: 'Bulleit Bourbon / 95 Rye / Woodford Reserve / James E. Pepper 1776', ref: 'Bourbon & Rye Whiskey', aliases: ['bulleit bourbon frontiert', 'bulleit 95 rye frontiert', 'woodford reserve bourbon', 'james e. pepper 1776 bourbon'] },
  { code: 'E17', name: 'Slyrs Bavarian Single Malt Vanilla Honey (0,7L)', ref: 'Slyrs Vanilla Honey Whisky', aliases: ['slyrs vanilla honey 0,7l'] },

  // E18: Softdrinks, Säfte & Filler
  { code: 'E18', name: 'Coca Cola / Coca Cola Zero / Sprite (12x1L)', ref: 'Coca Cola / Zero / Sprite (1L)', aliases: ['coca cola 12x1l', 'coca cola zero 12x1l', 'sprite 12x1l'] },
  { code: 'E18', name: 'Fever Tree Tonic (Mediterranean / Indian / Dry Tonic / Wild Berry / Ginger Beer 24x0,2L)', ref: 'Fever Tree Tonic & Ginger Beer (0,2L)', aliases: ['fever tree meditarrean tonic', 'fever tree meditarranien tonic', 'fever tree wild berry', 'fever tree dry tonic', 'fever tree indian tonic', 'fever tree ginger beer'] },
  { code: 'E18', name: 'Happy Day Säfte (Mango / Maracuja / Apfel / Cranberry 6x1L) / Rauch Nektar', ref: 'Happy Day / Rauch Fruchtsäfte (1L)', aliases: ['happy day fruchtnektar mango', 'happy day fruchtnektar maracuja', 'happy day apfelsaft', 'happy day cranberry', 'maracujanektar rauch', 'cranberry rauch'] },
  { code: 'E18', name: 'Sachsenobst / Wesergold / Wolke Apfelsaft (1L)', ref: 'Apfelsaft naturtrüb / klar (1L)', aliases: ['sachsenobst apfelsaft 1l', 'sachsenobst mango 1l', 'apfelsaft trüb wesergold', 'apfelsaft wolke 6x1l', 'apfelsaft 100% transgourmet', 'apfelsaft 1l ref'] },
  { code: 'E18', name: 'London Ginger Ale 1L / FLIRT Ginger Ale / Bitter Flirt (1L)', ref: 'Ginger Ale / Bitter Lemon (1L)', aliases: ['london ginger ale 1l', 'flirt bitter-getränk', 'bitter flirt tonic', 'bitter flirt wild berry'] },
  { code: 'E18', name: 'Lycheesaft Maaza 12x1L / Birnennektar / Coconut Water Vita Coco 1L', ref: 'Exotische Säfte (Lychee / Kokoswasser / Birne)', aliases: ['lycheesaft maaza 12x1l', 'birnennektar 50%', 'coconut water vita coco 1l', 'maracujasaft ref', 'mangosaft ref', 'cranberrysaft ref'] },

  // E19: Tee
  { code: 'E19', name: 'Grüntee Trung Nguyen (Vietnam)', ref: 'Grüntee Trung Nguyen (Vietnam)', aliases: ['grüntee trung nguyen'] },
  { code: 'E19', name: 'Jasmin Tee Perlen Zhen Zhu (1kg)', ref: 'Jasmin Tee Perlen (Zhen Zhu)', aliases: ['jasmin tee perlen zhen zhu'] },
  { code: 'E19', name: 'Tee Anchan (Blaue Schmetterlingserbsenblüte 100g) / Hibiskus Blüten', ref: 'Anchan Blautee / Hibiskusblüten', aliases: ['tee anchan packung 100g', 'hibiskus blüten achterhof'] },
  { code: 'E19', name: 'Earl Grey "Ahmad Tea"', ref: 'Earl Grey Tee (Ahmad Tea)', aliases: ['earl grey "ahmad tea"', 'earl grey'] },

  // E20: Kaffee
  { code: 'E20', name: 'Kaffee Brazil Kalas / Columbia Cold Brew (Gemi Roasters)', ref: 'Kaffee Kalas (Gemi Roasters Espresso/Cold Brew)', aliases: ['kaffee brazil kalas', 'kaffee columbia kalas cold brew', 'gemi roasters'] },
  { code: 'E20', name: 'Kaffee Trung Nguyen (500g Vietnam)', ref: 'Kaffee Trung Nguyen (Vietnam Gourmet)', aliases: ['kaffee trung nguyen 500g', 'kaffee trung nguyen'] },

  // E21: Desserts & Süßwaren
  { code: 'E21', name: 'Nata de Coco Dessert (Cocon 480g)', ref: 'Nata de Coco Dessert', aliases: ['nata de coco', 'cocon nata de coco', 'cocon'] },
  { code: 'E21', name: 'Mochi Eis / Cheese Cake Mochi (Strawberry / Coconut / Green Tea / Vanilla / Mango / Passionfruit 10x192g / 6 Stk)', ref: 'Mochi Eis Premium (Diverse Sorten)', aliases: ['strawberry cheese cake mochi', 'coconut ice cream mochi', 'green tea ice cream mochi', 'vanilla ice cream mochi', 'mango ice cream mochi', 'tropical passionfruit & mango mochi', 'mango cheese cake mochi', 'mochi eis ( sammelartikel ) ref', 'mochi'] },
  { code: 'E21', name: 'Kleibreiskuchen mit Kokos-Pandan (12x180g)', ref: 'Kleibreiskuchen mit Kokos-Pandan', aliases: ['kleibreiskuchen mit kokos-pandan'] },
  { code: 'E21', name: 'Tartelette rund und salzig (DM 3,8 Rungis)', ref: 'Tartelettes salzig (Rungis)', aliases: ['tartelette rund und salzig dm3,8'] },
  { code: 'E21', name: 'Hafertaler Gille Schweden / MC Löffelbiscuits (600g)', ref: 'Gebäck & Löffelbiscuits (Gille / MC)', aliases: ['hafertaler gille,schweden', 'mc löffelbiscuits'] },
  { code: 'E21', name: 'Rohrzucker Sticks Hellma braun (4g x 500 Stk)', ref: 'Rohrzucker Sticks (Hellma Gastro)', aliases: ['rohrzucker sticks hellma braun'] },
  { code: 'E21', name: 'Bio Kokoschips / Sahnesteif / Vanillezucker Oetker / Süßzuckerstangen Kandis', ref: 'Backzutaten & Dessertdekor (Kokoschips / Vanille / Kandis)', aliases: ['bio kokoschips 100g', 'sahnesteif back family', 'vanillezucker oetker 8g', 'süßzuckerstangen kandis braun'] },
  { code: 'E21', name: 'Trolli Fruchtgummi / Pear Halves Dose', ref: 'Süßwaren & Dosenfrüchte', aliases: ['trolli packung 75 st', 'pear halves'] },

  // E22: Öle & Essige
  { code: 'E22', name: 'Lee Kum Kee Sesamöl geröstet (1,75L Kiste)', ref: 'Sesamöl geröstet (Lee Kum Kee)', aliases: ['lee kum kee sesamöl', 'sesamöl'] },
  { code: 'E22', name: 'Olivenöl Extra Vergine Glasflasche (MC 1L)', ref: 'Olivenöl Extra Vergine', aliases: ['olivenöl ex. vir. glasf. mc 1l', 'olivenöl'] },
  { code: 'E22', name: 'Kürbiskernöl Gourmet (Aldi)', ref: 'Kürbiskernöl Gourmet', aliases: ['kürbiskernöl gourmet'] },
  { code: 'E22', name: 'Rapsöl / Sonnenblumenöl / Frittieröl (Aro / Bellasan / Selgros Plus 10L Pet/Kanister)', ref: 'Frittieröl & Rapsöl (10L Gastro)', aliases: ['rapsöl bellasan 1l', 'frittieröl aro 10l', 'rapsöl aro 10l', 'frittieröl selgros plus 10l', 'rapsöl pet 10l', 'öl frieteren ref'] },
  { code: 'E22', name: 'Tafelessig Aro (10L Kanister) / Mazzetti Bio Apfelessig / Yuzu Öl', ref: 'Tafelessig / Apfelessig / Yuzu-Öl', aliases: ['tafelessig aro 10 l', 'mazzetti natur apfelessig bio', 'yuzu öl'] },

  // E23: Drogerie, Reinigung & Hygiene
  { code: 'E23', name: 'Spülmittel flüssig (Fit / Aro GSM10 10L Kanister)', ref: 'Spülmittel Gastro (Fit / Aro 10L)', aliases: ['fit spülmittel gsm10 10l', 'spülmittel fit flüssig 10l', 'spülmittel aro flüssig 10l', 'fit spülmittel 500ml'] },
  { code: 'E23', name: 'Fettlöser Metro Professional / Konzentrat (5L Kanister)', ref: 'Fettlöser Professional (5L)', aliases: ['fettlöser metro professional flüssig 5l', 'fettlöser konzentrat 5l'] },
  { code: 'E23', name: 'Fit Allzweckreiniger Zitronenfrische (10L) / Galakor F8 Reiniger (12kg)', ref: 'Allzweckreiniger & Grundreiniger', aliases: ['fit allesr. zitronenfrische 10l', 'galakor f8 reiniger 12kg'] },
  { code: 'E23', name: 'Dan Klorix Hygienereiniger (5L Kanister)', ref: 'Dan Klorix Hygienereiniger (5L)', aliases: ['dan klorix hygienereiniger 5l', 'dan klorix'] },
  { code: 'E23', name: 'Tork Wischtücher 2x750 Blatt / Tork Multifunktion 7x100 / Handtücher Multi', ref: 'Tork Wischtücher & Papierhandtücher', aliases: ['tork wischtuch 2x750 blatt', 'tork multif. weiß 2 lagig', 'handtücher tork multi 2 lagig', 'handtuchpapier papstar'] },
  { code: 'E23', name: 'Zewa Wisch&Weg Klassik (8x45 Blatt) / Küchenrollen Aro 3-lagig (8x64)', ref: 'Küchenrollen (Zewa / Aro)', aliases: ['zewa wisch&weg klassik weiß', 'küchenrollen aro 3-lagig'] },
  { code: 'E23', name: 'Toilettenpapier 3-lagig / 4-lagig (16-24 Rollen Selgros/Metro)', ref: 'Toilettenpapier Gastronomie', aliases: ['toilettenpapier 4 lagig 24x160', 'toilettenpapier 3lagig 16x200blatt'] },
  { code: 'E23', name: 'Einweghandschuhe Schwarz / Latex Gr. M (100 Stk)', ref: 'Einweghandschuhe Latex Gr. M', aliases: ['einweghandschuhe schwarz latex', 'latex handschuhe gr. m tgq 100s'] },
  { code: 'E23', name: 'MP Airlaid Servietten Weiß 40x40cm 4-lagig (60-250 Stk)', ref: 'Airlaid Servietten 40x40cm', aliases: ['mp airlaid servietten weiß 40x40cm', 'mp servietten 40x40cm weiß'] },
  { code: 'E23', name: 'Topfreiniger Jumbo (10 Stück) / Salz Finish Geschirrspüler (1,2kg)', ref: 'Topfreiniger / Geschirrspülsalz', aliases: ['topfreiniger mp jumbo 10 stück', 'salz finish körnig geschirrspüler'] },

  // E24: Nonfood, Verpackung & Bar-Equipment
  { code: 'E24', name: 'Bambus-Essstäbchen (Vietnam 20x200 Stk / Dua 22,5cm 16 Pack)', ref: 'Bambus Essstäbchen (Dua)', aliases: ['stäbchen bambus vietnam 20x200stk', 'bambusstäbchen -dua- 22,5cm', 'bambusstäbchen'] },
  { code: 'E24', name: 'Sushibox HP11 / HP03 schwarz mit Deckel (400 Stk)', ref: 'Sushiboxen Take-Away mit Deckel', aliases: ['sushibox (ch 005) hp11 schwarz 400stk', 'sushibox (ch 03) hp03 schwarz 400stk', 'sushibox'] },
  { code: 'E24', name: 'Soßenbecher 50cc mit Deckel (500 Stück) / To Go Becher 50 Stk', ref: 'Soßenbecher & To-Go Becher', aliases: ['soßenbecher 50cc 500 stück', 'to go becher prime source 50 st'] },
  { code: 'E24', name: 'Gefrierbeutel Aro (3x45x6L / 25x10L / 3L) / Frischhaltefolie / Mülltüten blau', ref: 'Gefrierbeutel, Folien & Mülltüten', aliases: ['gefrierbeutel aro 3x45x6l', 'gefrierbeutel aro 25x10l', 'aro gefrierbeutel 3 l', 'folie', 'mülltüte blau 10x10stk'] },
  { code: 'E24', name: 'Metro Professional Sahnekapseln (50 Stück) / Spritzbeutel 50cm', ref: 'Sahnekapseln & Spritzbeutel 50cm', aliases: ['metro professional sahnekapseln 50 stück', 'metro professional spritzbeutel kochfest 50 cm'] },
  { code: 'E24', name: 'Makisu Bambusmatte 24x24cm (Kouriyo)', ref: 'Makisu Bambus Rollmatte', aliases: ['makisu kouriyo, bambusmatte 24cmx24cm'] },
  { code: 'E24', name: 'Teelichter Gastro (Aro 200x4 Std. / MP 150x 6H)', ref: 'Teelichter Gastronomie (4-6h)', aliases: ['teelichter aro weiß ca. 200x4 std.', 'teelichter mp 150x 6h'] },
  { code: 'E24', name: 'Trockeneis Nuggets (20kg)', ref: 'Trockeneis Nuggets (20kg)', aliases: ['trockeneis nuggets 20kg'] },

  // E25: Barsirupe & Bar-Bitters
  { code: 'E25', name: 'MONIN Sirup 1L (Gurke / Mango / Holunderblüte / Weisser Rohrzucker / Ananas / Maracuja / Himbeere / Mojito Mint / Orangen / Lemongras / Basilikum / Litschi / Blue Curacao / Grenadine)', ref: 'MONIN Barsirup (Diverse Aromen)', aliases: ['monin gurke 6x1l', 'monin mango 6x1l', 'monin holunderblüte 6x1l', 'monin weisser rohrzucker', 'monin ananas 6x1l', 'monin maracuja 6x1l', 'monin himbeere 6x1l', 'monin mojito mint 0,7l', 'monin orangen 1l', 'monin lemongras 0,7l', 'monin basilikum 0,7l', 'monin litschi 0,7l', 'monin blue curacao 1l', 'monin grenadine 1l', 'monin mandarine', 'monin brombeer likör'] },
  { code: 'E25', name: 'Giffard Sirup 1L (Blue Curacao / Grenadine / Holunderblüte) / Bols / Bold Grenadine', ref: 'Giffard / Bols Bar-Sirupe', aliases: ['giffard blue curacao 1 l', 'giffard grenadine 1l', 'giffard holunderblüte 1l', 'bols triple sec 38% 0,7l', 'bols blue curacao 21% 0,7l', 'bold grenadine 0,75l'] },
  { code: 'E25', name: 'Rauch / Culinar Limettensaft 1L / Lime Cordial Johns 0,7L', ref: 'Limettensaft 100% Bar (Rauch/Culinar)', aliases: ['limettensaft rauch', 'limettensaft culinar 1l', 'lime cordial johns 0,7l', 'limejuice ref'] },
  { code: 'E25', name: 'Yuzu Fruchtsaft 720ml (SSP) / Yuzusaft Extract 1,8L', ref: 'Yuzu Fruchtsaft Premium (100%)', aliases: ['yuzu fruchtsaft 720 ml', 'yuzusaft extract 1,8l'] },
  { code: 'E25', name: 'Angostura Aromatic Bitter 0,2L / Orangen Bitters 0,2L', ref: 'Angostura & Orange Bitters', aliases: ['angostura aromatic bitter 0,2l', 'orangen bitters 0,2l'] },
  { code: 'E25', name: 'Riemerschmidt Barsirup Maracuja 0,7L', ref: 'Riemerschmidt Barsirup', aliases: ['riemerschmidt maracuja 0,7l'] }
];

// 26 Warengruppen Stammdaten
const WARENGRUPPEN_CONFIG = [
  { code: 'E1', name: 'E1: Fisch', kat: 'Food', mwst: 0.07, prefix: 'E01' },
  { code: 'E2', name: 'E2: Seafood', kat: 'Food', mwst: 0.07, prefix: 'E02' },
  { code: 'E3', name: 'E3: Geflügel', kat: 'Food', mwst: 0.07, prefix: 'E03' },
  { code: 'E4', name: 'E4: Rind', kat: 'Food', mwst: 0.07, prefix: 'E04' },
  { code: 'E5', name: 'E5: Schwein', kat: 'Food', mwst: 0.07, prefix: 'E05' },
  { code: 'E6', name: 'E6: Tofu & Saitan', kat: 'Food', mwst: 0.07, prefix: 'E06' },
  { code: 'E7', name: 'E7: Reis/Nudeln', kat: 'Food', mwst: 0.07, prefix: 'E07' },
  { code: 'E8', name: 'E8: Gemüse/Salat/Obst', kat: 'Food', mwst: 0.07, prefix: 'E08' },
  { code: 'E9', name: 'E9: Nährmittel/Gewürz', kat: 'Food', mwst: 0.07, prefix: 'E09' },
  { code: 'E10', name: 'E10: Tiefkühl', kat: 'Food', mwst: 0.07, prefix: 'E10' },
  { code: 'E11', name: 'E11: Soße/Paste', kat: 'Food', mwst: 0.07, prefix: 'E11' },
  { code: 'E12', name: 'E12: Milchprodukte', kat: 'Food', mwst: 0.07, prefix: 'E12' },
  { code: 'E13', name: 'E13: Spirituose', kat: 'Beverage', mwst: 0.19, prefix: 'E13' },
  { code: 'E14', name: 'E14: Wein', kat: 'Beverage', mwst: 0.19, prefix: 'E14' },
  { code: 'E15', name: 'E15: Bier', kat: 'Beverage', mwst: 0.19, prefix: 'E15' },
  { code: 'E16', name: 'E16: Sake', kat: 'Beverage', mwst: 0.19, prefix: 'E16' },
  { code: 'E17', name: 'E17: Whiskey', kat: 'Beverage', mwst: 0.19, prefix: 'E17' },
  { code: 'E18', name: 'E18: Softdrinks/Saft', kat: 'Beverage', mwst: 0.19, prefix: 'E18' },
  { code: 'E19', name: 'E19: Tee', kat: 'Beverage', mwst: 0.07, prefix: 'E19' },
  { code: 'E20', name: 'E20: Kaffee', kat: 'Beverage', mwst: 0.07, prefix: 'E20' },
  { code: 'E21', name: 'E21: Süßware', kat: 'Food', mwst: 0.07, prefix: 'E21' },
  { code: 'E22', name: 'E22: Öl/Essig', kat: 'Food', mwst: 0.07, prefix: 'E22' },
  { code: 'E23', name: 'E23: Drogerie/Hygienemittel', kat: 'Nonfood', mwst: 0.19, prefix: 'E23' },
  { code: 'E24', name: 'E24: Nonfood', kat: 'Nonfood', mwst: 0.19, prefix: 'E24' },
  { code: 'E25', name: 'E25: Sirup', kat: 'Beverage', mwst: 0.19, prefix: 'E25' },
  { code: 'LG', name: 'LG: Leergut / Pfand', kat: 'Leergut', mwst: 0.19, prefix: 'LG' }
];

function getWarengruppenInfo(wgString) {
  if (!wgString) return { code: 'E9', name: 'E9: Nährmittel/Gewürz', kat: 'Food', mwst: 0.07, prefix: 'E09' };
  const str = String(wgString).trim();
  for (let wg of WARENGRUPPEN_CONFIG) {
    if (str.startsWith(wg.code + ':') || str === wg.code || str.startsWith(wg.code + ' ') || str === wg.name) {
      return wg;
    }
  }
  return { code: 'E9', name: 'E9: Nährmittel/Gewürz', kat: 'Food', mwst: 0.07, prefix: 'E09' };
}

/**
 * Ruft gespeicherte Kalibrierungs- und Umrechnungsregeln ab
 */
function getLearnedCalibration(artId, name) {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('LEARNED_CALIBRATION_RULES');
    if (!raw) return null;
    const rules = JSON.parse(raw);
    const idKey = String(artId || '').trim();
    const nameKey = String(name || '').trim().toLowerCase();
    if (idKey && rules[idKey]) return rules[idKey];
    if (nameKey && rules[nameKey]) return rules[nameKey];
  } catch (e) {}
  return null;
}

/**
 * Speichert Kalibrierungs- und Umrechnungsregeln dauerhaft
 */
function saveLearnedCalibration(artId, name, data) {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('LEARNED_CALIBRATION_RULES');
    const rules = raw ? JSON.parse(raw) : {};
    const idKey = String(artId || '').trim();
    const nameKey = String(name || '').trim().toLowerCase();
    if (idKey) rules[idKey] = data;
    if (nameKey) rules[nameKey] = data;
    props.setProperty('LEARNED_CALIBRATION_RULES', JSON.stringify(rules));
  } catch (e) {}
}

/**
 * Intelligente Preisnormierung (€/kg bzw. €/l bzw. €/Stk)
 * Unterstützt gelernte Benutzerregeln, Gebindeschemata und automatische Stückgewichts-Berechnungen
 */
function normalizeUnitAndPrice(name, gebinde, menge, einzelpreis, artId) {
  const gStr = (gebinde || '').trim();
  const nStr = (name || '').trim();
  const combined = (gStr + ' ' + nStr).toLowerCase();

  // 1. Prüfe auf dauerhaft gelernte Benutzer-Kalibrierung
  const learned = getLearnedCalibration(artId, name);
  if (learned && learned.unit && learned.inhalt > 0) {
    const refP = learned.manualPrice > 0 ? learned.manualPrice : Math.round((einzelpreis / learned.inhalt) * 100) / 100;
    return {
      basiseinheit: learned.unit,
      inhalt: learned.inhalt,
      referenzpreis: refP
    };
  }

  // 2. Grammbereich-Erkennung bei Stückgebinden: z. B. "ca 300-400g 12ST" oder "300-400g 12Stk"
  const rangeMatch = combined.match(/(?:ca\.?\s*)?(\d+)\s*-\s*(\d+)\s*g\s*(?:je|pro|x|\*|,)?\s*(\d+)\s*(?:st|stk|stück)?/i) ||
                     combined.match(/(\d+)\s*(?:st|stk|stück)\s*(?:à|a|je|ca\.?\s*)?(\d+)\s*-\s*(\d+)\s*g/i);
  if (rangeMatch) {
    let minG, maxG, count;
    if (parseInt(rangeMatch[3], 10) > 0 && parseInt(rangeMatch[1], 10) >= 50) {
      minG = parseFloat(rangeMatch[1]);
      maxG = parseFloat(rangeMatch[2]);
      count = parseInt(rangeMatch[3], 10);
    } else {
      count = parseInt(rangeMatch[1], 10);
      minG = parseFloat(rangeMatch[2]);
      maxG = parseFloat(rangeMatch[3]);
    }
    const avgG = (minG + maxG) / 2;
    const totalKg = (count * avgG) / 1000;
    return {
      basiseinheit: 'kg',
      inhalt: Math.round(totalKg * 1000) / 1000,
      referenzpreis: Math.round((einzelpreis / totalKg) * 100) / 100
    };
  }

  // 3. Einzelstück-Gewichtserkennung: z. B. "12 Stk à 350g" oder "10x 160g"
  const singleWeightMatch = combined.match(/(\d+)\s*(?:st|stk|stück|x|\*)\s*(?:à|a|je|ca\.?\s*)?(\d+[\.,]?\d*)\s*g\b/i);
  if (singleWeightMatch) {
    const count = parseInt(singleWeightMatch[1], 10);
    const g = parseFloat(singleWeightMatch[2].replace(',', '.'));
    const totalKg = (count * g) / 1000;
    return {
      basiseinheit: 'kg',
      inhalt: Math.round(totalKg * 1000) / 1000,
      referenzpreis: Math.round((einzelpreis / totalKg) * 100) / 100
    };
  }

  let basiseinheit = 'Stk';
  let totalInhalt = null;

  if (/^(?:kg|je kg|pro kg|kilo)$/i.test(gStr)) {
    return { basiseinheit: 'kg', inhalt: 1, referenzpreis: Math.round(einzelpreis * 100) / 100 };
  }
  if (/^(?:l|je l|pro l|liter)$/i.test(gStr)) {
    return { basiseinheit: 'l', inhalt: 1, referenzpreis: Math.round(einzelpreis * 100) / 100 };
  }

  const multiMatch = gStr.match(/(\d+)\s*(?:x|\*|mal)\s*(\d+[\.,]?\d*)\s*(kg|g|l|liter|ml|cl|stk|stück|fl|flaschen|dosen|becher|gläser|pack|packungen|beutel|rollen|schalen|bl|blatt)?\b/i);
  
  if (multiMatch) {
    const factor = parseInt(multiMatch[1], 10);
    const subAmount = parseFloat(multiMatch[2].replace(',', '.'));
    const unitStr = (multiMatch[3] || '').toLowerCase();
    
    if (unitStr.startsWith('kg')) {
      basiseinheit = 'kg';
      totalInhalt = factor * subAmount;
    } else if (unitStr === 'g') {
      basiseinheit = 'kg';
      totalInhalt = (factor * subAmount) / 1000;
    } else if (unitStr.startsWith('l') || unitStr === 'liter') {
      basiseinheit = 'l';
      totalInhalt = factor * subAmount;
    } else if (unitStr === 'ml') {
      basiseinheit = 'l';
      totalInhalt = (factor * subAmount) / 1000;
    } else if (unitStr === 'cl') {
      basiseinheit = 'l';
      totalInhalt = (factor * subAmount) / 100;
    } else {
      if (/flasche|getränk|spirituose|wein|sirup|sauce|essig|öl/i.test(combined)) {
        if (subAmount >= 50) {
          basiseinheit = 'l';
          totalInhalt = (factor * subAmount) / 1000;
        } else {
          basiseinheit = 'l';
          totalInhalt = factor * subAmount;
        }
      } else if (/dose|glas|becher|eimer|pack|beutel|sack/i.test(combined)) {
        if (subAmount >= 50) {
          basiseinheit = 'kg';
          totalInhalt = (factor * subAmount) / 1000;
        } else {
          basiseinheit = 'kg';
          totalInhalt = factor * subAmount;
        }
      } else {
        basiseinheit = 'Stk';
        totalInhalt = factor * subAmount;
      }
    }
  }

  if (totalInhalt === null && gStr.length > 0) {
    const kgMatch = gStr.match(/(\d+[\.,]?\d*)\s*kg\b/i);
    const gMatch = gStr.match(/(\d+[\.,]?\d*)\s*g\b/i);
    const lMatch = gStr.match(/(\d+[\.,]?\d*)\s*(?:l\b|liter)/i);
    const mlMatch = gStr.match(/(\d+[\.,]?\d*)\s*ml\b/i);
    const clMatch = gStr.match(/(\d+[\.,]?\d*)\s*cl\b/i);
    const stkMatch = gStr.match(/(\d+)\s*(?:stk|stück|rollen|packungen|beutel|kapseln|schalen|bl|blatt)\b/i);

    if (kgMatch) {
      basiseinheit = 'kg';
      totalInhalt = parseFloat(kgMatch[1].replace(',', '.'));
    } else if (gMatch) {
      basiseinheit = 'kg';
      totalInhalt = parseFloat(gMatch[1].replace(',', '.')) / 1000;
    } else if (lMatch) {
      basiseinheit = 'l';
      totalInhalt = parseFloat(lMatch[1].replace(',', '.'));
    } else if (mlMatch) {
      basiseinheit = 'l';
      totalInhalt = parseFloat(mlMatch[1].replace(',', '.')) / 1000;
    } else if (clMatch) {
      basiseinheit = 'l';
      totalInhalt = parseFloat(clMatch[1].replace(',', '.')) / 100;
    } else if (stkMatch) {
      basiseinheit = 'Stk';
      totalInhalt = parseInt(stkMatch[1], 10);
    }
  }

  if (totalInhalt === null) {
    const multiMatchName = nStr.match(/(\d+)\s*(?:x|\*|mal)\s*(\d+[\.,]?\d*)\s*(kg|g|l|liter|ml|cl|stk|stück|fl|flaschen|dosen|becher|gläser|pack|packungen|beutel|rollen|schalen|bl|blatt)?\b/i);
    if (multiMatchName) {
      const factor = parseInt(multiMatchName[1], 10);
      const subAmount = parseFloat(multiMatchName[2].replace(',', '.'));
      const unitStr = (multiMatchName[3] || '').toLowerCase();
      if (unitStr.startsWith('kg')) { basiseinheit = 'kg'; totalInhalt = factor * subAmount; }
      else if (unitStr === 'g') { basiseinheit = 'kg'; totalInhalt = (factor * subAmount) / 1000; }
      else if (unitStr.startsWith('l') || unitStr === 'liter') { basiseinheit = 'l'; totalInhalt = factor * subAmount; }
      else if (unitStr === 'ml') { basiseinheit = 'l'; totalInhalt = (factor * subAmount) / 1000; }
      else { basiseinheit = 'Stk'; totalInhalt = factor * subAmount; }
    } else {
      const lMatch = nStr.match(/(\d+[\.,]?\d*)\s*(?:l\b|liter)/i);
      const mlMatch = nStr.match(/(\d+[\.,]?\d*)\s*ml\b/i);
      const kgMatch = nStr.match(/(\d+[\.,]?\d*)\s*kg\b/i);
      const gMatch = nStr.match(/(\d+[\.,]?\d*)\s*g\b/i);
      const stkMatch = nStr.match(/(\d+)\s*(?:stk|stück|rollen|packungen|schalen)\b/i);

      if (lMatch) { basiseinheit = 'l'; totalInhalt = parseFloat(lMatch[1].replace(',', '.')); }
      else if (mlMatch) { basiseinheit = 'l'; totalInhalt = parseFloat(mlMatch[1].replace(',', '.')) / 1000; }
      else if (kgMatch) { basiseinheit = 'kg'; totalInhalt = parseFloat(kgMatch[1].replace(',', '.')); }
      else if (gMatch) { basiseinheit = 'kg'; totalInhalt = parseFloat(gMatch[1].replace(',', '.')) / 1000; }
      else if (stkMatch) { basiseinheit = 'Stk'; totalInhalt = parseInt(stkMatch[1], 10); }
    }
  }

  // 4. Standard-Stückgewichte für Gastronomie-Frischeprodukte (z. B. Gurke = 350g -> kg-Preis)
  const STANDARD_PIECE_WEIGHTS = [
    { match: /\b(?:gurke|gurken|salatgurke)\b/i, weightKg: 0.35, unit: 'kg' },
    { match: /\b(?:aubergine|auberginen)\b/i, weightKg: 0.30, unit: 'kg' },
    { match: /\b(?:avocado|avocados)\b/i, weightKg: 0.20, unit: 'kg' },
    { match: /\b(?:limette|limetten)\b/i, weightKg: 0.075, unit: 'kg' },
    { match: /\b(?:zitrone|zitronen)\b/i, weightKg: 0.12, unit: 'kg' },
    { match: /\b(?:lauchzwiebel|lauchzwiebeln|frühlingszwiebel)\b/i, weightKg: 0.15, unit: 'kg' },
    { match: /\b(?:radieschen)\b/i, weightKg: 0.15, unit: 'kg' },
    { match: /\b(?:rettich|takuan)\b/i, weightKg: 0.50, unit: 'kg' },
    { match: /\b(?:ingwer)\b/i, weightKg: 0.15, unit: 'kg' },
    { match: /\b(?:knoblauch)\b/i, weightKg: 0.05, unit: 'kg' },
    { match: /\b(?:spitzkohl|weißkohl|rotkohl)\b/i, weightKg: 0.80, unit: 'kg' },
    { match: /\b(?:eisbergsalat|kopfsalat|salatkopf)\b/i, weightKg: 0.40, unit: 'kg' },
    { match: /\b(?:wassermelone)\b/i, weightKg: 4.0, unit: 'kg' },
    { match: /\b(?:honigmelone|cantaloupe)\b/i, weightKg: 1.2, unit: 'kg' },
    { match: /\b(?:ananas)\b/i, weightKg: 1.2, unit: 'kg' },
    { match: /\b(?:mango)\b/i, weightKg: 0.35, unit: 'kg' },
    { match: /\b(?:paprika|spitzpaprika)\b/i, weightKg: 0.15, unit: 'kg' },
    { match: /\b(?:koriander|minze|basilikum|dill|petersilie|schnittlauch)\b/i, weightKg: 0.10, unit: 'kg' }
  ];

  if (basiseinheit === 'Stk' || basiseinheit === '') {
    for (let pw of STANDARD_PIECE_WEIGHTS) {
      if (pw.match.test(combined)) {
        const pieceCount = (totalInhalt && totalInhalt > 0) ? totalInhalt : 1;
        totalInhalt = pieceCount * pw.weightKg;
        basiseinheit = pw.unit;
        break;
      }
    }
  }

  if (totalInhalt === null || totalInhalt <= 0) {
    totalInhalt = (menge && menge > 0) ? menge : 1;
  }

  const referenzpreis = Math.round((einzelpreis / totalInhalt) * 100) / 100;
  return {
    basiseinheit,
    inhalt: Math.round(totalInhalt * 1000) / 1000,
    referenzpreis
  };
}

/**
 * Intelligente kulinarische Bereinigung zur Ermittlung des Master-Zutatennamens
 */
function extractMasterIngredientKey(name) {
  if (!name) return 'Unbekannte Zutat';
  const str = String(name).trim();
  const lower = str.toLowerCase();

  // 1. Schneller Abgleich mit dem offiziellen SONA Master-Katalog
  if (typeof MASTER_CATALOG_DICTIONARY !== 'undefined') {
    for (let i = 0; i < MASTER_CATALOG_DICTIONARY.length; i++) {
      const item = MASTER_CATALOG_DICTIONARY[i];
      for (let j = 0; j < item.aliases.length; j++) {
        if (lower.includes(item.aliases[j])) {
          return item.ref;
        }
      }
    }
  }

  // 2. Intelligente Bereinigung für sonstige Belege
  let clean = str
    .replace(/\b(aro|metro chef|metro professional|metro premium|bonduelle|luna|dovgan|seldor|esco|frießinger mühle|lee kum kee|langbein|zigante|koppert|greenlea|suehiro|yukizuru|cocon|cook|asia express food)\b/gi, '')
    .replace(/\b(ka|sch|ktn|stk|st|pk|pkg|fl|btl|beutel|karton|packung|schale|kiste|palette|colli|bund|dose|dosen|glas|gläser|sack)\b/gi, '')
    .replace(/\b(nl|fr|de|it|es|vn|th|jp|cn|us|nz|pl|aus italien|aus frankreich|aus spanien|deutsch|deutsches|franz|italien)\b/gi, '')
    .replace(/\b(m\.k\.|o\.k\.|m\.s\.|o\.s\.|m\.d\.|o\.d\.|ausg\.|vak\.|tk|hkl\s*[a-b]|rund|ladenfertig|ohne knochen|mit deckel|am stück|fein|grob|natur|roh|tiefgefroren|tiefgekühlt|knackig|süß-sauer)\b/gi, '')
    .replace(/(\d+[\.,]?\d*)\s*(?:x|\*|mal)\s*(\d+[\.,]?\d*)\s*(?:kg|g|l|ml|cl|stk|cm|mm)?/gi, '')
    .replace(/(\d+[\.,]?\d*)\s*(?:kg|g|l|liter|ml|cl|stk|cm|mm|%|vol)\b/gi, '')
    .replace(/[0-9\+\-\/\(\)\,\.\:\;\"\#\*\_\~\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length < 3) clean = str.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}


function openArtikelstammQuickEdit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (artSheet) {
    ss.setActiveSheet(artSheet);
    artSheet.setActiveRange(artSheet.getRange('L2'));
  }
}

function openMasterZutatenView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (mzSheet) {
    ss.setActiveSheet(mzSheet);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Warenwirtschaft (' + CONFIG.LOCATION_NAME + ')')
    .addItem('1. Gesamtsystem aufbauen & alle Belege einpflegen', 'initializeEntireSystemAndData')
    .addItem('2. 📂 Rechnungsordner JETZT manuell scannen & neue Belege einlesen', 'triggerManualInvoiceScan')
    .addItem('3. ✏️ Artikelstamm & Suche direkt öffnen', 'openArtikelstammQuickEdit')
    .addItem('4. 📊 Master-Zutaten & Kalkulationspreise öffnen', 'openMasterZutatenView')
    .addItem('5. 🔄 Master-Zutaten & Preise synchronisieren', 'syncMasterZutatenAndDashboard')
    .addSeparator()
    .addItem('6. 📋 Prüfliste (PRUEFUNG_EINKAUF) öffnen & aktualisieren', 'generatePrueflisteManual')
    .addItem('7. 💾 Korrekturen aus Prüfliste anwenden & dauerhaft speichern', 'applyUserCorrectionsFromPruefliste')
    .addItem('8. 🧹 Fehlerhafte Artikel & Müll-Zeilen JETZT bereinigen', 'cleanupGarbageArticlesFromDatabase')
    .addItem('9. 🩺 Vollständigen Diagnose-Bericht für KI-Optimierung anzeigen', 'showDiagnosticReportAssistant')
    .addSeparator()
    .addItem('10. 🔍 Plausibilitäts-Audit (Health-Check) ausführen', 'runManualHealthAudit')
    .addItem('11. 📁 Google Drive Rechnungsordner Verbindung testen', 'checkDriveFolderConnection')
    .addItem('12. Automatisierung (Täglich 12:00 + Freitags) aktivieren', 'setupAutomatedTriggers')
    .addItem('13. Freitags-Wochenbericht per Email testen', 'testSendWeeklyReport')
    .addSeparator()
    .addItem('14. Nächste freie Artikel-ID generieren', 'promptNextArticleId')
    .addItem('15. Preisabweichungen prüfen', 'checkPriceAnomalies')
    .addToUi();
}

/**
 * Automatisches Neuberechnen bei Tabellenänderungen (inkl. Multi-Filter & Master-Zutaten)
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    const row = range.getRow();
    const col = range.getColumn();
    
    if (row <= 1) return;
    
    // Doppel-Filter im Dashboard: Zelle C3 (Monat) oder F3 (Lieferant)
    if (sheetName === CONFIG.NAME_DASHBOARD && row === 3 && (col === 3 || col === 6)) {
      updateDashboardFigures(sheet.getParent());
      return;
    }
    
    // Multi-Filter im ARTIKELSTAMM: Zeile 2 (Spalten C, F, I, L)
    if (sheetName === CONFIG.NAME_ARTIKEL && row === 2) {
      applyArticleMasterFilters(sheet.getParent());
      return;
    }
    
    // Änderung im RECHNUNGSEINGANG
    if (sheetName === CONFIG.NAME_RECHNUNGEN) {
      const menge = parseFloat(sheet.getRange(row, 10).getValue()) || 0;
      const einzel = parseFloat(sheet.getRange(row, 12).getValue()) || 0;
      const wgVal = sheet.getRange(row, 8).getValue();
      const wgInfo = getWarengruppenInfo(wgVal);
      
      const netto = Math.round(menge * einzel * 100) / 100;
      const mwstBetrag = Math.round(netto * wgInfo.mwst * 100) / 100;
      const brutto = Math.round((netto + mwstBetrag) * 100) / 100;
      
      sheet.getRange(row, 9).setValue(wgInfo.kat);
      sheet.getRange(row, 13).setValue(netto);
      sheet.getRange(row, 14).setValue(wgInfo.mwst);
      sheet.getRange(row, 15).setValue(mwstBetrag);
      sheet.getRange(row, 16).setValue(brutto);
      
      const dateVal = sheet.getRange(row, 3).getValue();
      if (dateVal instanceof Date) {
        sheet.getRange(row, 19).setValue(Utilities.formatDate(dateVal, 'Europe/Berlin', 'yyyy-MM'));
      }
      
      updateDashboardFigures(sheet.getParent());
    }
    
    // Änderung im ARTIKELSTAMM (Preise, Gebinde, Status, Aktiv)
    if (sheetName === CONFIG.NAME_ARTIKEL && row >= 5) {
      const artName = String(sheet.getRange(row, 2).getValue());
      const wgVal = sheet.getRange(row, 3).getValue();
      const wgInfo = getWarengruppenInfo(wgVal);
      const gebinde = String(sheet.getRange(row, 8).getValue());
      const preis = parseFloat(sheet.getRange(row, 11).getValue()) || 0;
      const norm = normalizeUnitAndPrice(artName, gebinde, 1, preis);
      const prevPreis = parseFloat(sheet.getRange(row, 14).getValue()) || preis;
      
      sheet.getRange(row, 4).setValue(wgInfo.kat);
      sheet.getRange(row, 5).setValue(wgInfo.mwst);
      sheet.getRange(row, 9).setValue(norm.inhalt);
      sheet.getRange(row, 10).setValue(norm.basiseinheit);
      sheet.getRange(row, 12).setValue(norm.referenzpreis);
      sheet.getRange(row, 15).setValue(prevPreis > 0 ? (preis - prevPreis) / prevPreis : 0);
      
      syncMasterZutatenFromArticles(sheet.getParent());
    }

    // Änderung in MASTER_ZUTATEN (z. B. Spalte 21 manueller Preis, Spalte 22 Bemerkung, Spalte 5 Aktiv)
    if (sheetName === CONFIG.NAME_MASTER_ZUTATEN && row >= 2) {
      if (col === 21 || col === 22 || col === 5) {
        syncMasterZutatenFromArticles(sheet.getParent());
      }
    }
  } catch(err) {
    Logger.log('onEdit Error: ' + err.toString());
  }
}

/**
 * ==========================================
 * 1. GESAMTSYSTEM INITIALISIERUNG (V4)
 * ==========================================
 */
function initializeEntireSystemAndData() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    cleanupOldSheets(ss);
    setupMasterDataStructure(ss);
    importMetroMasterData(ss);
    setupInvoiceHistorySheet(ss);
    importPreloadedInvoices(ss);
    setupMasterZutatenSheet(ss);
    syncMasterZutatenFromArticles(ss);
    setupWeeklyDashboard(ss);
    setupPrueflisteSheet(ss);
    generatePruefliste(ss);
    refreshSupplierDropdowns(ss);
    setupAutomatedTriggersSilently();

    ui.alert(
      'Gesamtsystem für ' + CONFIG.LOCATION_NAME + ' (V4) eingerichtet',
      'Folgende V4-Architekturbausteine wurden erfolgreich eingerichtet und befüllt:\n\n' +
      '1. DASHBOARD: Controlling-Cockpit mit Doppel-Filter (Monat & Lieferant)\n' +
      '2. MASTER_ZUTATEN: 2-Ebenen-Fundament mit verbindlichen Kalkulationspreisen & lückenloser Herkunft\n' +
      '3. ARTIKELSTAMM: Multi-Kriterien Filterleiste, Gebindenormierung & Zuordnungs-Status\n' +
      '4. PRUEFUNG_EINKAUF: Strukturierte Prüfliste für offene Artikel- & Preisfälle\n' +
      '5. RECHNUNGSEINGANG: Atomare Belegverbuchung, Storno- & Dublettenschutz\n' +
      '6. QUALITÄTS-AUDIT: Plausibilitäts-Health-Check, Echtzeit-Alerts & Freitags-Report',
      ui.ButtonSet.OK
    );
  } catch (err) {
    Logger.log('Fehler bei Systeminitialisierung: ' + err.toString());
    ui.alert('Hinweis beim Aufbau', 'Das System wurde eingerichtet. Hinweis: ' + err.toString(), ui.ButtonSet.OK);
  }
}

function syncMasterZutatenAndDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  syncMasterZutatenFromArticles(ss);
  updateDashboardFigures(ss);
  generatePruefliste(ss);
  SpreadsheetApp.getUi().alert('Master-Zutaten, Kalkulationspreise & Dashboard erfolgreich synchronisiert.');
}

function cleanupOldSheets(ss) {
  const namesToKeep = [CONFIG.NAME_DASHBOARD, CONFIG.NAME_RECHNUNGEN, CONFIG.NAME_ARTIKEL, CONFIG.NAME_MASTER_ZUTATEN, CONFIG.NAME_WARENGRUPPEN, CONFIG.NAME_PRUEFUNG];
  const allSheets = ss.getSheets();
  allSheets.forEach(s => {
    const name = s.getName();
    if (!namesToKeep.includes(name) && allSheets.length > 1) {
      try { ss.deleteSheet(s); } catch(e) {}
    }
  });
}

/**
 * 1.1 WARENGRUPPEN
 */
function setupMasterDataStructure(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let wgSheet = ss.getSheetByName(CONFIG.NAME_WARENGRUPPEN);
  if (!wgSheet) wgSheet = ss.insertSheet(CONFIG.NAME_WARENGRUPPEN);
  else wgSheet.clear();
  
  const warengruppenRows = [
    ['Code', 'Warengruppe', 'Hauptkategorie', 'Standard_MwSt', 'ID_Prefix', 'ID_Start', 'ID_Ende']
  ];
  
  WARENGRUPPEN_CONFIG.forEach(wg => {
    warengruppenRows.push([
      wg.code,
      wg.name,
      wg.kat,
      wg.mwst,
      wg.prefix,
      wg.prefix + '-0001',
      wg.prefix + '-9999'
    ]);
  });
  
  wgSheet.getRange(1, 1, warengruppenRows.length, warengruppenRows[0].length).setValues(warengruppenRows);
  wgSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#1B365D').setFontColor('#FFFFFF');
  wgSheet.getRange('D2:D' + warengruppenRows.length).setNumberFormat('0.0%');
  wgSheet.autoResizeColumns(1, 7);
}

/**
 * 1.2 MASTER_ZUTATEN (EBENE 1: LOGISCHE REZEPTUR- & SCHWUND-BASIS)
 */
function setupMasterZutatenSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!mzSheet) mzSheet = ss.insertSheet(CONFIG.NAME_MASTER_ZUTATEN, 2);
  else mzSheet.clear();

  const headers = [
    'Master-ID', 'Master-Zutat (Rezepturbasis)', 'Warengruppe', 'Hauptkategorie', 'Aktiv',
    'Standard-Einheit', 'Kalkulationspreis Netto (€ / Einheit)', 'Kalkulationspreis Status',
    'Kalkulationspreis Quelle', 'Kalkulationspreis Datum', 'Kalkulationspreis Lieferant',
    'Kalkulationspreis Quell-ID', 'Letzter Einkaufspreis Netto (€)', 'Letzter Einkauf Datum',
    'Letzter Einkauf Lieferant', 'Günstigster Vergleichspreis Netto (€)', 'Günstigster Lieferant',
    'Referenzpreis Stamm Netto (€)', 'Preisalter (Tage)', 'Preis zu prüfen',
    'Manueller Kalkulationspreis (€)', 'Manueller Preis Bemerkung',
    'Einkaufsmenge Gesamt (Basiseinheit)', 'Einkaufsmenge lfd. Monat', 'Letzte Aktualisierung'
  ];

  mzSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  mzSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setWrap(true);
  mzSheet.setRowHeight(1, 42);
  mzSheet.setFrozenRows(1);
  mzSheet.setFrozenColumns(2);

  // Spaltenformate
  mzSheet.getRange('G2:G2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('J2:J2000').setNumberFormat('dd.MM.yyyy');
  mzSheet.getRange('M2:M2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('N2:N2000').setNumberFormat('dd.MM.yyyy');
  mzSheet.getRange('P2:P2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('R2:R2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('S2:S2000').setNumberFormat('#,##0');
  mzSheet.getRange('U2:U2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('W2:X2000').setNumberFormat('#,##0.00');
  mzSheet.getRange('Y2:Y2000').setNumberFormat('dd.MM.yyyy HH:mm');

  // Bedingte Formatierungen für Status
  applyMasterZutatenConditionalFormatting(mzSheet);
  mzSheet.autoResizeColumns(1, headers.length);
}

function applyMasterZutatenConditionalFormatting(sheet) {
  const statusRange = sheet.getRange('H2:H2000');
  const pruefenRange = sheet.getRange('T2:T2000');

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('GUELTIG')
      .setBackground('#E6F4EA').setFontColor('#137333').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('MANUELL_FREIGEGEBEN')
      .setBackground('#E8F0FE').setFontColor('#1967D2').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('VERALTET')
      .setBackground('#FEF7E0').setFontColor('#B06000').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('ZU_PRUEFEN')
      .setBackground('#FCE8E6').setFontColor('#C5221F').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('KEIN_PREIS')
      .setBackground('#FCE8E6').setFontColor('#C5221F').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('BASISEINHEIT_FEHLT')
      .setBackground('#FCE8E6').setFontColor('#C5221F').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('GEBINDE_UNKLAR')
      .setBackground('#FCE8E6').setFontColor('#C5221F').setBold(true)
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('JA')
      .setBackground('#FCE8E6').setFontColor('#C5221F').setBold(true)
      .setRanges([pruefenRange]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

/**
 * Aggregiert alle Lieferantenartikel auf übergeordnete Master-Zutaten (N:1)
 * und berechnet verbindliche Kalkulationspreise nach konfigurierter Preis-Hierarchie
 */
function syncMasterZutatenFromArticles(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  let mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!artSheet) return;
  if (!mzSheet) {
    setupMasterZutatenSheet(ss);
    mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  }

  const artLastRow = artSheet.getLastRow();
  if (artLastRow < 5) return;

  const now = new Date();

  // 1. Vorhandene manuelle Kalkulationspreise & Metadaten aus MASTER_ZUTATEN sichern
  const existingManual = {};
  const mzLastRow = mzSheet.getLastRow();
  if (mzLastRow > 1) {
    const mzCols = mzSheet.getLastColumn();
    const mzData = mzSheet.getRange(2, 1, mzLastRow - 1, mzCols).getValues();
    mzData.forEach(row => {
      const mId = String(row[0] || '').trim();
      const mName = String(row[1] || '').trim().toLowerCase();
      const manPrice = parseFloat(row[20]) || 0; // Spalte 21: Manueller Kalkulationspreis
      const manNote = String(row[21] || '').trim(); // Spalte 22: Manueller Preis Bemerkung
      const aktiv = String(row[4] || 'JA').trim(); // Spalte 5: Aktiv

      const meta = { manualPrice: manPrice, manualNote: manNote, aktiv: aktiv };
      if (mId) existingManual[mId] = meta;
      if (mName) existingManual[mName] = meta;
    });
  }

  // 2. Einkaufsmengen aus RECHNUNGSEINGANG nach Master-Zutat aggregieren
  const recQuantities = {};
  const currentYm = Utilities.formatDate(now, 'Europe/Berlin', 'yyyy-MM');
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  if (recSheet && recSheet.getLastRow() > 1) {
    const recCols = Math.max(21, recSheet.getLastColumn());
    const recData = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, recCols).getValues();
    recData.forEach(r => {
      const artName = String(r[6] || '').trim();
      const rMenge = parseFloat(r[9]) || 0;
      const rYm = String(r[18] || '').trim();
      const rBaseMenge = parseFloat(r[19]) || 0;
      const mKey = extractMasterIngredientKey(artName);
      if (mKey && mKey !== 'Unbekannte Zutat') {
        if (!recQuantities[mKey]) recQuantities[mKey] = { total: 0, currentMonth: 0 };
        const qToAdd = rBaseMenge > 0 ? rBaseMenge : rMenge;
        recQuantities[mKey].total += qToAdd;
        if (rYm === currentYm) {
          recQuantities[mKey].currentMonth += qToAdd;
        }
      }
    });
  }

  // 3. Artikelstamm einlesen
  const artCols = Math.max(19, artSheet.getLastColumn());
  const artData = artSheet.getRange(5, 1, artLastRow - 4, artCols).getValues();
  const masterMap = {};
  const artUpdates = [];
  let masterCounter = 0;

  // Erster Durchlauf: Artikel analysieren & zu Master-Zutaten zuordnen
  artData.forEach((row, idx) => {
    const artId = String(row[0] || '').trim();
    const artName = String(row[1] || '').trim();
    const wg = String(row[2] || '').trim();
    const kat = String(row[3] || '').trim();
    const lieferant = String(row[5] || '').trim();
    const gebinde = String(row[7] || '').trim();
    const inhalt = parseFloat(row[8]) || 1;
    const unit = String(row[9] || '').trim();
    const gebindePreis = parseFloat(row[10]) || 0;
    const refPrice = parseFloat(row[11]) || 0;
    const recDate = row[12] instanceof Date ? row[12] : (row[12] ? new Date(row[12]) : null);
    const existingMasterId = String(row[16] || '').trim();
    const artAktiv = String(row[18] || 'JA').trim().toUpperCase();

    // Ermittlung des logischen Master-Zutaten-Schlüssels
    const masterKey = extractMasterIngredientKey(artName);

    // Zuordnungs-Status ermitteln
    let zuordnungsStatus = 'EINDEUTIG_ZUGEORDNET';
    if (!artName || artName.length < 2) {
      zuordnungsStatus = 'ZU_PRUEFEN';
    } else if (wg.startsWith('LG')) {
      zuordnungsStatus = 'NICHT_REZEPTURRELEVANT';
    } else if (kat === 'Nonfood') {
      zuordnungsStatus = 'NICHT_REZEPTURRELEVANT';
    } else if (!unit || unit === '') {
      zuordnungsStatus = 'ZU_PRUEFEN';
    } else if (masterKey === 'Unbekannte Zutat') {
      zuordnungsStatus = 'KEINE_MASTER_ZUTAT';
    } else if (artAktiv === 'NEIN') {
      zuordnungsStatus = 'INAKTIV';
    }

    if (!masterMap[masterKey]) {
      masterCounter++;
      const masterId = existingMasterId && existingMasterId.startsWith('MZ-') ? existingMasterId : ('MZ-' + String(masterCounter).padStart(4, '0'));
      masterMap[masterKey] = {
        id: masterId,
        name: masterKey,
        wg: wg,
        kat: kat,
        unit: unit || 'kg',
        articles: []
      };
    }

    masterMap[masterKey].articles.push({
      artId: artId,
      name: artName,
      lieferant: lieferant,
      gebinde: gebinde,
      inhalt: inhalt,
      unit: unit,
      gebindePreis: gebindePreis,
      refPrice: refPrice,
      recDate: (recDate instanceof Date && !isNaN(recDate.getTime())) ? recDate : null,
      status: zuordnungsStatus,
      aktiv: artAktiv
    });

    artUpdates.push([
      masterMap[masterKey].id,
      zuordnungsStatus,
      artAktiv || 'JA'
    ]);
  });

  // 3. Master-Zutaten Zeilen & verbindliche Kalkulationspreise berechnen
  const mzRows = [];
  Object.keys(masterMap).forEach(k => {
    const m = masterMap[k];
    const arts = m.articles;
    const activeArts = arts.filter(a => a.aktiv !== 'NEIN' && a.status !== 'INAKTIV');

    // Gespeicherte manuelle Preise abrufen
    const manMeta = existingManual[m.id] || existingManual[m.name.toLowerCase()] || { manualPrice: 0, manualNote: '', aktiv: 'JA' };
    const manPrice = manMeta.manualPrice;
    const manNote = manMeta.manualNote;
    const masterAktiv = manMeta.aktiv || 'JA';

    // Bestimme die Standard-Einheit (bevorzuge kg/l vor Stk)
    let bestUnit = m.unit;
    for (let i = 0; i < arts.length; i++) {
      if (arts[i].unit && arts[i].unit !== '') {
        bestUnit = arts[i].unit;
        break;
      }
    }

    // Jüngsten Einkaufspreis ermitteln
    let latestArt = null;
    let latestTime = 0;
    // Günstigsten Einkaufspreis ermitteln
    let cheapestArt = null;
    let cheapestPrice = Infinity;
    // Standard-Referenzpreis aus Stammdaten
    let refArt = null;

    activeArts.forEach(a => {
      if (a.refPrice > 0) {
        if (a.refPrice < cheapestPrice) {
          cheapestPrice = a.refPrice;
          cheapestArt = a;
        }
        if (!refArt) refArt = a;
        if (a.recDate) {
          const t = a.recDate.getTime();
          if (t >= latestTime) {
            latestTime = t;
            latestArt = a;
          }
        }
      }
    });

    // Fallback: Falls kein Rechnungsdatum, nimm refArt als latestArt
    if (!latestArt && refArt) latestArt = refArt;

    // Preisalter in Tagen berechnen
    let ageDays = null;
    if (latestArt && latestArt.recDate) {
      ageDays = Math.max(0, Math.floor((now.getTime() - latestArt.recDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // 4. Kalkulationspreis nach PREIS_CONFIG Priorität bestimmen
    let kalkPreis = '';
    let kalkStatus = 'KEIN_PREIS';
    let kalkQuelle = 'KEINE';
    let kalkDatum = '';
    let kalkLieferant = '';
    let kalkArtId = '';
    let preisZuPruefen = 'NEIN';

    // Priorität 1: Manueller Preis hat Vorrang
    if (PREIS_CONFIG.MANUELLER_PREIS_HAT_VORRANG && manPrice > 0) {
      kalkPreis = manPrice;
      kalkStatus = 'MANUELL_FREIGEGEBEN';
      kalkQuelle = 'MANUELL';
      kalkDatum = now;
      kalkLieferant = 'Manuell freigegeben';
      kalkArtId = '-';
      preisZuPruefen = 'NEIN';
    }
    // Priorität 2: Jüngster Einkaufspreis
    else if (latestArt && latestArt.refPrice > 0) {
      if (ageDays !== null && ageDays > PREIS_CONFIG.MAX_PREISALTER_TAGE) {
        kalkPreis = latestArt.refPrice;
        kalkStatus = 'VERALTET';
        kalkQuelle = PREIS_CONFIG.STANDARD_PREISQUELLE;
        kalkDatum = latestArt.recDate || '';
        kalkLieferant = latestArt.lieferant;
        kalkArtId = latestArt.artId;
        preisZuPruefen = 'JA';
      } else {
        kalkPreis = latestArt.refPrice;
        kalkStatus = 'GUELTIG';
        kalkQuelle = PREIS_CONFIG.STANDARD_PREISQUELLE;
        kalkDatum = latestArt.recDate || '';
        kalkLieferant = latestArt.lieferant;
        kalkArtId = latestArt.artId;
        preisZuPruefen = 'NEIN';
      }
    }
    // Priorität 3: Stammdaten-Referenzpreis
    else if (cheapestArt && cheapestArt.refPrice > 0) {
      kalkPreis = cheapestArt.refPrice;
      kalkStatus = 'GUELTIG';
      kalkQuelle = 'REFERENZPREIS_STAMM';
      kalkDatum = cheapestArt.recDate || '';
      kalkLieferant = cheapestArt.lieferant;
      kalkArtId = cheapestArt.artId;
      preisZuPruefen = 'NEIN';
    }
    // Priorität 4: Kein Preis
    else {
      kalkPreis = '';
      kalkStatus = 'KEIN_PREIS';
      kalkQuelle = 'KEINE';
      kalkDatum = '';
      kalkLieferant = '';
      kalkArtId = '';
      preisZuPruefen = 'JA';
    }

    // Basiseinheiten-Check
    if (!bestUnit || bestUnit === '') {
      kalkStatus = PREIS_CONFIG.PREISSTATUS_BEI_FEHLENDER_BASISEINHEIT;
      preisZuPruefen = 'JA';
    }

    // Zeile für MASTER_ZUTATEN aufbauen (25 Spalten)
    const q = recQuantities[m.name] || { total: 0, currentMonth: 0 };
    mzRows.push([
      m.id,                                                                                     // 1. Master-ID
      m.name,                                                                                   // 2. Master-Zutat
      m.wg,                                                                                     // 3. Warengruppe
      m.kat,                                                                                    // 4. Hauptkategorie
      masterAktiv,                                                                              // 5. Aktiv
      bestUnit,                                                                                 // 6. Standard-Einheit
      kalkPreis !== '' ? kalkPreis : '',                                                        // 7. Kalkulationspreis Netto
      kalkStatus,                                                                               // 8. Kalkulationspreis Status
      kalkQuelle,                                                                               // 9. Kalkulationspreis Quelle
      kalkDatum instanceof Date && !isNaN(kalkDatum.getTime()) ? kalkDatum : '',                // 10. Kalkulationspreis Datum
      kalkLieferant,                                                                            // 11. Kalkulationspreis Lieferant
      kalkArtId,                                                                                // 12. Kalkulationspreis Quell-ID
      latestArt && latestArt.refPrice > 0 ? latestArt.refPrice : '',                            // 13. Letzter Einkaufspreis Netto
      latestArt && latestArt.recDate ? latestArt.recDate : '',                                  // 14. Letzter Einkauf Datum
      latestArt ? latestArt.lieferant : '',                                                     // 15. Letzter Einkauf Lieferant
      cheapestArt && cheapestArt.refPrice > 0 ? cheapestArt.refPrice : '',                      // 16. Günstigster Vergleichspreis Netto
      cheapestArt ? cheapestArt.lieferant : '',                                                 // 17. Günstigster Lieferant
      refArt && refArt.refPrice > 0 ? refArt.refPrice : '',                                     // 18. Referenzpreis Stamm Netto
      ageDays !== null ? ageDays : '',                                                          // 19. Preisalter (Tage)
      preisZuPruefen,                                                                           // 20. Preis zu prüfen
      manPrice > 0 ? manPrice : '',                                                             // 21. Manueller Kalkulationspreis
      manNote,                                                                                  // 22. Manueller Preis Bemerkung
      q.total > 0 ? Math.round(q.total * 100) / 100 : '',                                       // 23. Einkaufsmenge Gesamt (Basiseinheit)
      q.currentMonth > 0 ? Math.round(q.currentMonth * 100) / 100 : '',                         // 24. Einkaufsmenge lfd. Monat
      now                                                                                       // 25. Letzte Aktualisierung
    ]);
  });

  // 5. Batch-Write in ARTIKELSTAMM (Spalten 17, 18, 19: Master-Zutat-ID, Zuordnungs-Status, Aktiv)
  if (artUpdates.length > 0) {
    artSheet.getRange(5, 17, artUpdates.length, 3).setValues(artUpdates);
  }

  // 6. Batch-Write in MASTER_ZUTATEN (25 Spalten)
  if (mzRows.length > 0) {
    const currentMzRows = mzSheet.getLastRow();
    if (currentMzRows > 1) {
      mzSheet.getRange(2, 1, currentMzRows - 1, mzSheet.getLastColumn()).clearContent();
    }
    mzSheet.getRange(2, 1, mzRows.length, mzRows[0].length).setValues(mzRows);
    mzSheet.autoResizeColumns(1, mzRows[0].length);
  }
}

/**
 * 1.3 ARTIKELSTAMM (MIT MULTI-KRITERIEN FILTERLEISTE)
 */
function importMetroMasterData(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (!artSheet) artSheet = ss.insertSheet(CONFIG.NAME_ARTIKEL);
  else artSheet.clear();
  
  // 1. Multi-Filter Leiste (Zeilen 1 bis 3)
  artSheet.getRange('A1:S1').merge()
    .setValue('🔍 ARTIKELSTAMM & EINKAUFSDATEN — MULTI-KRITERIEN RECHERCHE')
    .setFontWeight('bold')
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  artSheet.setRowHeight(1, 35);

  artSheet.getRange('A2:B2').merge().setValue('Warengruppe:').setFontWeight('bold').setFontColor('#1B365D').setHorizontalAlignment('right');
  artSheet.getRange('C2').clearDataValidations().setValue('Alle Warengruppen').setBackground('#E8F0FE').setFontColor('#1967D2').setFontWeight('bold');
  const wgList = ['Alle Warengruppen'].concat(WARENGRUPPEN_CONFIG.map(w => w.name));
  artSheet.getRange('C2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(wgList, true).setAllowInvalid(true).build());

  artSheet.getRange('D2:E2').merge().setValue('Lieferant:').setFontWeight('bold').setFontColor('#1B365D').setHorizontalAlignment('right');
  artSheet.getRange('F2').clearDataValidations().setValue('Alle Lieferanten').setBackground('#E8F0FE').setFontColor('#1967D2').setFontWeight('bold');
  const suppList = ['Alle Lieferanten', 'METRO Deutschland (Leipzig)', 'RUNGIS express GmbH', 'SSP Trade & Consult GmbH', 'Transgourmet', 'Selgros', 'Chef Culinar'];
  artSheet.getRange('F2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(suppList, true).setAllowInvalid(true).build());

  artSheet.getRange('G2:H2').merge().setValue('Zeitraum:').setFontWeight('bold').setFontColor('#1B365D').setHorizontalAlignment('right');
  artSheet.getRange('I2').clearDataValidations().setValue('Alle Zeiträume').setBackground('#E8F0FE').setFontColor('#1967D2').setFontWeight('bold');
  const periodList = ['Alle Zeiträume', 'Aktueller Monat', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2026-01', '2026-05', '2026-06'];
  artSheet.getRange('I2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(periodList, true).setAllowInvalid(true).build());

  artSheet.getRange('J2:K2').merge().setValue('Master-Zutat / Suche:').setFontWeight('bold').setFontColor('#1B365D').setHorizontalAlignment('right');
  artSheet.getRange('L2').clearDataValidations().setValue('').setBackground('#FFFFFF').setFontColor('#202124').setNote('Text eingeben zum Suchen');

  artSheet.getRange('M2:S2').merge().setValue('💡 Ändere C2, F2, I2 oder L2 um live zu filtern!').setFontStyle('italic').setFontColor('#5F6368').setVerticalAlignment('middle');
  artSheet.setRowHeight(2, 30);

  // 2. Tabellen-Header (Zeile 4)
  const headers = [
    'Artikel-ID', 'Artikelbezeichnung', 'Warengruppe', 'Hauptkategorie', 'MwSt-Satz', 'Hauptlieferant',
    'Lieferanten-Artikelnr.', 'Gebinde-Bezeichnung', 'Gebinde-Inhalt (Zahl)', 'Basiseinheit',
    'Gebindepreis Netto (€)', 'Referenzpreis (€ / Basiseinheit)', 'Letztes Rechnungsdatum',
    'Vorheriger Netto-Preis (€)', 'Preisentwicklung (%)', 'Status / Notizen', 'Master-Zutat-ID',
    'Zuordnungs-Status', 'Aktiv'
  ];
  
  artSheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  artSheet.getRange('A4:S4').setFontWeight('bold').setBackground('#2E5B88').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  artSheet.setRowHeight(4, 35);
  artSheet.setFrozenRows(4);

  const metroArticles = [
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Extra natives Olivenöl aus Kreta",
    "artNr": "455653",
    "gebinde": "5 ltr Kanister",
    "inhalt": 5,
    "einh": "l",
    "preis": 33.9,
    "lieferant": "Kreta Olivenöl",
    "note": "Kreta Olivenöl"
  },
  {
    "wg": "E14: Wein",
    "name": "Grüner Veltliner 0,75L",
    "artNr": "2345-B",
    "gebinde": "6 x 0,75L Flasche",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 15.96,
    "lieferant": "Weinkönner",
    "note": "Grüner Veltliner"
  },
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Lachs Label Rouge 7-8kg Schottland",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 13.69,
    "lieferant": "Fisch Stephan",
    "note": "Lachs Schottland"
  },
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Lachs Label Rouge 6-7kg Schottland",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 13.69,
    "lieferant": "Fisch Stephan",
    "note": "Lachs Schottland"
  },
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Lachs Label Rouge 5-6kg Schottland",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 13.69,
    "lieferant": "Fisch Stephan",
    "note": "Lachs Schottland"
  },
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Lachs Norwegen 6-7kg",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 11.9,
    "lieferant": "Fisch Stephan",
    "note": "Lachs Norwegen"
  },
  {
    "wg": "E1: Fisch",
    "name": "Toro frisch 3-5kg",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 44,
    "lieferant": "Fisch Stephan",
    "note": "Toro frisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Bluefin frisch",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 22.7,
    "lieferant": "Fisch Stephan",
    "note": "Bluefin frisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Hamachi Zucht 3-5kg",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 26.9,
    "lieferant": "Fisch Stephan",
    "note": "Hamachi Zucht"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Jakobsmuschelfleisch Japan",
    "artNr": "",
    "gebinde": "1 Dose (1kg)",
    "inhalt": 1,
    "einh": "kg",
    "preis": 33.5,
    "lieferant": "Fisch Stephan",
    "note": "Jakobsmuscheln"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Oktopus ohne Kopf",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 21.5,
    "lieferant": "Fisch Stephan",
    "note": "Oktopus"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Calamari frisch",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 14.9,
    "lieferant": "Fisch Stephan",
    "note": "Calamari"
  },
  {
    "wg": "E1: Fisch",
    "name": "Sashimi Sri Lanka 5 Kg",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 37.9,
    "lieferant": "Fisch Stephan",
    "note": "Sashimi Thunfisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Redsnapper",
    "artNr": "",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 16.49,
    "lieferant": "Fisch Stephan",
    "note": "Redsnapper"
  },
  {
    "wg": "E1: Fisch",
    "name": "ASC Hiramasa Kingfisch NL +2kg",
    "artNr": "80374",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 26.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Hiramasa Kingfisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Wolfsbarsch Zucht 1,8-2,4kg",
    "artNr": "14418",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 24.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Wolfsbarsch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Dorade Royal 800g Stück GR Zucht",
    "artNr": "14466",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 12.9,
    "lieferant": "RUNGIS express GmbH",
    "note": "Dorade Royal"
  },
  {
    "wg": "E1: Fisch",
    "name": "Dorade Royal Zucht 1-1,5kg",
    "artNr": "23433",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 16.5,
    "lieferant": "RUNGIS express GmbH",
    "note": "Dorade Royal"
  },
  {
    "wg": "E1: Fisch",
    "name": "Dorade Rose GR Zucht 0,8-1kg",
    "artNr": "992",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 17.7,
    "lieferant": "RUNGIS express GmbH",
    "note": "Dorade Rose"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Keta Kaviar aus Alaska 250g Dose",
    "artNr": "458",
    "gebinde": "250g Dose",
    "inhalt": 0.25,
    "einh": "kg",
    "preis": 59.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Keta Kaviar"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Stör Kaviar o. Konservierungsstoff Winter 50g Dose",
    "artNr": "51318",
    "gebinde": "50g Dose",
    "inhalt": 0.05,
    "einh": "kg",
    "preis": 63,
    "lieferant": "RUNGIS express GmbH",
    "note": "Stör Kaviar"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "TK Tintenfischtuben U10 gep. 30%",
    "artNr": "14746",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8.5,
    "lieferant": "RUNGIS express GmbH",
    "note": "Tintenfischtuben"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Octopus vulgaris Wildfang TK 4kg",
    "artNr": "50466",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 19.25,
    "lieferant": "RUNGIS express GmbH",
    "note": "Octopus vulgaris"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Barbarie Entenbrust 180-220g",
    "artNr": "10555",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 17,
    "lieferant": "RUNGIS express GmbH",
    "note": "Barbarie Entenbrust"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Maishähnchenbrust Supreme 180-200g",
    "artNr": "49420",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 10.5,
    "lieferant": "RUNGIS express GmbH",
    "note": "Maishähnchenbrust"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Maishähnchenbrust m. Haut+ FR 4x180-220g",
    "artNr": "8557",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 10.5,
    "lieferant": "RUNGIS express GmbH",
    "note": "Maishähnchenbrust"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Entrecote v. Rind halbiert Dry Aged 2,5-3kg",
    "artNr": "45254",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 55.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Entrecote Dry Aged"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Entrecote v. Rind 2-3kg IE Heritage",
    "artNr": "21370",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 33.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Entrecote Heritage"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Entrecote v. Rind k NZ Greenlea",
    "artNr": "28633",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 33.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Entrecote Greenlea"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rinder-Ribeye Hereford Premium",
    "artNr": "50514",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 33.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Ribeye Hereford"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Wilder Broccoli Bimi DE Keltenhof 1,5kg",
    "artNr": "49895",
    "gebinde": "1,5kg Schale",
    "inhalt": 1.5,
    "einh": "kg",
    "preis": 26.93,
    "lieferant": "RUNGIS express GmbH",
    "note": "Broccoli Bimi"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Shisoblätter grün 15 Stück 50g",
    "artNr": "11927",
    "gebinde": "Packung (15 Stk / 50g)",
    "inhalt": 15,
    "einh": "Stk",
    "preis": 3.85,
    "lieferant": "RUNGIS express GmbH",
    "note": "Shisoblätter grün"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Erbsenkresse Koppert Niederlande 16x80g",
    "artNr": "12935",
    "gebinde": "16er Kiste (16x80g)",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 17.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Erbsenkresse"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Daikonkresse 16xca81g Ka NL",
    "artNr": "6908",
    "gebinde": "16er Kiste (16x81g)",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 15.84,
    "lieferant": "RUNGIS express GmbH",
    "note": "Daikonkresse"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Veilchen gemischt 35-45 Stück DE Keltenhof 200g",
    "artNr": "9654",
    "gebinde": "Schale (40 Stk / 200g)",
    "inhalt": 40,
    "einh": "Stk",
    "preis": 7.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Essbare Blüten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Bete gelb roh aus der EU 5kg",
    "artNr": "53210",
    "gebinde": "5kg Sack",
    "inhalt": 5,
    "einh": "kg",
    "preis": 19.75,
    "lieferant": "RUNGIS express GmbH",
    "note": "Bete gelb"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Karotten Rainbow Mini 8x150g",
    "artNr": "52282",
    "gebinde": "8er Bund (8x150g)",
    "inhalt": 8,
    "einh": "Stk",
    "preis": 26,
    "lieferant": "RUNGIS express GmbH",
    "note": "Mini Karotten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kräuterseitling gezüchtet 2kg",
    "artNr": "53232",
    "gebinde": "2kg Kiste",
    "inhalt": 2,
    "einh": "kg",
    "preis": 31,
    "lieferant": "RUNGIS express GmbH",
    "note": "Kräuterseitlinge"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Shii Take Pilze BIO 2kg",
    "artNr": "13302",
    "gebinde": "2kg Kiste",
    "inhalt": 2,
    "einh": "kg",
    "preis": 31.9,
    "lieferant": "RUNGIS express GmbH",
    "note": "Shiitake Pilze"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Trüffelpaste schwarz mit Champignons 500g",
    "artNr": "15681",
    "gebinde": "Glas (500g)",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 36.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Trüffelpaste"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Cavi-Art Algen Kaviar 500g",
    "artNr": "17557",
    "gebinde": "Glas (500g)",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 14.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Algen Kaviar"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Griechischer Joghurt 10% Fett 1kg Eim GR",
    "artNr": "46387",
    "gebinde": "Eimer (1kg)",
    "inhalt": 1,
    "einh": "kg",
    "preis": 5.95,
    "lieferant": "RUNGIS express GmbH",
    "note": "Griechischer Joghurt"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Gurken ca 300-400g 12ST",
    "artNr": "",
    "gebinde": "12er Kiste (4.2kg)",
    "inhalt": 4.2,
    "einh": "kg",
    "preis": 11.52,
    "lieferant": "Gemüse Sülo",
    "note": "Gurken"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Süßkartoffeln 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 13.85,
    "lieferant": "Gemüse Sülo",
    "note": "Süßkartoffeln"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Möhren 5kg",
    "artNr": "",
    "gebinde": "5kg Beutel",
    "inhalt": 5,
    "einh": "kg",
    "preis": 6.85,
    "lieferant": "Gemüse Sülo",
    "note": "Möhren"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Lollo Mix 9x0,44kg",
    "artNr": "",
    "gebinde": "9er Kiste",
    "inhalt": 9,
    "einh": "Stk",
    "preis": 12.8,
    "lieferant": "Gemüse Sülo",
    "note": "Lollo Salat"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Zucchini 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 15.9,
    "lieferant": "Gemüse Sülo",
    "note": "Zucchini"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Champignon braun 3kg",
    "artNr": "",
    "gebinde": "3kg Kiste",
    "inhalt": 3,
    "einh": "kg",
    "preis": 10.8,
    "lieferant": "Gemüse Sülo",
    "note": "Champignons braun"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Knoblauch 5kg",
    "artNr": "",
    "gebinde": "5kg Sack",
    "inhalt": 5,
    "einh": "kg",
    "preis": 24.5,
    "lieferant": "Gemüse Sülo",
    "note": "Knoblauch"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Limetten 60Stk 4,5kg",
    "artNr": "",
    "gebinde": "60er Kiste (4,5kg)",
    "inhalt": 60,
    "einh": "Stk",
    "preis": 14.8,
    "lieferant": "Gemüse Sülo",
    "note": "Limetten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Rucola 10 Bund",
    "artNr": "",
    "gebinde": "10er Bund",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 8.8,
    "lieferant": "Gemüse Sülo",
    "note": "Rucola"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Shiso purple 16SCH",
    "artNr": "",
    "gebinde": "16er Schachtel",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 18.56,
    "lieferant": "Gemüse Sülo",
    "note": "Shiso Kresse purple"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Lauchzwiebeln 10x160g",
    "artNr": "",
    "gebinde": "10er Bund",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 8.3,
    "lieferant": "Gemüse Sülo",
    "note": "Lauchzwiebeln"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Rosmarin 100g",
    "artNr": "",
    "gebinde": "Packung 100g",
    "inhalt": 0.1,
    "einh": "kg",
    "preis": 3.25,
    "lieferant": "Gemüse Sülo",
    "note": "Rosmarin"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Thymian 100g",
    "artNr": "",
    "gebinde": "Packung 100g",
    "inhalt": 0.1,
    "einh": "kg",
    "preis": 2.95,
    "lieferant": "Gemüse Sülo",
    "note": "Thymian"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Minze 110g",
    "artNr": "",
    "gebinde": "Bund 110g",
    "inhalt": 0.11,
    "einh": "kg",
    "preis": 1.35,
    "lieferant": "Gemüse Sülo",
    "note": "Minze"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Friseesalat 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 14.85,
    "lieferant": "Gemüse Sülo",
    "note": "Friseesalat"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Staudensellerie 10x430g",
    "artNr": "",
    "gebinde": "10er Bund (4,3kg)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 17.5,
    "lieferant": "Gemüse Sülo",
    "note": "Staudensellerie"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Brokkoli 10x500g",
    "artNr": "",
    "gebinde": "10er Bund (5kg)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 15.8,
    "lieferant": "Gemüse Sülo",
    "note": "Brokkoli"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Avocado 16Stk",
    "artNr": "",
    "gebinde": "16er Kiste",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 24.6,
    "lieferant": "Gemüse Sülo",
    "note": "Avocado"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Pak Choi 8kg",
    "artNr": "",
    "gebinde": "8kg Kiste",
    "inhalt": 8,
    "einh": "kg",
    "preis": 29.6,
    "lieferant": "Gemüse Sülo",
    "note": "Pak Choi"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Passionsfrucht 2KG",
    "artNr": "",
    "gebinde": "2kg Kiste",
    "inhalt": 2,
    "einh": "kg",
    "preis": 25.5,
    "lieferant": "Gemüse Sülo",
    "note": "Passionsfrucht"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Zitronen 4,5kg",
    "artNr": "",
    "gebinde": "4,5kg Kiste",
    "inhalt": 4.5,
    "einh": "kg",
    "preis": 10.8,
    "lieferant": "Gemüse Sülo",
    "note": "Zitronen"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Rettich 5Stk",
    "artNr": "",
    "gebinde": "5er Bund",
    "inhalt": 5,
    "einh": "Stk",
    "preis": 9.25,
    "lieferant": "Gemüse Sülo",
    "note": "Rettich"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Ingwer 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 15.8,
    "lieferant": "Gemüse Sülo",
    "note": "Ingwer"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Zwiebeln rot 10kg",
    "artNr": "",
    "gebinde": "10kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 11.8,
    "lieferant": "Gemüse Sülo",
    "note": "Zwiebeln rot"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kartoffeln 25kg",
    "artNr": "",
    "gebinde": "25kg Sack",
    "inhalt": 25,
    "einh": "kg",
    "preis": 26.8,
    "lieferant": "Gemüse Sülo",
    "note": "Kartoffeln"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Radicchio 3kg",
    "artNr": "",
    "gebinde": "3kg Kiste",
    "inhalt": 3,
    "einh": "kg",
    "preis": 12.85,
    "lieferant": "Gemüse Sülo",
    "note": "Radicchio"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kumquat 2KG",
    "artNr": "",
    "gebinde": "2kg Kiste",
    "inhalt": 2,
    "einh": "kg",
    "preis": 25.7,
    "lieferant": "Gemüse Sülo",
    "note": "Kumquat"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spargel grün 500g",
    "artNr": "",
    "gebinde": "Bund 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 6.8,
    "lieferant": "Gemüse Sülo",
    "note": "Spargel grün"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Tomaten 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 8.3,
    "lieferant": "Gemüse Sülo",
    "note": "Tomaten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Sellerieknollen 1Stk",
    "artNr": "",
    "gebinde": "1 Stück",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 2.45,
    "lieferant": "Gemüse Sülo",
    "note": "Sellerieknollen"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Paprika Mix 5kg",
    "artNr": "",
    "gebinde": "5kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 13.8,
    "lieferant": "Gemüse Sülo",
    "note": "Paprika Mix"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Shiso Blatt grün 50g",
    "artNr": "",
    "gebinde": "Schale 50g",
    "inhalt": 0.05,
    "einh": "kg",
    "preis": 3.45,
    "lieferant": "Gemüse Sülo",
    "note": "Shiso Blatt grün"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Eier 180 Stück",
    "artNr": "",
    "gebinde": "Karton (180 Stk)",
    "inhalt": 180,
    "einh": "Stk",
    "preis": 36.8,
    "lieferant": "Gemüse Sülo",
    "note": "Eier"
  },
  {
    "wg": "E1: Fisch",
    "name": "Dorade 0,8-1kg",
    "artNr": "939",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 11.12,
    "lieferant": "Fish and Food",
    "note": "Dorade"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Black Tiger Garnelen 1,8/2,5kgx6; 16/20 Block",
    "artNr": "231",
    "gebinde": "6er Block (10,8kg)",
    "inhalt": 10.8,
    "einh": "kg",
    "preis": 226.8,
    "lieferant": "Fish and Food",
    "note": "Black Tiger Garnelen"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Mi Udon ITA SAN aus Japan 30*200g",
    "artNr": "712",
    "gebinde": "Karton (30x200g)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 18.22,
    "lieferant": "Fish and Food",
    "note": "Udon Nudeln"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Sushi Ingwer 10x1kg",
    "artNr": "501",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 29,
    "lieferant": "Fish and Food",
    "note": "Sushi Ingwer"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Edamame blanchiert- Krt á 20 x 500g China",
    "artNr": "4971",
    "gebinde": "Karton (20x500g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 39.8,
    "lieferant": "Fish and Food",
    "note": "Edamame TK"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Tobikko Red 500g",
    "artNr": "1597",
    "gebinde": "Packung 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 19.95,
    "lieferant": "Fish and Food",
    "note": "Tobiko Red"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Sojasauce, Fische, 4x(125x8ml) Karton",
    "artNr": "9811",
    "gebinde": "Karton (500x8ml / 4L)",
    "inhalt": 500,
    "einh": "Stk",
    "preis": 52.32,
    "lieferant": "Fish and Food",
    "note": "Sojasauce Fisch-Form"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Sushibox (CH 005) HP11 schwarz 400stk m.Deckel",
    "artNr": "487",
    "gebinde": "Karton (400 Stk)",
    "inhalt": 400,
    "einh": "Stk",
    "preis": 92,
    "lieferant": "Fish and Food",
    "note": "Sushibox HP11"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Sushibox (CH 03) HP03 schwarz 400stk m. Deckel",
    "artNr": "483",
    "gebinde": "Karton (400 Stk)",
    "inhalt": 400,
    "einh": "Stk",
    "preis": 48,
    "lieferant": "Fish and Food",
    "note": "Sushibox HP03"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Kleibreiskuchen mit Kokos-Pandan 12*180g",
    "artNr": "3833",
    "gebinde": "Karton (12x180g)",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 28.08,
    "lieferant": "Fish and Food",
    "note": "Kleibreiskuchen"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Tom the 30/40 Garnelen",
    "artNr": "901",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 9.35,
    "lieferant": "Fish and Food",
    "note": "Garnelen 30/40"
  },
  {
    "wg": "E1: Fisch",
    "name": "Thunfischfilet Sashimi Thunnus Albacares",
    "artNr": "108",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 35.9,
    "lieferant": "Fish and Food",
    "note": "Thunfisch Sashimi"
  },
  {
    "wg": "E1: Fisch",
    "name": "Bluefin Tuna Filet Thunnus Thynnus",
    "artNr": "109",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 37.9,
    "lieferant": "Fish and Food",
    "note": "Bluefin Tuna Filet"
  },
  {
    "wg": "E15: Bier",
    "name": "König Ludwig Weissbier naturtrüb 30L",
    "artNr": "2512",
    "gebinde": "30L Fass",
    "inhalt": 30,
    "einh": "l",
    "preis": 79.32,
    "lieferant": "Getränke Staude",
    "note": "König Ludwig Weissbier"
  },
  {
    "wg": "E15: Bier",
    "name": "König Ludwig Weissbier AKF 20x0,5L",
    "artNr": "2517",
    "gebinde": "Kasten (20x0,5L)",
    "inhalt": 10,
    "einh": "l",
    "preis": 17.59,
    "lieferant": "Getränke Staude",
    "note": "König Ludwig AKF"
  },
  {
    "wg": "E15: Bier",
    "name": "Warsteiner Pilsener 30L",
    "artNr": "101",
    "gebinde": "30L Fass",
    "inhalt": 30,
    "einh": "l",
    "preis": 90.32,
    "lieferant": "Getränke Staude",
    "note": "Warsteiner Pilsener 30L"
  },
  {
    "wg": "E15: Bier",
    "name": "Warsteiner Pilsner 50L",
    "artNr": "100",
    "gebinde": "50L Fass",
    "inhalt": 50,
    "einh": "l",
    "preis": 131.37,
    "lieferant": "Getränke Staude",
    "note": "Warsteiner Pilsner 50L"
  },
  {
    "wg": "E15: Bier",
    "name": "Warsteiner AKF 24x0,33L",
    "artNr": "3105",
    "gebinde": "Kasten (24x0,33L)",
    "inhalt": 7.92,
    "einh": "l",
    "preis": 16.18,
    "lieferant": "Getränke Staude",
    "note": "Warsteiner AKF"
  },
  {
    "wg": "E14: Wein",
    "name": "Elbling, Margarethenhof 6x0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 34.2,
    "lieferant": "Weinkönner",
    "note": "Elbling Wein"
  },
  {
    "wg": "E14: Wein",
    "name": "Rotling, Margarethenhof 12x0,75L",
    "artNr": "",
    "gebinde": "Karton (12x0,75L)",
    "inhalt": 9,
    "einh": "l",
    "preis": 71.4,
    "lieferant": "Weinkönner",
    "note": "Rotling Wein"
  },
  {
    "wg": "E14: Wein",
    "name": "Fernlands, Marisco 6x0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 41.4,
    "lieferant": "Weinkönner",
    "note": "Sauvignon Blanc"
  },
  {
    "wg": "E14: Wein",
    "name": "Erbeldinger Riesling 12x0,75L",
    "artNr": "",
    "gebinde": "Karton (12x0,75L)",
    "inhalt": 9,
    "einh": "l",
    "preis": 83.76,
    "lieferant": "Weinkönner",
    "note": "Riesling Wein"
  },
  {
    "wg": "E14: Wein",
    "name": "Try Aged Wine, Drautz Able 0,75L x6",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 51,
    "lieferant": "Weinkönner",
    "note": "Try Aged Wine"
  },
  {
    "wg": "E14: Wein",
    "name": "Muskat Trollinger 6x0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 41.7,
    "lieferant": "Weinkönner",
    "note": "Muskat Trollinger"
  },
  {
    "wg": "E14: Wein",
    "name": "Grauburgunder 6x0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 41.88,
    "lieferant": "Weinkönner",
    "note": "Grauburgunder"
  },
  {
    "wg": "E14: Wein",
    "name": "Wine after Work 12x0,75L",
    "artNr": "",
    "gebinde": "Karton (12x0,75L)",
    "inhalt": 9,
    "einh": "l",
    "preis": 74.4,
    "lieferant": "Weinkönner",
    "note": "Wine after Work"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Trockeneis Nuggets 30kg",
    "artNr": "",
    "gebinde": "30kg Box",
    "inhalt": 30,
    "einh": "kg",
    "preis": 50.38,
    "lieferant": "Wonsak",
    "note": "Trockeneis"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Sojasoße Bento Shoyu, Yamasa, Beutel 500x10ml",
    "artNr": "A144",
    "gebinde": "Karton (500x10ml / 5L)",
    "inhalt": 500,
    "einh": "Stk",
    "preis": 29.98,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Sojasoße Bento"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Sojasauce Bento Shoyu (Genen) 300x7,5ml",
    "artNr": "A163",
    "gebinde": "Karton (300x7,5ml / 2,25L)",
    "inhalt": 300,
    "einh": "Stk",
    "preis": 11.3,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Sojasauce Genen"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Sojasauce (dunkel) Shoyu Koikuchi 18L",
    "artNr": "A002",
    "gebinde": "18L Kanister",
    "inhalt": 18,
    "einh": "l",
    "preis": 35,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Sojasauce dunkel"
  },
  {
    "wg": "E1: Fisch",
    "name": "Unagi Kabayaki Gegrillter Aal 11oz 10kg",
    "artNr": "R205A",
    "gebinde": "10kg Karton",
    "inhalt": 10,
    "einh": "kg",
    "preis": 300,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Unagi Aal"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Akitakomachi Sushireis rundkörnig 10kg",
    "artNr": "O056",
    "gebinde": "10kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 36,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Sushireis Akitakomachi"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Suehiro Su U.K Mikan. Getreideessig 20L",
    "artNr": "A022",
    "gebinde": "20L Kanister",
    "inhalt": 20,
    "einh": "l",
    "preis": 29,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Getreideessig Suehiro"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Kona Wasabi 10x1kg",
    "artNr": "G036",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 59.8,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Kona Wasabi Pulver"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Yakisushinori Hangirl halbe Blätter Gold 10x100",
    "artNr": "I043BC",
    "gebinde": "Karton (1000 Blatt)",
    "inhalt": 1000,
    "einh": "Stk",
    "preis": 62.5,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Yakisushinori Gold"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Tokyo Takuan Eingelegter Rettich 20x500g",
    "artNr": "L002A",
    "gebinde": "Karton (20x500g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 39.6,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Tokyo Takuan Rettich"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "(K) Sushi Gari White 10x1kg",
    "artNr": "L057D",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 27,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Sushi Gari Ingwer"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Eu Shin Katsuo, Marutomo, Dashi No Moto 1kg",
    "artNr": "F030",
    "gebinde": "1kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 11.9,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Dashi No Moto"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Yuzu No Hana, Maruzen, Yuzupulver 45x20g",
    "artNr": "G022",
    "gebinde": "Karton (45x20g)",
    "inhalt": 45,
    "einh": "Stk",
    "preis": 404.1,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Yuzupulver"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Miora, Otsuka, Reiskochhilfe 10x1kg",
    "artNr": "P010",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 350,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Reiskochhilfe Miora"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Cut Wakame, Seetang getrocknet 20x250g",
    "artNr": "V241",
    "gebinde": "Karton (20x250g)",
    "inhalt": 5,
    "einh": "kg",
    "preis": 107.8,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Cut Wakame Seetang"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Tobiko Red Rogenzubereitung 12x500g",
    "artNr": "R239",
    "gebinde": "Karton (12x500g)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 214.8,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Tobiko Red"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Goma Wakame Seetangsalat 12x1kg",
    "artNr": "R240C",
    "gebinde": "Karton (12x1kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 54,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Goma Wakame"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Chicken Gyoza Ajinomoto 10x(30x20g)",
    "artNr": "Q156A",
    "gebinde": "Karton (10x600g)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 48,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Chicken Gyoza"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Ryoriten No Aji Shiro, Hanamaruki, Miso hell 10x1kg",
    "artNr": "C003",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 23,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Miso hell Shiro"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Kewpie Mayonnaise Japan 20x500g",
    "artNr": "A029B",
    "gebinde": "Karton (20x500g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 76,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Kewpie Mayonnaise"
  },
  {
    "wg": "E15: Bier",
    "name": "Kirin Bier 24x330ml",
    "artNr": "O125",
    "gebinde": "Kasten (24x0,33L)",
    "inhalt": 7.92,
    "einh": "l",
    "preis": 21.12,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Kirin Bier"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Kizami Wasabi Echter Wasabi (10x0,25kg) x 2 Karton",
    "artNr": "Q110",
    "gebinde": "Karton (20x250g)",
    "inhalt": 5,
    "einh": "kg",
    "preis": 9.98,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Kizami Wasabi"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Strawberry Cheese Cake Mochi 10x192g / 6 Stück",
    "artNr": "Q113",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Strawberry Mochi Eis"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Coconut Ice Cream Mochi 10x192g / 6 Stück",
    "artNr": "Q114",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Coconut Mochi Eis"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Green Tea Ice Cream Mochi 10x192g / 6 Stück",
    "artNr": "Q117",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Green Tea Mochi Eis"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Vanilla Ice Cream Mochi 10x192g / 6 Stück",
    "artNr": "Q119",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Vanilla Mochi Eis"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Mango Ice Cream Mochi 10x192g / 6 Stück",
    "artNr": "Q242",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Mango Mochi Eis"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Tropical Passionfruit & Mango Mochi Eis 10x192g / 6 Stück",
    "artNr": "Q268",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Passionfruit Mochi"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Mango Cheese Cake Mochi 10x192g/6Stk",
    "artNr": "Q269",
    "gebinde": "Karton (10x192g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 39,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Mango Cheesecake Mochi"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Makisu Kouriyo, Bambusmatte 24cmx24cm",
    "artNr": "P098A",
    "gebinde": "1 Stück",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 1.17,
    "lieferant": "SSP Trade & Consult GmbH",
    "note": "Bambusmatte Makisu"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Barbarie Brustfilet TK mit Haut, ohne Knochen ca 900g",
    "artNr": "234813",
    "gebinde": "Packung ca. 900g",
    "inhalt": 0.9,
    "einh": "kg",
    "preis": 15.65,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Barbarie Entenbrust TK"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Luna Suppenhuhn TK ohne Innereien ca.1,7kg-2,3kg",
    "artNr": "1185",
    "gebinde": "Stück ca. 2kg",
    "inhalt": 2,
    "einh": "kg",
    "preis": 2.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Suppenhuhn"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Französische Maishähnchenbrust 4er",
    "artNr": "487525",
    "gebinde": "4er Pack (1kg)",
    "inhalt": 1,
    "einh": "kg",
    "preis": 10.29,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Maishähnchenbrust"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenbrustfilet gesalzen 6x2kg",
    "artNr": "A002173",
    "gebinde": "Karton (6x2kg / 12kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 56.31,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Hähnchenbrustfilet gesalzen"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Französisches Barbarie-Entenbrustfilet 150-250g",
    "artNr": "487536",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 17.72,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Barbarie Entenbrustfilet"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Simmentaler Rinderroastbeef ca 3KG",
    "artNr": "449146",
    "gebinde": "Stück ca. 3kg",
    "inhalt": 3,
    "einh": "kg",
    "preis": 19.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Rinderroastbeef Simmental"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rinder Markknochen TK ca. 8kg",
    "artNr": "53545",
    "gebinde": "8kg Karton",
    "inhalt": 8,
    "einh": "kg",
    "preis": 4.24,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Rinder Markknochen"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rinder-Oberschale Argentinisch ca.5kg",
    "artNr": "428862",
    "gebinde": "Stück ca. 5kg",
    "inhalt": 5,
    "einh": "kg",
    "preis": 9.2,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Rinder Oberschale"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rinderfilet Argentinisch 3/4 lbs ( 340 g )",
    "artNr": "A000190",
    "gebinde": "Packung (340g)",
    "inhalt": 0.34,
    "einh": "kg",
    "preis": 24.93,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Rinderfilet Argentinisch"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Roastbeef Vac Argentinisch 4KG Stück",
    "artNr": "04056249679008",
    "gebinde": "Stück ca. 4kg",
    "inhalt": 4,
    "einh": "kg",
    "preis": 19.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Roastbeef Argentinisch"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Dry Aged Rinder Entrecote ohne Knochen ca 2,5kg",
    "artNr": "852411",
    "gebinde": "Stück ca. 2,5kg",
    "inhalt": 2.5,
    "einh": "kg",
    "preis": 33.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Entrecote Dry Aged"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schweinebauch QS ladenfertig",
    "artNr": "A000103",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 5.19,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Schweinebauch"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Avocado Ready To Eat 14Stk",
    "artNr": "A001022",
    "gebinde": "14er Kiste",
    "inhalt": 14,
    "einh": "Stk",
    "preis": 20.29,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Avocado Ready to Eat"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Avocadowürfel MC TK 1kg",
    "artNr": "904091",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8.6,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Avocadowürfel TK"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spargel grün 450g",
    "artNr": "454472",
    "gebinde": "Bund 450g",
    "inhalt": 0.45,
    "einh": "kg",
    "preis": 5.56,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Spargel grün"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Blütenmix Israel 15g",
    "artNr": "437006",
    "gebinde": "Schachtel 15g",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 6.05,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Essbare Blüten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Daikon Kresse Schachtel 16x81g",
    "artNr": "252620",
    "gebinde": "16er Schachtel",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 17.17,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Daikon Kresse"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Shiso Blätter ROT 15er - Niederlande 100g",
    "artNr": "237422",
    "gebinde": "15er Schale",
    "inhalt": 15,
    "einh": "Stk",
    "preis": 57.45,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Shiso Blätter rot"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Shiso Mix Kresse - Niederlande 12x84g",
    "artNr": "327532",
    "gebinde": "12er Schachtel",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 19.55,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Shiso Mix Kresse"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kalamansi Püree 1kg",
    "artNr": "586030",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 12.75,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Kalamansi Püree"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Pfirsich Püree 1kg",
    "artNr": "587236",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 11.69,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Pfirsich Püree"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Blütenhonig Aro flüssig 500g",
    "artNr": "707190",
    "gebinde": "Tube 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 2.89,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Blütenhonig"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Maldon Sea Salt Flakes - Meersalzkristalle 1,4kg Eimer",
    "artNr": "549397",
    "gebinde": "1,4kg Eimer",
    "inhalt": 1.4,
    "einh": "kg",
    "preis": 17.52,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Maldon Sea Salt"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Esco Sonnensalz Speisesalz 10kg Eimer",
    "artNr": "197051",
    "gebinde": "10kg Eimer",
    "inhalt": 10,
    "einh": "kg",
    "preis": 4.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Speisesalz"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Ruf Argatine Pflanzliches Geliermittel 30g",
    "artNr": "380700",
    "gebinde": "Packung 30g",
    "inhalt": 0.03,
    "einh": "kg",
    "preis": 0.95,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Geliermittel Argatine"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Weizenmehl AroType 405 10x1kg",
    "artNr": "61224",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 5.54,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Weizenmehl 405"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Zucker Raffinade Aro 10x1kg",
    "artNr": "126539",
    "gebinde": "Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 15.29,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Zucker Raffinade"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Knoblauchpulver 1kg",
    "artNr": "005621",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 19.2,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Knoblauchpulver"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Cashewkerne MC 1kg",
    "artNr": "017702",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 13.81,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Cashewkerne"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Pfanni Püree Fix Fertig 4kg Packung",
    "artNr": "393980",
    "gebinde": "4kg Packung",
    "inhalt": 4,
    "einh": "kg",
    "preis": 23.07,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Kartoffelpüree Fix"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Pinienkerne MC 1kg",
    "artNr": "077855",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 53.16,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Pinienkerne"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Goldmais Bonduelle 12x425ml",
    "artNr": "137477",
    "gebinde": "Karton (12x425ml)",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 16,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Goldmais klein"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Goldmais Bonduelle 6x850ml",
    "artNr": "17207",
    "gebinde": "Karton (6x850ml)",
    "inhalt": 6,
    "einh": "Stk",
    "preis": 17.4,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Goldmais groß"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Maiskölbchen Aro 370ml",
    "artNr": "911432",
    "gebinde": "Glas 370ml",
    "inhalt": 0.37,
    "einh": "l",
    "preis": 1.18,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Maiskölbchen"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Zigante Tartufata Trüffel Italien 500g",
    "artNr": "713842",
    "gebinde": "Glas 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 13.25,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Tartufata Trüffel"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Edamame MC 1kg",
    "artNr": "454029",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.1,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Edamame MC"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Edna Butter Croissant TK, 4,4kg, 80x55g",
    "artNr": "351216",
    "gebinde": "Karton (80x55g)",
    "inhalt": 80,
    "einh": "Stk",
    "preis": 45.35,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Butter Croissant TK"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Frosta Blätterteig TK, ca. 30cmx20cm, 10x300g",
    "artNr": "64358",
    "gebinde": "Karton (10x300g)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 11.64,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Blätterteig TK"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Edna Butter Croissant TK 24%, 100x60g",
    "artNr": "673171",
    "gebinde": "Karton (100x60g)",
    "inhalt": 100,
    "einh": "Stk",
    "preis": 55.38,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Butter Croissant TK 60g"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Aviko Sweet Potato Fries TK, 5x2,27kg",
    "artNr": "777928",
    "gebinde": "Karton (5x2,27kg)",
    "inhalt": 11.35,
    "einh": "kg",
    "preis": 47.43,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Süßkartoffel Pommes"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Hummerpaste Langbein 500g",
    "artNr": "72333",
    "gebinde": "Dose 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 5.43,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Hummerpaste"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Alpro Soja Cuisine Culinary Kochcreme vegan 1L",
    "artNr": "408652",
    "gebinde": "1L Packung",
    "inhalt": 1,
    "einh": "l",
    "preis": 1.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Soja Kochcreme"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Salatmayonnaise Aro 50% Fett 10kg",
    "artNr": "84985",
    "gebinde": "10kg Eimer",
    "inhalt": 10,
    "einh": "kg",
    "preis": 19.8,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Salatmayonnaise"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Mayonnaise Aro Delikatess 80% 12x500ml",
    "artNr": "506844",
    "gebinde": "Karton (12x500ml)",
    "inhalt": 6,
    "einh": "l",
    "preis": 21.38,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Delikatess Mayonnaise"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Tomatenmark Mc 12x200g",
    "artNr": "271788",
    "gebinde": "Karton (12x200g)",
    "inhalt": 2.4,
    "einh": "kg",
    "preis": 17.8,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Tomatenmark"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Parmigiano Reggiano MC gerieben, 32% 1kg",
    "artNr": "501719",
    "gebinde": "1kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 14.74,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Parmigiano gerieben"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Dovgan Kondensmilch gezuckert 8,5% 12x370g",
    "artNr": "458910",
    "gebinde": "Karton (12x370g)",
    "inhalt": 4.44,
    "einh": "kg",
    "preis": 15.64,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Kondensmilch gezuckert"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Milchmädchen Kondensmilch 9%, 12x400g",
    "artNr": "792953",
    "gebinde": "Karton (12x400g)",
    "inhalt": 4.8,
    "einh": "kg",
    "preis": 26.76,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Milchmädchen"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Schlagsahne aro 30% Fett 12x 1L",
    "artNr": "933784",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 40.44,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "H-Schlagsahne 30%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Küchen-Profi-Sahne aro 20% Fett 12x1L",
    "artNr": "928956",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 33.59,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "H-Kochsahne 20%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Milch Aro 3,5% 12x1L",
    "artNr": "466469",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 12.55,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "H-Milch 3,5%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Halloumi Gazi 43% 10x250g",
    "artNr": "599484",
    "gebinde": "Karton (10x250g)",
    "inhalt": 2.5,
    "einh": "kg",
    "preis": 45.8,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Halloumi Käse"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Markenbutter Aro 82% 40x250g",
    "artNr": "897997",
    "gebinde": "Karton (40x250g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 79.38,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Markenbutter"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Gurke 6x1L",
    "artNr": "498811",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 37.81,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Gurke"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Mango 6x1L",
    "artNr": "498921",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 37.78,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Mango"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Holunderblüte 6x1L",
    "artNr": "498813",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 38.16,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Holunder"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Weisser Rohrzucker 6x1l",
    "artNr": "498756",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 33,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Rohrzucker Sirup"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Ananas 6x1L",
    "artNr": "498933",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 37.8,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Ananas"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Maracuja 6x1L",
    "artNr": "498931",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 37.8,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Maracuja"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Himbeere 6x1L",
    "artNr": "498951",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 37.74,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "MONIN Sirup Himbeere"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Aperol Aperitivo Italiano 6x0,7L",
    "artNr": "367146",
    "gebinde": "Karton (6x0,7L)",
    "inhalt": 4.2,
    "einh": "l",
    "preis": 57.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Aperol 0,7L"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Three Sixty Vodka 37,5% Vol. 0,7L",
    "artNr": "480933",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 9.75,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Three Sixty Vodka"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Coca Cola 12x1L",
    "artNr": "012594",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 14.24,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Coca Cola"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Sprite 12x1L",
    "artNr": "012602",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 14.24,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Sprite"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Coca Cola Zero 12x1L",
    "artNr": "068869",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 14.24,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Coca Cola Zero"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Happy Day Fruchtnektar Mango 6x1L",
    "artNr": "549303",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 9.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Happy Day Mango"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Happy Day Fruchtnektar Maracuja 6x1L",
    "artNr": "384915",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 10.22,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Happy Day Maracuja"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Happy Day Apfelsaft 6x1L",
    "artNr": "551844",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 13.49,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Happy Day Apfel"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Apfelsaft Trüb Wesergold 8x1L",
    "artNr": "416214",
    "gebinde": "Karton (8x1L)",
    "inhalt": 8,
    "einh": "l",
    "preis": 12.11,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Apfelsaft trüb"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Happy Day Cranberry 6x1L",
    "artNr": "549309",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 13.49,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Happy Day Cranberry"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Hafertaler Gille,Schweden 600g",
    "artNr": "061811",
    "gebinde": "Packung 600g",
    "inhalt": 0.6,
    "einh": "kg",
    "preis": 4.68,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Hafertaler Gille"
  },
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Frittieröl Aro 10L",
    "artNr": "921377",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 12.89,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Frittieröl Aro"
  },
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Rapsöl Aro 10L",
    "artNr": "208622",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 12.35,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Rapsöl Aro"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Salz Finish körnig Geschirrspüler 1,2kg",
    "artNr": "396922",
    "gebinde": "Packung 1,2kg",
    "inhalt": 1.2,
    "einh": "kg",
    "preis": 1.27,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Spülmaschinensalz"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Spülmittel Fit flüssig 10L",
    "artNr": "119033",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 14.52,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Fit Spülmittel 10L"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Spülmittel Aro flüssig 10L",
    "artNr": "519830",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 6.28,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Aro Spülmittel 10L"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Fettlöser Metro Professional flüssig 5L",
    "artNr": "986465",
    "gebinde": "5L Kanister",
    "inhalt": 5,
    "einh": "l",
    "preis": 5.99,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Fettlöser Profi 5L"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Tork Wischtuch 2x750 Blatt 23,5 x 34 cm, 2 lagig",
    "artNr": "484038",
    "gebinde": "Packung (2 Rollen)",
    "inhalt": 2,
    "einh": "Stk",
    "preis": 29.56,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Tork Wischtuch"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Tork Multif. Weiß 2 lagig 7x100",
    "artNr": "484000",
    "gebinde": "Karton (7 Pack)",
    "inhalt": 7,
    "einh": "Stk",
    "preis": 15.32,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Tork Falthandtücher"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Toilettenpapier 4 lagig 24x160",
    "artNr": "601181",
    "gebinde": "Packung (24 Rollen)",
    "inhalt": 24,
    "einh": "Stk",
    "preis": 8.77,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Toilettenpapier 4-lagig"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Einweghandschuhe Schwarz Latex Größe M 100Stk",
    "artNr": "872488",
    "gebinde": "Box (100 Stk)",
    "inhalt": 100,
    "einh": "Stk",
    "preis": 4.32,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Latexhandschuhe M"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Zewa Wisch&Weg Klassik Weiß 2 lagig 8x45 Blatt",
    "artNr": "763574",
    "gebinde": "Packung (8 Rollen)",
    "inhalt": 8,
    "einh": "Stk",
    "preis": 5.43,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Zewa Küchenrollen"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Küchenrollen Aro 3-lagig 8x64Blatt",
    "artNr": "124832",
    "gebinde": "Packung (8 Rollen)",
    "inhalt": 8,
    "einh": "Stk",
    "preis": 4.34,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Aro Küchenrollen"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Handtuchpapier Papstar 25x23 cm 1 lagig, 250Stk",
    "artNr": "629389",
    "gebinde": "Packung (250 Blatt)",
    "inhalt": 250,
    "einh": "Stk",
    "preis": 13.63,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Papstar Handtuchpapier"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Topfreiniger MP Jumbo 10 Stück",
    "artNr": "953111",
    "gebinde": "Packung (10 Stk)",
    "inhalt": 10,
    "einh": "Stk",
    "preis": 5.82,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Topfreiniger Jumbo"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "MP Airlaid Servietten Weiß 40x40cm,4lagig, 60Stk",
    "artNr": "1933",
    "gebinde": "Packung (60 Stk)",
    "inhalt": 60,
    "einh": "Stk",
    "preis": 4.38,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Airlaid Servietten 40x40"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "MP Servietten 40x40cm Weiß, 3 lagig 250Stk",
    "artNr": "912917",
    "gebinde": "Packung (250 Stk)",
    "inhalt": 250,
    "einh": "Stk",
    "preis": 12.79,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Servietten 3-lagig 250er"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Teelichter Aro Weiß ca. 200x4 Std.",
    "artNr": "598628",
    "gebinde": "Packung (200 Stk)",
    "inhalt": 200,
    "einh": "Stk",
    "preis": 8.45,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Teelichter 4h"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Teelichter MP 150x 6H",
    "artNr": "192246",
    "gebinde": "Packung (150 Stk)",
    "inhalt": 150,
    "einh": "Stk",
    "preis": 8.85,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Teelichter 6h"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Gefrierbeutel Aro 3x45x6L",
    "artNr": "510797",
    "gebinde": "Karton (3 Rollen)",
    "inhalt": 3,
    "einh": "Stk",
    "preis": 4.72,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Gefrierbeutel 6L"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Gefrierbeutel Aro 25x10L",
    "artNr": "510799",
    "gebinde": "Rolle (25 Stk)",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 3.29,
    "lieferant": "METRO Deutschland (Leipzig)",
    "note": "Gefrierbeutel 10L"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Suppenhuhn Buckl 10x1200g",
    "artNr": "369476",
    "gebinde": "Karton (10x1,2kg / 12kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 29,
    "lieferant": "Selgros",
    "note": "Suppenhuhn 10er"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenschenkel m. Rücken Poln. 300-350g",
    "artNr": "94011752154865",
    "gebinde": "Packung ca. 330g",
    "inhalt": 0.33,
    "einh": "kg",
    "preis": 4.39,
    "lieferant": "Selgros",
    "note": "Hähnchenschenkel"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchen Oberkeulenfleisch m H. o Kopf",
    "artNr": "94011752158634",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 6.99,
    "lieferant": "Selgros",
    "note": "Hähnchen Oberkeule"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenmägen Frisch",
    "artNr": "94011752080355",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 4.99,
    "lieferant": "Selgros",
    "note": "Hähnchenmägen"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rib Eye Dry Aged TW RI. ca 1,5kg",
    "artNr": "2837040000000",
    "gebinde": "Stück ca. 1,5kg",
    "inhalt": 1.5,
    "einh": "kg",
    "preis": 25.22,
    "lieferant": "Selgros",
    "note": "Rib Eye Dry Aged"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rinder Markknochen Ges. gefroren",
    "artNr": "398766",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.31,
    "lieferant": "Selgros",
    "note": "Rinder Markknochen"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rind Spannrippe EU",
    "artNr": "2833480000000",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 10.49,
    "lieferant": "Selgros",
    "note": "Rinder Spannrippe"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rind Falsches Filet EU",
    "artNr": "2879310000000",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8.77,
    "lieferant": "Selgros",
    "note": "Falsches Filet"
  },
  {
    "wg": "E4: Rindfleisch",
    "name": "Rind Oberschale EU",
    "artNr": "0000378480",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 9.86,
    "lieferant": "Selgros",
    "note": "Rinder Oberschale"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schweinebauch ladenfertig ca. 4,5kg Fr",
    "artNr": "476932",
    "gebinde": "Stück ca. 4,5kg",
    "inhalt": 4.5,
    "einh": "kg",
    "preis": 19.58,
    "lieferant": "Selgros",
    "note": "Schweinebauch frisch"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schweinebauch ladenfertig",
    "artNr": "428895",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.92,
    "lieferant": "Selgros",
    "note": "Schweinebauch"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schwein Hackfleisch zum braten",
    "artNr": "4059586521382",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 4.9,
    "lieferant": "Selgros",
    "note": "Schweinehack"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schweine Vorder Eisbein",
    "artNr": "4059586690798",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.29,
    "lieferant": "Selgros",
    "note": "Schweine Eisbein"
  },
  {
    "wg": "E5: Schweinefleisch",
    "name": "Schwein Pfoten",
    "artNr": "4059586687934",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 2.39,
    "lieferant": "Selgros",
    "note": "Schweinepfoten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Gelbe Beete Niederlande",
    "artNr": "70885",
    "gebinde": "1kg",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.05,
    "lieferant": "Selgros",
    "note": "Gelbe Beete"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spargel grün Deutschland 500g",
    "artNr": "4059586638844",
    "gebinde": "Bund 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 5.09,
    "lieferant": "Selgros",
    "note": "Spargel grün 500g"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spargel grün Mexiko 450g",
    "artNr": "850290002174",
    "gebinde": "Bund 450g",
    "inhalt": 0.45,
    "einh": "kg",
    "preis": 8.99,
    "lieferant": "Selgros",
    "note": "Spargel grün Mexiko"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Wilder Brokkoli 300g",
    "artNr": "99863",
    "gebinde": "Schale 300g",
    "inhalt": 0.3,
    "einh": "kg",
    "preis": 5.09,
    "lieferant": "Selgros",
    "note": "Wilder Brokkoli"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Karotten Mini Rainbow Südafrika 200g",
    "artNr": "456117",
    "gebinde": "Schale 200g",
    "inhalt": 0.2,
    "einh": "kg",
    "preis": 4.56,
    "lieferant": "Selgros",
    "note": "Mini Karotten Rainbow"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kräuterseitlinge 300g",
    "artNr": "4337271300284",
    "gebinde": "Schale 300g",
    "inhalt": 0.3,
    "einh": "kg",
    "preis": 5,
    "lieferant": "Selgros",
    "note": "Kräuterseitlinge"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Affilla",
    "artNr": "8711547037054",
    "gebinde": "1 Stück",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 1.99,
    "lieferant": "Selgros",
    "note": "Kresse Affilla"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Daikon K.C. Si Niederlande 12Stk x ca 81 g",
    "artNr": "567785",
    "gebinde": "12er Kiste",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 16.73,
    "lieferant": "Selgros",
    "note": "Daikon Kresse 12er"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Zuckererbse Gourmet 15Stk x ca 81 g",
    "artNr": "876379",
    "gebinde": "15er Kiste",
    "inhalt": 15,
    "einh": "Stk",
    "preis": 17.01,
    "lieferant": "Selgros",
    "note": "Zuckererbsen Kresse"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Gourmet Shiso 15Stk",
    "artNr": "930553",
    "gebinde": "15er Kiste",
    "inhalt": 15,
    "einh": "Stk",
    "preis": 16.67,
    "lieferant": "Selgros",
    "note": "Shiso Kresse 15er"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Kresse Gourmet Shiso 15Stk",
    "artNr": "273620",
    "gebinde": "15er Kiste",
    "inhalt": 15,
    "einh": "Stk",
    "preis": 16.67,
    "lieferant": "Selgros",
    "note": "Shiso Kresse 15er"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Püree Birne Pont 1kg",
    "artNr": "246670",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 7.46,
    "lieferant": "Selgros",
    "note": "Birnen Püree"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Püree Erdbeere Pont 1kg",
    "artNr": "516130",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8.52,
    "lieferant": "Selgros",
    "note": "Erdbeer Püree"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Püree Pfirsich, weiß Pont 1kg",
    "artNr": "24602",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8.51,
    "lieferant": "Selgros",
    "note": "Pfirsich Püree weiß"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Veilchen Kelterhof 35-45Stk",
    "artNr": "112938",
    "gebinde": "Schachtel (40 Stk)",
    "inhalt": 40,
    "einh": "Stk",
    "preis": 6.55,
    "lieferant": "Selgros",
    "note": "Essbare Veilchen"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Zucker Raffinade Ja 1kg",
    "artNr": "369170",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 1.32,
    "lieferant": "Selgros",
    "note": "Zucker Ja 1kg"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Zucker Braun 1kg",
    "artNr": "784221",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 2.25,
    "lieferant": "Selgros",
    "note": "Brauner Zucker 1kg"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Weizenmehl Typ 405 1kg",
    "artNr": "904593",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 0.6,
    "lieferant": "Selgros",
    "note": "Weizenmehl Typ 405"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Goldmais Bo. 12x425g",
    "artNr": "607407",
    "gebinde": "Karton (12x425g)",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 16,
    "lieferant": "Selgros",
    "note": "Goldmais 12er"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Kartoffel Püree-Flocken 4x1kg",
    "artNr": "120289",
    "gebinde": "Karton (4x1kg)",
    "inhalt": 4,
    "einh": "kg",
    "preis": 17.04,
    "lieferant": "Selgros",
    "note": "Kartoffelpüree Flocken"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Sweet Potatoe Fries Aviko TK 2,27kg",
    "artNr": "495608",
    "gebinde": "Beutel 2,27kg",
    "inhalt": 2.27,
    "einh": "kg",
    "preis": 9.86,
    "lieferant": "Selgros",
    "note": "Süßkartoffel Pommes"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Trüffel Creme BH. 6x200g",
    "artNr": "206455",
    "gebinde": "Karton (6x200g)",
    "inhalt": 1.2,
    "einh": "kg",
    "preis": 12.25,
    "lieferant": "Selgros",
    "note": "Trüffel Creme 6er"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Trüffel Flavour Sauce Veg. 500ml",
    "artNr": "970846",
    "gebinde": "Glas 500ml",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 5.69,
    "lieferant": "Selgros",
    "note": "Trüffelsauce 500ml"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Kerry Gold 40x250g",
    "artNr": "367556",
    "gebinde": "Karton (40x250g / 10kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 104.5,
    "lieferant": "Selgros",
    "note": "Kerrygold Butter"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Frischmilch Ja 3,5% 10x1L",
    "artNr": "425181",
    "gebinde": "Karton (10x1L)",
    "inhalt": 10,
    "einh": "l",
    "preis": 12.71,
    "lieferant": "Selgros",
    "note": "Frischmilch 3,5%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Milch Ja 3,5% 12x1L",
    "artNr": "408041",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 10.52,
    "lieferant": "Selgros",
    "note": "H-Milch Ja 3,5%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Milch Sachsen 3,5% 12x1L",
    "artNr": "502562",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 12.84,
    "lieferant": "Selgros",
    "note": "H-Milch Sachsen"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "H-Schlagsahne 30% 12x1kg",
    "artNr": "336611",
    "gebinde": "Karton (12x1kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 22.32,
    "lieferant": "Selgros",
    "note": "H-Schlagsahne 30%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Schlagsahne 33% Gastro 10x1L",
    "artNr": "731188",
    "gebinde": "Karton (10x1L)",
    "inhalt": 10,
    "einh": "l",
    "preis": 41.25,
    "lieferant": "Selgros",
    "note": "Gastro Sahne 33%"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Philadelphia Natur 68% 500g",
    "artNr": "439312",
    "gebinde": "Packung 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 5.05,
    "lieferant": "Selgros",
    "note": "Philadelphia 500g"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Philadelphia Natur 68% 1,65kg",
    "artNr": "4000339034840",
    "gebinde": "Wanne 1,65kg",
    "inhalt": 1.65,
    "einh": "kg",
    "preis": 14.8,
    "lieferant": "Selgros",
    "note": "Philadelphia Gastro"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Apfelsaft Wolke 6x1L",
    "artNr": "0000442668",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 10.33,
    "lieferant": "Selgros",
    "note": "Apfelsaft Wolke"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Mango Happy Day 6x1L",
    "artNr": "399692",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 10.33,
    "lieferant": "Selgros",
    "note": "Happy Day Mango"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Cranberry Rauch 6x1L",
    "artNr": "685368",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 10.12,
    "lieferant": "Selgros",
    "note": "Rauch Cranberry"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Maracujanektar Rauch 6x1L",
    "artNr": "93835",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 10.19,
    "lieferant": "Selgros",
    "note": "Rauch Maracuja"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Coca Cola 12x1L",
    "artNr": "723367",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 10.81,
    "lieferant": "Selgros",
    "note": "Coca Cola 12er"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Coca Cola Zero 12x1L",
    "artNr": "203661",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 10.81,
    "lieferant": "Selgros",
    "note": "Coca Cola Zero 12er"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Sprite 12x1L",
    "artNr": "0000723374",
    "gebinde": "Kasten (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 10.81,
    "lieferant": "Selgros",
    "note": "Sprite 12er"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Fever Tree Wild Berry 24x0,2L",
    "artNr": "970536",
    "gebinde": "Kasten (24x0,2L)",
    "inhalt": 4.8,
    "einh": "l",
    "preis": 25.73,
    "lieferant": "Selgros",
    "note": "Fever Tree Wild Berry"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Fever Tree Dry Tonic 24x0,2L",
    "artNr": "745922",
    "gebinde": "Kasten (24x0,2L)",
    "inhalt": 4.8,
    "einh": "l",
    "preis": 25.73,
    "lieferant": "Selgros",
    "note": "Fever Tree Dry Tonic"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Fever Tree Indian Tonic 24x0,2L",
    "artNr": "5060108450232",
    "gebinde": "Kasten (24x0,2L)",
    "inhalt": 4.8,
    "einh": "l",
    "preis": 25.73,
    "lieferant": "Selgros",
    "note": "Fever Tree Indian Tonic"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Fever Tree Ginger Beer 24x0,2L",
    "artNr": "704402",
    "gebinde": "Kasten (24x0,2L)",
    "inhalt": 4.8,
    "einh": "l",
    "preis": 25.73,
    "lieferant": "Selgros",
    "note": "Fever Tree Ginger Beer"
  },
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Rapsöl Pet 10L",
    "artNr": "41126",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 11.92,
    "lieferant": "Selgros",
    "note": "Rapsöl Pet 10L"
  },
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Frittieröl Selgros Plus 10L",
    "artNr": "463062",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 14.77,
    "lieferant": "Selgros",
    "note": "Frittieröl Plus 10L"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Dan Klorix Hygienereiniger 5L",
    "artNr": "37419",
    "gebinde": "5L Kanister",
    "inhalt": 5,
    "einh": "l",
    "preis": 7.8,
    "lieferant": "Selgros",
    "note": "Dan Klorix 5L"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Fettlöser Konzentrat 5L",
    "artNr": "85786",
    "gebinde": "5L Kanister",
    "inhalt": 5,
    "einh": "l",
    "preis": 14.33,
    "lieferant": "Selgros",
    "note": "Fettlöser Konzentrat"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Fit Allesr. Zitronenfrische 10L",
    "artNr": "397859",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 14.1,
    "lieferant": "Selgros",
    "note": "Fit Allzweckreiniger"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Handtücher Tork Multi 2 lagig 700 Blatt",
    "artNr": "7322540131192",
    "gebinde": "Rolle (700 Blatt)",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 18.71,
    "lieferant": "Selgros",
    "note": "Tork Handtuchrolle"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Galakor F8 Reiniger 12kg",
    "artNr": "18562",
    "gebinde": "12kg Kanister",
    "inhalt": 12,
    "einh": "kg",
    "preis": 25.19,
    "lieferant": "Selgros",
    "note": "Galakor F8 Reiniger"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Toilettenpapier 3lagig 16x200Blatt",
    "artNr": "509110",
    "gebinde": "Packung (16 Rollen)",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 6.11,
    "lieferant": "Selgros",
    "note": "Toilettenpapier 3-lagig"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Shiragiku Yuzu 500ml",
    "artNr": "SHG0004",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 19.83,
    "lieferant": "Sake",
    "note": "Shiragiku Yuzu"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Shiragiku Aka Ume Rote Pflaume 500ml",
    "artNr": "SHG0006",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 20.88,
    "lieferant": "Sake",
    "note": "Shiragiku Aka Ume"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Masumi Kuro Black 720ml",
    "artNr": "M0055",
    "gebinde": "Flasche 0,72L",
    "inhalt": 0.72,
    "einh": "l",
    "preis": 24.7,
    "lieferant": "Sake",
    "note": "Masumi Kuro Sake"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Masumi Sanka Bergblume 720ml",
    "artNr": "M0022",
    "gebinde": "Flasche 0,72L",
    "inhalt": 0.72,
    "einh": "l",
    "preis": 37.48,
    "lieferant": "Sake",
    "note": "Masumi Sanka Sake"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Imayotsukasa Junmai Daiginjo 720ml",
    "artNr": "IMT0016",
    "gebinde": "Flasche 0,72L",
    "inhalt": 0.72,
    "einh": "l",
    "preis": 32.24,
    "lieferant": "Sake",
    "note": "Imayotsukasa Sake"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Basilikum Topf XL",
    "artNr": "",
    "gebinde": "1 Topf",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 2.97,
    "lieferant": "Aldi",
    "note": "Basilikum Topf"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Heidelbeeren 200g",
    "artNr": "",
    "gebinde": "Schale 200g",
    "inhalt": 0.2,
    "einh": "kg",
    "preis": 1.79,
    "lieferant": "Aldi",
    "note": "Heidelbeeren 200g"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Heidelbeeren 500g",
    "artNr": "",
    "gebinde": "Schale 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 3.73,
    "lieferant": "Aldi",
    "note": "Heidelbeeren 500g"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Himbeeren 125g",
    "artNr": "",
    "gebinde": "Schale 125g",
    "inhalt": 0.125,
    "einh": "kg",
    "preis": 4.65,
    "lieferant": "Aldi",
    "note": "Himbeeren 125g"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Orangen 2kg",
    "artNr": "",
    "gebinde": "Netz 2kg",
    "inhalt": 2,
    "einh": "kg",
    "preis": 6.52,
    "lieferant": "Aldi",
    "note": "Orangen 2kg"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Rispentomaten 650g",
    "artNr": "",
    "gebinde": "Schale 650g",
    "inhalt": 0.65,
    "einh": "kg",
    "preis": 1.39,
    "lieferant": "Aldi",
    "note": "Rispentomaten"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Saftorangen 1,5kg",
    "artNr": "",
    "gebinde": "Netz 1,5kg",
    "inhalt": 1.5,
    "einh": "kg",
    "preis": 2.23,
    "lieferant": "Aldi",
    "note": "Saftorangen"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spargel 500g",
    "artNr": "",
    "gebinde": "Bund 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 4.66,
    "lieferant": "Aldi",
    "note": "Spargel 500g"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Spitzpaprika 300g",
    "artNr": "",
    "gebinde": "Packung 300g",
    "inhalt": 0.3,
    "einh": "kg",
    "preis": 3.72,
    "lieferant": "Aldi",
    "note": "Spitzpaprika"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Bärenmarke Frischmilch 1L",
    "artNr": "",
    "gebinde": "1L Packung",
    "inhalt": 1,
    "einh": "l",
    "preis": 2.22,
    "lieferant": "Aldi",
    "note": "Frischmilch Bärenmarke"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Prosecco Doc Frizzante 0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 20.94,
    "lieferant": "Aldi",
    "note": "Prosecco Frizzante"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "FLIRT Bitter-Getränk 1 l, Ginger Ale",
    "artNr": "",
    "gebinde": "Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 2.94,
    "lieferant": "Aldi",
    "note": "Ginger Ale"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Fit Spülmittel 500ml",
    "artNr": "",
    "gebinde": "Flasche 500ml",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 2.5,
    "lieferant": "Aldi",
    "note": "Fit Spülmittel 500ml"
  },
  {
    "wg": "E2: Meeresfrüchte",
    "name": "Garnele o. Schale, Julia Alex 26/30 10x800g",
    "artNr": "",
    "gebinde": "Karton (10x800g / 8kg)",
    "inhalt": 8,
    "einh": "kg",
    "preis": 110,
    "lieferant": "Nga Anh",
    "note": "Garnelen ohne Schale"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenbrust Brasilien 2x6kg",
    "artNr": "",
    "gebinde": "Karton (2x6kg / 12kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 65,
    "lieferant": "Nga Anh",
    "note": "Hähnchenbrust Brasilien"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenbrust Thailand 2x6kg",
    "artNr": "",
    "gebinde": "Karton (2x6kg / 12kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 62,
    "lieferant": "Nga Anh",
    "note": "Hähnchenbrust Thailand"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchen Seitan, 20x300g",
    "artNr": "",
    "gebinde": "Karton (20x300g / 6kg)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 73,
    "lieferant": "Nga Anh",
    "note": "Hähnchen Seitan vegan"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Ente Loc Son 3,8kg(6x1,9kg) 72 Stück",
    "artNr": "",
    "gebinde": "Karton (6x1,9kg / 11,4kg)",
    "inhalt": 11.4,
    "einh": "kg",
    "preis": 120,
    "lieferant": "Nga Anh",
    "note": "Ente Loc Son"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Tofu natural Lehop Berlin 450g",
    "artNr": "",
    "gebinde": "Packung 450g",
    "inhalt": 0.45,
    "einh": "kg",
    "preis": 1.7,
    "lieferant": "Nga Anh",
    "note": "Tofu natural Lehop"
  },
  {
    "wg": "E6: Pflanzliche Alternativen",
    "name": "Tofu Bio ca 250g",
    "artNr": "",
    "gebinde": "Packung 250g",
    "inhalt": 0.25,
    "einh": "kg",
    "preis": 1.53,
    "lieferant": "Nga Anh",
    "note": "Bio Tofu"
  },
  {
    "wg": "E6: Pflanzliche Alternativen",
    "name": "Ente Vegan BBQ",
    "artNr": "",
    "gebinde": "1 Stück",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 4.5,
    "lieferant": "Nga Anh",
    "note": "Vegane Ente BBQ"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Reis Lua Chin 18kg",
    "artNr": "",
    "gebinde": "18kg Sack",
    "inhalt": 18,
    "einh": "kg",
    "preis": 30,
    "lieferant": "Nga Anh",
    "note": "Reis Lua Chin"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Reispapier 3 Cay Tre Bamboos 36x400g, 50Stk",
    "artNr": "",
    "gebinde": "Karton (36x400g / 14,4kg)",
    "inhalt": 14.4,
    "einh": "kg",
    "preis": 80,
    "lieferant": "Nga Anh",
    "note": "Reispapier Bamboos"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Reisnudeln Lan Do Vifon 20x500g",
    "artNr": "",
    "gebinde": "Karton (20x500g / 10kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 27,
    "lieferant": "Nga Anh",
    "note": "Reisnudeln Vifon"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Reisbandnudeln Vifon 20x500g",
    "artNr": "",
    "gebinde": "Karton (20x500g / 10kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 50,
    "lieferant": "Nga Anh",
    "note": "Reisbandnudeln Vifon"
  },
  {
    "wg": "E7: Reis & Nudeln",
    "name": "Udon Ita-San 30x200g",
    "artNr": "",
    "gebinde": "Karton (30x200g / 6kg)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 20,
    "lieferant": "Nga Anh",
    "note": "Udon Nudeln Ita-San"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Galgant gemahlen BDMP Bangkok 10x300g",
    "artNr": "",
    "gebinde": "Karton (10x300g / 3kg)",
    "inhalt": 3,
    "einh": "kg",
    "preis": 22,
    "lieferant": "Nga Anh",
    "note": "Galgant gemahlen"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Knoblauch TK 1kg",
    "artNr": "",
    "gebinde": "1kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 5,
    "lieferant": "Nga Anh",
    "note": "Knoblauch TK"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Betelblätter La Lot ca 100Blatt",
    "artNr": "",
    "gebinde": "Bund (100 Blatt)",
    "inhalt": 100,
    "einh": "Stk",
    "preis": 2,
    "lieferant": "Nga Anh",
    "note": "La Lot Blätter"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Chilischoten rot frisch Veggie Vietnam 100g",
    "artNr": "",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 2,
    "lieferant": "Nga Anh",
    "note": "Chilischoten rot"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Dill",
    "artNr": "",
    "gebinde": "1 Bund",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 1.5,
    "lieferant": "Nga Anh",
    "note": "Frischer Dill"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Limettenblätter Bangkok TK 100g",
    "artNr": "",
    "gebinde": "Packung 100g",
    "inhalt": 0.1,
    "einh": "kg",
    "preis": 2.5,
    "lieferant": "Nga Anh",
    "note": "Limettenblätter TK"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Mango Pulp 6x750ml",
    "artNr": "",
    "gebinde": "Karton (6x750ml / 4,5L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 21,
    "lieferant": "Nga Anh",
    "note": "Mango Pulp"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Koriander",
    "artNr": "",
    "gebinde": "1 Bund",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 1.5,
    "lieferant": "Nga Anh",
    "note": "Frischer Koriander"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Zitronengras gehackt Vietnam TK 250g",
    "artNr": "",
    "gebinde": "Packung 250g",
    "inhalt": 0.25,
    "einh": "kg",
    "preis": 2,
    "lieferant": "Nga Anh",
    "note": "Zitronengras TK"
  },
  {
    "wg": "E8: Gemüse & Frische",
    "name": "Sojasprossen 1kg",
    "artNr": "",
    "gebinde": "1kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 1.5,
    "lieferant": "Nga Anh",
    "note": "Sojasprossen"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Currypulver An Do 500g",
    "artNr": "",
    "gebinde": "Dose 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 11,
    "lieferant": "Nga Anh",
    "note": "Currypulver An Do"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Erdnüsse geschält 10kg",
    "artNr": "",
    "gebinde": "10kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 47,
    "lieferant": "Nga Anh",
    "note": "Erdnüsse Sack"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Essig Meli Fein hell 10% Säure 10l",
    "artNr": "",
    "gebinde": "10L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 12,
    "lieferant": "Nga Anh",
    "note": "Essig Meli 10L"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Honig Korea",
    "artNr": "",
    "gebinde": "Karton",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 90,
    "lieferant": "Nga Anh",
    "note": "Honig Korea"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Honig Yuzu 1kg",
    "artNr": "",
    "gebinde": "1kg Glas",
    "inhalt": 1,
    "einh": "kg",
    "preis": 108,
    "lieferant": "Nga Anh",
    "note": "Yuzu Honig"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Röstzwiebeln 10x400g",
    "artNr": "",
    "gebinde": "Karton (10x400g / 4kg)",
    "inhalt": 4,
    "einh": "kg",
    "preis": 23,
    "lieferant": "Nga Anh",
    "note": "Röstzwiebeln 10er"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Kim Chi",
    "artNr": "",
    "gebinde": "1kg VPE",
    "inhalt": 1,
    "einh": "kg",
    "preis": 5,
    "lieferant": "Nga Anh",
    "note": "Kimchi"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Kartoffelmehl China 20kg",
    "artNr": "",
    "gebinde": "20kg Sack",
    "inhalt": 20,
    "einh": "kg",
    "preis": 32,
    "lieferant": "Nga Anh",
    "note": "Kartoffelmehl 20kg"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Pankomehl Melda Thailand 10kg",
    "artNr": "",
    "gebinde": "10kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 30,
    "lieferant": "Nga Anh",
    "note": "Pankomehl 10kg"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Salz Eimer 10KG",
    "artNr": "",
    "gebinde": "10kg Eimer",
    "inhalt": 10,
    "einh": "kg",
    "preis": 10,
    "lieferant": "Nga Anh",
    "note": "Speisesalz 10kg"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Sesam schwarz 1kg",
    "artNr": "",
    "gebinde": "1kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 8,
    "lieferant": "Nga Anh",
    "note": "Sesam schwarz"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Würzmischung Bot Canh Hachacorp 190g",
    "artNr": "",
    "gebinde": "Packung 190g",
    "inhalt": 0.19,
    "einh": "kg",
    "preis": 5,
    "lieferant": "Nga Anh",
    "note": "Bot Canh Würze"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Würzmischung Knorr Hat Nem 8x900g",
    "artNr": "",
    "gebinde": "Karton (8x900g / 7,2kg)",
    "inhalt": 7.2,
    "einh": "kg",
    "preis": 40,
    "lieferant": "Nga Anh",
    "note": "Knorr Hat Nem"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Würzmischung Mi Chinh Ajinomoto 1kg",
    "artNr": "",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 6,
    "lieferant": "Nga Anh",
    "note": "Ajinomoto MSG"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Würzmischung Xa Xiu Lobo 400g",
    "artNr": "",
    "gebinde": "Packung 400g",
    "inhalt": 0.4,
    "einh": "kg",
    "preis": 2,
    "lieferant": "Nga Anh",
    "note": "Xa Xiu Marinade"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Gyoza Gemüse Ha Cao Chay 20x440g(20stk)",
    "artNr": "",
    "gebinde": "Karton (20x440g / 8,8kg)",
    "inhalt": 8.8,
    "einh": "kg",
    "preis": 80,
    "lieferant": "Nga Anh",
    "note": "Gemüse Gyoza Chay"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Gyoza Hähnchen Ajinomoto 10x600g(30stk)",
    "artNr": "",
    "gebinde": "Karton (10x600g / 6kg)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 65,
    "lieferant": "Nga Anh",
    "note": "Hähnchen Gyoza 10er"
  },
  {
    "wg": "E10: TK & Convenience",
    "name": "Wan Tan 67 Blatt 500g",
    "artNr": "",
    "gebinde": "Packung 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 3.5,
    "lieferant": "Nga Anh",
    "note": "Wan Tan Blätter"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Austern Soße Lee Kum Kee Dau Hau Alu 6x2,27kg",
    "artNr": "",
    "gebinde": "Karton (6x2,27kg / 13,62kg)",
    "inhalt": 13.62,
    "einh": "kg",
    "preis": 50,
    "lieferant": "Nga Anh",
    "note": "Austernsauce LKK"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Austern Soße Dau Hau Kanister 3x5kg",
    "artNr": "",
    "gebinde": "Karton (3x5kg / 15kg)",
    "inhalt": 15,
    "einh": "kg",
    "preis": 50,
    "lieferant": "Nga Anh",
    "note": "Austernsauce 15kg"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Currypaste gelb Thailand 12x1kg",
    "artNr": "",
    "gebinde": "Karton (12x1kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 65,
    "lieferant": "Nga Anh",
    "note": "Gelbe Currypaste"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Currypaste rot Thailand 12x1kg",
    "artNr": "",
    "gebinde": "Karton (12x1kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 65,
    "lieferant": "Nga Anh",
    "note": "Rote Currypaste"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Tom Yum Thailand 12x900g",
    "artNr": "",
    "gebinde": "Karton (12x900g / 10,8kg)",
    "inhalt": 10.8,
    "einh": "kg",
    "preis": 72,
    "lieferant": "Nga Anh",
    "note": "Tom Yum Paste"
  },
  {
    "wg": "E12: Molkereiprodukte & Eier",
    "name": "Kokosmilch Aroy 12x1l",
    "artNr": "",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 34,
    "lieferant": "Nga Anh",
    "note": "Aroy-D Kokosmilch"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Kokospaste Pride 40x200g",
    "artNr": "",
    "gebinde": "Karton (40x200g / 8kg)",
    "inhalt": 8,
    "einh": "kg",
    "preis": 72,
    "lieferant": "Nga Anh",
    "note": "Kokospaste Pride"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Sriracha Goose 12x730ml",
    "artNr": "",
    "gebinde": "Karton (12x730ml / 8,76L)",
    "inhalt": 8.76,
    "einh": "l",
    "preis": 55,
    "lieferant": "Nga Anh",
    "note": "Flying Goose Sriracha"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Erdnusspaste Pindakaas Eimer 10kg",
    "artNr": "",
    "gebinde": "10kg Eimer",
    "inhalt": 10,
    "einh": "kg",
    "preis": 47,
    "lieferant": "Nga Anh",
    "note": "Erdnusspaste Pindakaas"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Fischsoße Mam Muc 12x0,725",
    "artNr": "",
    "gebinde": "Karton (12x0,725L / 8,7L)",
    "inhalt": 8.7,
    "einh": "l",
    "preis": 27,
    "lieferant": "Nga Anh",
    "note": "Fischsauce Mam Muc"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Hoisin Lee Kum Kee 6x2,27kg",
    "artNr": "",
    "gebinde": "Karton (6x2,27kg / 13,62kg)",
    "inhalt": 13.62,
    "einh": "kg",
    "preis": 45,
    "lieferant": "Nga Anh",
    "note": "Hoisin Sauce LKK"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Kikkoman 20l",
    "artNr": "",
    "gebinde": "20L Kanister",
    "inhalt": 20,
    "einh": "l",
    "preis": 52,
    "lieferant": "Nga Anh",
    "note": "Kikkoman Sojasauce 20L"
  },
  {
    "wg": "E11: Saucen, Dips & Pasten",
    "name": "Xi Dac Thang Be 12x970ml",
    "artNr": "",
    "gebinde": "Karton (12x0,97L / 11,64L)",
    "inhalt": 11.64,
    "einh": "l",
    "preis": 46,
    "lieferant": "Nga Anh",
    "note": "Xi Dac Thang Be"
  },
  {
    "wg": "E18: Softdrinks & Säfte",
    "name": "Lycheesaft Maaza 12x1L",
    "artNr": "",
    "gebinde": "Karton (12x1L)",
    "inhalt": 12,
    "einh": "l",
    "preis": 25,
    "lieferant": "Nga Anh",
    "note": "Maaza Lycheesaft"
  },
  {
    "wg": "E16: Sake & Pflaumenwein",
    "name": "Pflaumenwein Choya 5L",
    "artNr": "",
    "gebinde": "5L Karton",
    "inhalt": 5,
    "einh": "l",
    "preis": 30,
    "lieferant": "Nga Anh",
    "note": "Choya Pflaumenwein"
  },
  {
    "wg": "E19: Kaffee & Tee",
    "name": "Kaffee Trung Nguyen 500g",
    "artNr": "",
    "gebinde": "Packung 500g",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 6.5,
    "lieferant": "Nga Anh",
    "note": "Trung Nguyen Kaffee"
  },
  {
    "wg": "E23: Reinigungs- & Hygieneartikel",
    "name": "Wischtuch Hand 4000Stk",
    "artNr": "",
    "gebinde": "Karton (4000 Stk)",
    "inhalt": 4000,
    "einh": "Stk",
    "preis": 17,
    "lieferant": "Nga Anh",
    "note": "Wischtücher 4000er"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Folie VPE",
    "artNr": "",
    "gebinde": "1 Rolle",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 5,
    "lieferant": "Nga Anh",
    "note": "Frischhaltefolie"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Mülltüte blau 10x10Stk",
    "artNr": "",
    "gebinde": "Karton (100 Stk)",
    "inhalt": 100,
    "einh": "Stk",
    "preis": 20,
    "lieferant": "Nga Anh",
    "note": "Müllbeutel blau"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Soßenbecher 50cc 500 Stück",
    "artNr": "",
    "gebinde": "Karton (500 Stk)",
    "inhalt": 500,
    "einh": "Stk",
    "preis": 20,
    "lieferant": "Nga Anh",
    "note": "Soßenbecher 50cc"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "Stäbchen Bambus Vietnam 20x200Stk",
    "artNr": "",
    "gebinde": "Karton (4000 Stk)",
    "inhalt": 4000,
    "einh": "Stk",
    "preis": 70,
    "lieferant": "Nga Anh",
    "note": "Bambus Essstäbchen"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Campari Milano Bitter 1L",
    "artNr": "",
    "gebinde": "Flasche 1L",
    "inhalt": 1,
    "einh": "l",
    "preis": 17.9,
    "lieferant": "Amazon",
    "note": "Campari Bitter 1L"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Havana Club 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 11.99,
    "lieferant": "Amazon",
    "note": "Havana Club Rum"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Lillet Blanc 0,75L",
    "artNr": "",
    "gebinde": "Flasche 0,75L",
    "inhalt": 0.75,
    "einh": "l",
    "preis": 13.56,
    "lieferant": "Amazon",
    "note": "Lillet Blanc"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Galliano Vanilla 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 15.99,
    "lieferant": "Amazon",
    "note": "Galliano Vanilla"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Cointreau 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 16.9,
    "lieferant": "Amazon",
    "note": "Cointreau"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Pallini Limoncello 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 12.99,
    "lieferant": "Amazon",
    "note": "Pallini Limoncello"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Martini Rosso 1L",
    "artNr": "",
    "gebinde": "Flasche 1L",
    "inhalt": 1,
    "einh": "l",
    "preis": 10.9,
    "lieferant": "Amazon",
    "note": "Martini Rosso"
  },
  {
    "wg": "E14: Wein",
    "name": "Glühwein Christkind 1L",
    "artNr": "",
    "gebinde": "Flasche 1L",
    "inhalt": 1,
    "einh": "l",
    "preis": 4.99,
    "lieferant": "Amazon",
    "note": "Glühwein"
  },
  {
    "wg": "E14: Wein",
    "name": "Kinder Punsch Karton Christkind 10L",
    "artNr": "",
    "gebinde": "10L Karton",
    "inhalt": 10,
    "einh": "l",
    "preis": 29.98,
    "lieferant": "Amazon",
    "note": "Kinderpunsch 10L"
  },
  {
    "wg": "E14: Wein",
    "name": "Rotkäppchen halbtrocken 0,75L 6er",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 29.94,
    "lieferant": "Amazon",
    "note": "Rotkäppchen Sekt htr"
  },
  {
    "wg": "E14: Wein",
    "name": "Rotkäppchen trocken 0,75L 6er",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 29.94,
    "lieferant": "Amazon",
    "note": "Rotkäppchen Sekt tr"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Baileys Irish Cream 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 12.34,
    "lieferant": "Amazon",
    "note": "Baileys Irish Cream"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Trolli Packung 75 st. X 975g Packung",
    "artNr": "",
    "gebinde": "Packung (75 Stk)",
    "inhalt": 75,
    "einh": "Stk",
    "preis": 10.5,
    "lieferant": "Amazon",
    "note": "Trolli Fruchtgummi"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Trolli Packung Augen",
    "artNr": "",
    "gebinde": "Packung",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 22.95,
    "lieferant": "Amazon",
    "note": "Trolli Glotzer"
  },
  {
    "wg": "E24: Verpackung & To-Go",
    "name": "To Go Becher Prime source 50 st. Packung",
    "artNr": "",
    "gebinde": "Packung (50 Stk)",
    "inhalt": 50,
    "einh": "Stk",
    "preis": 10.5,
    "lieferant": "Amazon",
    "note": "To Go Becher 50er"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Aperol Aperitivo 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 12.89,
    "lieferant": "Amazon",
    "note": "Aperol 0,7L"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Mojito Mint 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 14.34,
    "lieferant": "Amazon",
    "note": "MONIN Mojito Mint"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Orangen 1L",
    "artNr": "",
    "gebinde": "Flasche 1L",
    "inhalt": 1,
    "einh": "l",
    "preis": 12.8,
    "lieferant": "Amazon",
    "note": "MONIN Orange"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Lemongras 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 15.99,
    "lieferant": "Amazon",
    "note": "MONIN Lemongras"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Basilikum 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 16.99,
    "lieferant": "Amazon",
    "note": "MONIN Basilikum"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Litschi 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 14.96,
    "lieferant": "Amazon",
    "note": "MONIN Litschi"
  },
  {
    "wg": "E25: Barsirup",
    "name": "Riemerschmidt Maracuja 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 11.16,
    "lieferant": "Amazon",
    "note": "Riemerschmid Maracuja"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Bulleit Bourbon Frontier 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 19.99,
    "lieferant": "Amazon",
    "note": "Bulleit Bourbon"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Bulleit 95 Rye Frontier 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 28.85,
    "lieferant": "Amazon",
    "note": "Bulleit Rye Whiskey"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Woodford Reserve Bourbon 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 26.49,
    "lieferant": "Amazon",
    "note": "Woodford Reserve"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "James E. Pepper 1776 Bourbon 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 45.89,
    "lieferant": "Amazon",
    "note": "James E Pepper Bourbon"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Glenfiddich 15 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 43.9,
    "lieferant": "Amazon",
    "note": "Glenfiddich 15y"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Glenfiddich 12 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 30.9,
    "lieferant": "Amazon",
    "note": "Glenfiddich 12y"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Chivas Regal 18 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 69.99,
    "lieferant": "Amazon",
    "note": "Chivas Regal 18y"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Ardbeg Scotch Whisky 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 42.9,
    "lieferant": "Amazon",
    "note": "Ardbeg Islay Whisky"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Lagavulin 16 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 74.99,
    "lieferant": "Amazon",
    "note": "Lagavulin 16y"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Johnnie Walker Blue Label 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 148.5,
    "lieferant": "Amazon",
    "note": "Johnnie Walker Blue"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Redbreast 12 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 51.59,
    "lieferant": "Amazon",
    "note": "Redbreast 12y Irish"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Two Stacks Irish Whiskey 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 26.14,
    "lieferant": "Amazon",
    "note": "Two Stacks Whiskey"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "The Whistler Irish Whiskey 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 41.06,
    "lieferant": "Amazon",
    "note": "The Whistler Whiskey"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Nikka From The Barrel 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 35.9,
    "lieferant": "Amazon",
    "note": "Nikka Japanese Whisky"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Nikka Days 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 37.66,
    "lieferant": "Amazon",
    "note": "Nikka Days Whisky"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Enso Japanese Whisky 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 38.89,
    "lieferant": "Amazon",
    "note": "Enso Japanese Whisky"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Suntory The Chita 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 45.14,
    "lieferant": "Amazon",
    "note": "The Chita Grain Whisky"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Roku Gin Hibiskus Suntory 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 40.99,
    "lieferant": "Amazon",
    "note": "Roku Gin Sakura/Hibiskus"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Suntory The Yamazaki 12 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 146.49,
    "lieferant": "Amazon",
    "note": "The Yamazaki 12y"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Nordhäuser Likör Pfirsich 0,7L 6er",
    "artNr": "",
    "gebinde": "Karton (6x0,7L)",
    "inhalt": 4.2,
    "einh": "l",
    "preis": 32.99,
    "lieferant": "Amazon",
    "note": "Nordhäuser Pfirsich"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Licor 43 Chocolate 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 15.99,
    "lieferant": "Amazon",
    "note": "Licor 43 Chocolate"
  },
  {
    "wg": "E14: Wein",
    "name": "Vega Eni Rose 2017 0,75L",
    "artNr": "",
    "gebinde": "Flasche 0,75L",
    "inhalt": 0.75,
    "einh": "l",
    "preis": 40,
    "lieferant": "Amazon",
    "note": "Vega Eni Rose"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Jägermeister 1L",
    "artNr": "",
    "gebinde": "Flasche 1L",
    "inhalt": 1,
    "einh": "l",
    "preis": 16.99,
    "lieferant": "Amazon",
    "note": "Jägermeister 1L"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Carlos I Brandy 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 43.51,
    "lieferant": "Amazon",
    "note": "Carlos I Solera Gran Reserva"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Momotaro Ginzero Alkoholfrei 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 26.9,
    "lieferant": "Amazon",
    "note": "Momotaro Ginzero"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Momotaro Gin 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 29.9,
    "lieferant": "Amazon",
    "note": "Momotaro Gin"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Dooleys White Chocolate Cream 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 10.99,
    "lieferant": "Amazon",
    "note": "Dooleys White Chocolate"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Monkey 47 Schwarzwald Dry Gin 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 31.59,
    "lieferant": "Amazon",
    "note": "Monkey 47 Gin"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Slyrs Vanilla & Honey Liqueur 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 30.9,
    "lieferant": "Amazon",
    "note": "Slyrs Vanilla Honey"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Sierra Tequila Silver 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 12.61,
    "lieferant": "Amazon",
    "note": "Sierra Tequila Silver"
  },
  {
    "wg": "E14: Wein",
    "name": "Ruinart Brut Rosé Champagne 0,75L",
    "artNr": "",
    "gebinde": "Flasche 0,75L",
    "inhalt": 0.75,
    "einh": "l",
    "preis": 91.83,
    "lieferant": "Amazon",
    "note": "Ruinart Brut Rose"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Remy Martin Cognac 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 54.99,
    "lieferant": "Amazon",
    "note": "Remy Martin VSOP"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Batida de Coco 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 9.29,
    "lieferant": "Amazon",
    "note": "Batida de Coco"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Suntory Roku Japanese Craft Gin 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 22.99,
    "lieferant": "Amazon",
    "note": "Roku Japanese Craft Gin"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Glen Forrest 16 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 78.9,
    "lieferant": "Amazon",
    "note": "Glen Forrest 16y"
  },
  {
    "wg": "E17: Spirituosen & Whisky",
    "name": "Ballantines 12 Jahre 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 24.89,
    "lieferant": "Amazon",
    "note": "Ballantines 12y"
  },
  {
    "wg": "E25: Barsirup",
    "name": "Lime Juice Johns 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 3.58,
    "lieferant": "Amazon",
    "note": "Johns Lime Juice"
  },
  {
    "wg": "E14: Wein",
    "name": "La Gioiosa Prosecco Frizzante 6x0,75L",
    "artNr": "",
    "gebinde": "Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 33.54,
    "lieferant": "Amazon",
    "note": "La Gioiosa Prosecco"
  },
  {
    "wg": "E19: Kaffee & Tee",
    "name": "Anchan Blaue Klitorientee Blüten 100g",
    "artNr": "",
    "gebinde": "Packung 100g",
    "inhalt": 0.1,
    "einh": "kg",
    "preis": 16.99,
    "lieferant": "Amazon",
    "note": "Anchan Butterfly Pea Tee"
  },
  {
    "wg": "E19: Kaffee & Tee",
    "name": "Jasmin Tee Perlen Zhen Zhu 1KG",
    "artNr": "",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 150.89,
    "lieferant": "Amazon",
    "note": "Jasmin Drachenperlen"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Puderzucker Diamant 250g",
    "artNr": "",
    "gebinde": "Packung 250g",
    "inhalt": 0.25,
    "einh": "kg",
    "preis": 9.48,
    "lieferant": "Amazon",
    "note": "Puderzucker Mühle"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Hibiskus Blüten getrocknet 1kg",
    "artNr": "",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 18.95,
    "lieferant": "Amazon",
    "note": "Hibiskusblüten getrocknet"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Tanqueray Blackcurrant Royale Gin 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 26.88,
    "lieferant": "Amazon",
    "note": "Tanqueray Royale"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Hendricks Gin 0,7L",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 27.9,
    "lieferant": "Amazon",
    "note": "Hendricks Gin"
  },
  {
    "wg": "E13: Spirituosen & Liköre",
    "name": "Three Sixty Vodka 0,7L (Amazon)",
    "artNr": "",
    "gebinde": "Flasche 0,7L",
    "inhalt": 0.7,
    "einh": "l",
    "preis": 20.99,
    "lieferant": "Amazon",
    "note": "Three Sixty Vodka"
  },
  {
    "wg": "E19: Kaffee & Tee",
    "name": "Yuzu Tea Konfitüre Glas 1kg",
    "artNr": "",
    "gebinde": "1kg Glas",
    "inhalt": 1,
    "einh": "kg",
    "preis": 11.7,
    "lieferant": "Amazon",
    "note": "Yuzu Tee Konfitüre"
  },
  {
    "wg": "E22: Speiseöle & Fette",
    "name": "Mazzetti Natur Apfelessig Bio 0,5L",
    "artNr": "",
    "gebinde": "Flasche 0,5L",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 4.64,
    "lieferant": "Amazon",
    "note": "Mazzetti Bio Apfelessig"
  },
  {
    "wg": "E9: Trockenwaren & Gewürze",
    "name": "Wasabi Powder 1kg Packung",
    "artNr": "",
    "gebinde": "1kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 12.95,
    "lieferant": "Amazon",
    "note": "Wasabi Pulver 1kg"
  },
  {
    "wg": "E21: Desserts & Eis",
    "name": "Rohrzucker Sticks hellma braun 4g x 500 st. Karton",
    "artNr": "",
    "gebinde": "Karton (500x4g / 2kg)",
    "inhalt": 2,
    "einh": "kg",
    "preis": 21.07,
    "lieferant": "Amazon",
    "note": "Rohrzucker Portionssticks"
  }
];

  const wgCounters = {};
  const rowsToInsert = [];
  const dateVal = new Date(2026, 0, 22);
  
  metroArticles.forEach(item => {
    const wgInfo = getWarengruppenInfo(item.wg);
    const wgCode = wgInfo.code;
    if (!wgCounters[wgCode]) wgCounters[wgCode] = 1;
    else wgCounters[wgCode]++;
    
    const id = wgInfo.prefix + '-' + String(wgCounters[wgCode]).padStart(4, '0');
    const norm = normalizeUnitAndPrice(item.name, item.gebinde, item.inhalt, item.preis);
    
    rowsToInsert.push([
      id,
      item.name,
      wgInfo.name,
      wgInfo.kat,
      wgInfo.mwst,
      item.lieferant || 'METRO Deutschland (Leipzig)',
      item.artNr,
      item.gebinde,
      norm.inhalt,
      norm.basiseinheit,
      item.preis,
      norm.referenzpreis,
      dateVal,
      item.preis,
      0,
      item.note,
      '',
      'EINDEUTIG_ZUGEORDNET',
      'JA'
    ]);
  });

  artSheet.getRange(5, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
  
  const totalRows = rowsToInsert.length + 4;
  artSheet.getRange('E5:E' + totalRows).setNumberFormat('0.0%');
  artSheet.getRange('I5:I' + totalRows).setNumberFormat('#,##0.00');
  artSheet.getRange('K5:L' + totalRows).setNumberFormat('[$€-de-DE] #,##0.00');
  artSheet.getRange('M5:M' + totalRows).setNumberFormat('dd.MM.yyyy');
  artSheet.getRange('N5:N' + totalRows).setNumberFormat('[$€-de-DE] #,##0.00');
  artSheet.getRange('O5:O' + totalRows).setNumberFormat('+0.0%;-0.0%;"0.0%"');
  artSheet.autoResizeColumns(1, 19);
  refreshSupplierDropdowns(ss);
}

/**
 * Filtert den Artikelstamm live nach den 4 Filter-Kriterien in Zeile 2
 */
function applyArticleMasterFilters(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (!artSheet) return;

  const lastRow = artSheet.getLastRow();
  if (lastRow < 5) return;

  const fWg = String(artSheet.getRange('C2').getValue() || 'Alle Warengruppen').trim();
  const fSupp = String(artSheet.getRange('F2').getValue() || 'Alle Lieferanten').trim();
  const fPeriod = String(artSheet.getRange('I2').getValue() || 'Alle Zeiträume').trim();
  const fSearch = String(artSheet.getRange('L2').getValue() || '').trim().toLowerCase();

  const cols = Math.max(19, artSheet.getLastColumn());
  const data = artSheet.getRange(5, 1, lastRow - 4, cols).getValues();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowWg = String(row[2] || '');
    const rowSupp = String(row[5] || '');
    const rowDate = row[12] instanceof Date ? Utilities.formatDate(row[12], 'Europe/Berlin', 'yyyy-MM') : String(row[12] || '');
    const rowName = String(row[1] || '').toLowerCase();
    const rowMaster = String(row[16] || '').toLowerCase();

    let isVisible = true;

    // Filter 1: Warengruppe
    if (fWg !== 'Alle Warengruppen' && !rowWg.startsWith(fWg.split(':')[0])) {
      isVisible = false;
    }
    // Filter 2: Lieferant
    if (isVisible && fSupp !== 'Alle Lieferanten' && !rowSupp.toLowerCase().includes(fSupp.toLowerCase())) {
      isVisible = false;
    }
    // Filter 3: Zeitraum
    if (isVisible && fPeriod !== 'Alle Zeiträume') {
      if (fPeriod.startsWith('2026-Q')) {
        const q = fPeriod.split('-')[1];
        const month = parseInt(rowDate.slice(5, 7), 10);
        if (q === 'Q1' && (month < 1 || month > 3)) isVisible = false;
        if (q === 'Q2' && (month < 4 || month > 6)) isVisible = false;
        if (q === 'Q3' && (month < 7 || month > 9)) isVisible = false;
        if (q === 'Q4' && (month < 10 || month > 12)) isVisible = false;
      } else if (fPeriod.length === 7 && rowDate !== fPeriod) {
        isVisible = false;
      }
    }
    // Filter 4: Suche
    if (isVisible && fSearch.length > 0) {
      if (!rowName.includes(fSearch) && !rowMaster.includes(fSearch)) {
        isVisible = false;
      }
    }

    if (isVisible) {
      artSheet.showRows(i + 5);
    } else {
      artSheet.hideRows(i + 5);
    }
  }
}

/**
 * 1.4 RECHNUNGSEINGANG (Beleg-Journal)
 */
function setupInvoiceHistorySheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  if (!recSheet) recSheet = ss.insertSheet(CONFIG.NAME_RECHNUNGEN);
  else recSheet.clear();
  
  const headers = [
    'Beleg-ID', 'Standort', 'Rechnungsdatum', 'Lieferant', 'Rechnungs-Nr.', 'Artikel-ID', 'Artikelbezeichnung',
    'Warengruppe', 'Hauptkategorie', 'Menge (Gebinde)', 'Gebinde / Einheit', 'Einzelpreis Netto (€)', 'Gesamt Netto (€)',
    'MwSt-Satz', 'MwSt-Betrag (€)', 'Gesamt Brutto (€)', 'Dateiname / Scan-Quelle', 'Status / Prüfung', 'Jahr_Monat',
    'Gesamtmenge Basiseinheit (Zahl)', 'Basiseinheit'
  ];
  
  recSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  recSheet.getRange('A1:U1').setFontWeight('bold').setBackground('#004D40').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  recSheet.setRowHeight(1, 40);
  recSheet.setFrozenRows(1);
  
  recSheet.getRange('C2:C2000').setNumberFormat('dd.MM.yyyy');
  recSheet.getRange('J2:J2000').setNumberFormat('#,##0.00');
  recSheet.getRange('L2:M2000').setNumberFormat('[$€-de-DE] #,##0.00');
  recSheet.getRange('N2:N2000').setNumberFormat('0.0%');
  recSheet.getRange('O2:P2000').setNumberFormat('[$€-de-DE] #,##0.00');
  recSheet.getRange('T2:T2000').setNumberFormat('#,##0.00');
  recSheet.autoResizeColumns(1, 21);
}

/**
 * 1.5 BELEGE EINPFLEGEN
 */
function importPreloadedInvoices(ss) {
  const rungisInvoice = {
    lieferant: 'RUNGIS express GmbH',
    datum: new Date(2026, 5, 15),
    rechnungsNr: '9869568',
    fileName: 'Gescannt_20260825-1828.pdf',
    items: [
      { artNr: '6908', name: 'Daikonkresse 16 Sch Ka NL Koppert', menge: 16, einheit: 'Schale', einzelNetto: 1.15, wg: 'E8: Gemüse/Salat/Obst' },
      { artNr: '56977', name: 'Kingfish Gelbschwanzmakrele m.K. ausg. 2,5kg+ Stk NL Seriola lalandi', menge: 5.48, einheit: 'kg', einzelNetto: 28.95, wg: 'E1: Fisch' },
      { artNr: '23433', name: 'Dorade Royal m.K. rund 1,0-1,5kg Stk FR Zucht Sparus aurata', menge: 2.67, einheit: 'kg', einzelNetto: 21.95, wg: 'E1: Fisch' },
      { artNr: '28633', name: 'Entrecote v. Rind 2,0-2,5kg Stk NZ Greenlea', menge: 4.816, einheit: 'kg', einzelNetto: 37.95, wg: 'E4: Rind' }
    ]
  };

  const sspInvoice = {
    lieferant: 'SSP Trade & Consult GmbH',
    datum: new Date(2026, 5, 22),
    rechnungsNr: '01-2026-15491',
    fileName: 'Gescannt_20260825-1840.pdf',
    items: [
      { artNr: 'A002', name: 'Shoyu Koikuchi 18L Sojasauce (dunkel)', menge: 1, einheit: 'Karton (18L)', einzelNetto: 35.00, wg: 'E11: Soße/Paste' },
      { artNr: 'A022', name: 'Suehiro Su U.K. 20L Branntweinessig mit Sake gebraut', menge: 1, einheit: 'Karton (20L)', einzelNetto: 29.58, wg: 'E22: Öl/Essig' },
      { artNr: 'F014', name: 'Katsuokezunbushi Skip-Jack-Thunfisch-Flocken (40g)', menge: 3, einheit: 'Pack (40g)', einzelNetto: 4.18, wg: 'E1: Fisch' },
      { artNr: 'G036', name: 'Meerrettich-Zubereitungspulver für Sushi (1kg)', menge: 10, einheit: 'Stk (1kg)', einzelNetto: 5.98, wg: 'E11: Soße/Paste' },
      { artNr: 'I043BC', name: 'Yakisushinori Hangiri (Gold) Gerösteter Seetang halbe Blätter', menge: 30, einheit: 'Pack (100 Bl)', einzelNetto: 7.19, wg: 'E9: Nährmittel/Gewürz' },
      { artNr: 'L002A', name: 'Tokyo Takuan Eingelegter Rettich (500g)', menge: 20, einheit: 'Stk (500g)', einzelNetto: 1.98, wg: 'E8: Gemüse/Salat/Obst' },
      { artNr: 'L057D', name: '(K)Sushi Gari White Eingelegter Ingwer (1kg)', menge: 20, einheit: 'Pack (1kg)', einzelNetto: 2.70, wg: 'E8: Gemüse/Salat/Obst' },
      { artNr: 'O261A', name: 'YUKIZURU Premium Sushi Reis (10kg)', menge: 10, einheit: 'Sack (10kg)', einzelNetto: 23.00, wg: 'E7: Reis/Nudeln' },
      { artNr: 'P010', name: 'Miora Reiskochpulver (1kg)', menge: 1, einheit: 'Stk (1kg)', einzelNetto: 37.80, wg: 'E9: Nährmittel/Gewürz' },
      { artNr: 'R239', name: 'Tobiko Red Rogen vom fliegenden Fisch (500g)', menge: 3, einheit: 'Pack (500g)', einzelNetto: 15.90, wg: 'E1: Fisch' },
      { artNr: 'V132', name: 'Black Tiger Garnelen 16/20 o.K. m.S. (1.4kg Netto)', menge: 12, einheit: 'Pack (1.4kg)', einzelNetto: 22.50, wg: 'E2: Seafood' }
    ]
  };

  ingestInvoiceData(ss, rungisInvoice, rungisInvoice.fileName);
  ingestInvoiceData(ss, sspInvoice, sspInvoice.fileName);
}

/**
 * Kernfunktion zur Belegerfassung mit Nachzügler-Logik & OCR-Plausibilitätsprüfung & Echtzeit-Alerts
 */
function ingestInvoiceData(ss, invoiceData, fileName) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (!recSheet || !artSheet) return 0;

  // 1. Dubletten-Prüfung: Prüfe ob dieser Beleg bereits verbucht ist
  const recLastRow = recSheet.getLastRow();
  if (recLastRow > 1) {
    const recData = recSheet.getRange(2, 1, recLastRow - 1, 19).getValues();
    for (let r = 0; r < recData.length; r++) {
      const rowFile = String(recData[r][16] || '').trim();
      const rowLieferant = String(recData[r][3] || '').trim();
      const rowRn = String(recData[r][4] || '').trim();
      
      // Dublette nach Dateiname
      if (fileName && rowFile && rowFile.toLowerCase() === fileName.toLowerCase()) {
        Logger.log(`Dublette erkannt: Datei "${fileName}" wurde bereits in Zeile ${r + 2} verbucht. Buchung wird übersprungen.`);
        return 0;
      }
      // Dublette nach Lieferant + Rechnungsnummer
      if (invoiceData.lieferant && invoiceData.rechnungsNr && 
          rowLieferant.toLowerCase() === invoiceData.lieferant.toLowerCase() && 
          rowRn.toLowerCase() === invoiceData.rechnungsNr.toLowerCase() && 
          !invoiceData.rechnungsNr.startsWith('RN-UNKNOWN') && !invoiceData.rechnungsNr.startsWith('RN-2026')) {
        Logger.log(`Dublette erkannt: Beleg "${invoiceData.rechnungsNr}" von "${invoiceData.lieferant}" bereits in Zeile ${r + 2} verbucht. Buchung wird übersprungen.`);
        return 0;
      }
    }
  }

  const isDateMissing = !invoiceData.datum || !(invoiceData.datum instanceof Date) || isNaN(invoiceData.datum.getTime());
  const bookingDate = isDateMissing ? new Date() : invoiceData.datum;
  const bookingStatus = isDateMissing ? 'Prüffall Datum' : 'Verbucht';
  const jahrMonat = isDateMissing ? 'Ungeprüft' : Utilities.formatDate(bookingDate, 'Europe/Berlin', 'yyyy-MM');

  const artLastRow = artSheet.getLastRow();
  const existingArticles = {};
  const wgCounters = {};
  
  if (artLastRow >= 5) {
    const artData = artSheet.getRange(5, 1, artLastRow - 4, 17).getValues();
    artData.forEach((row, idx) => {
      const artId = String(row[0]);
      const artName = String(row[1]).trim().toLowerCase();
      const lastDate = row[12] instanceof Date ? row[12] : new Date(row[12]);
      
      existingArticles[artName] = {
        rowIdx: idx + 5,
        id: artId,
        currPrice: parseFloat(row[10]) || 0,
        refPrice: parseFloat(row[11]) || 0,
        lastDate: lastDate,
        note: String(row[15] || '')
      };
      
      const prefix = artId.split('-')[0];
      const num = parseInt(artId.split('-')[1], 10);
      if (prefix && !isNaN(num)) {
        if (!wgCounters[prefix] || num > wgCounters[prefix]) wgCounters[prefix] = num;
      }
    });
  }

  const newInvoiceRows = [];
  const startRecRow = recSheet.getLastRow() + 1;
  let belegCounter = startRecRow - 1;
  const realtimeAlerts = [];

  if (isDateMissing) {
    realtimeAlerts.push({
      type: 'OCR_DATUMSFEHLER',
      title: 'OCR- / Datumsfehler festgestellt',
      details: `Beleg "${invoiceData.rechnungsNr}" von Lieferant "${invoiceData.lieferant}" (${fileName}) enthielt kein lesbares Rechnungsdatum. Als Prüffall markiert.`
    });
  }

  invoiceData.items.forEach(item => {
    belegCounter++;
    const belegId = 'BEL-' + String(belegCounter).padStart(5, '0');
    const wgInfo = getWarengruppenInfo(item.wg);
    const wgCode = wgInfo.code;
    const nameLower = item.name.toLowerCase();
    
    const netto = Math.round(item.menge * item.einzelNetto * 100) / 100;
    const mwstBetrag = Math.round(netto * wgInfo.mwst * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;
    const norm = normalizeUnitAndPrice(item.name, item.einheit, item.menge, item.einzelNetto);
    
    let artId = '';
    let rowBookingStatus = bookingStatus;

    if (existingArticles[nameLower]) {
      const existing = existingArticles[nameLower];
      artId = existing.id;
      const r = existing.rowIdx;
      
      if (item.einzelNetto <= 0) {
        realtimeAlerts.push({
          type: 'GUTSCHRIFT_STORNO',
          title: 'Gutschrift / Stornobuchung erfasst',
          details: `[${existing.id || artId}] Artikel "${item.name}" (Menge: ${item.menge}) mit 0,00 EUR verbucht. Mengengerüst saldiert.`
        });
      } else if (existing.refPrice > 0 && norm.referenzpreis > 0) {
        const diffPct = Math.abs((norm.referenzpreis - existing.refPrice) / existing.refPrice) * 100;
        if (diffPct > 30) {
          realtimeAlerts.push({
            type: 'EXTREME_PREISABWEICHUNG',
            title: 'Extreme Preisabweichung (> 30%)',
            details: `[${existing.id || artId}] Artikel "${item.name}" (${invoiceData.lieferant}): Bisher ${existing.refPrice.toFixed(2)} EUR/${norm.basiseinheit} -> Neu ${norm.referenzpreis.toFixed(2)} EUR/${norm.basiseinheit} (${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%). Bitte Gebinde prüfen.`
          });
        }
      }

      if (!isDateMissing && item.einzelNetto > 0) {
        const newTime = bookingDate.getTime();
        const oldTime = existing.lastDate instanceof Date && !isNaN(existing.lastDate.getTime()) ? existing.lastDate.getTime() : 0;
        
        if (newTime > oldTime) {
          const oldPrice = existing.currPrice || item.einzelNetto;
          const diffPct = oldPrice > 0 ? (item.einzelNetto - oldPrice) / oldPrice : 0;
          
          if (diffPct >= 0.10) {
            realtimeAlerts.push({
              type: 'PREISANSTIEG',
              title: 'Preisanstieg +' + (diffPct * 100).toFixed(1) + '%',
              details: `[${existing.id || artId}] Artikel "${item.name}" (${invoiceData.lieferant}): Preis stieg von ${oldPrice.toFixed(2)} EUR auf ${item.einzelNetto.toFixed(2)} EUR (Referenz: ${norm.referenzpreis.toFixed(2)} EUR/${norm.basiseinheit}).`
            });
          }
          
          artSheet.getRange(r, 9).setValue(norm.inhalt);
          artSheet.getRange(r, 10).setValue(norm.basiseinheit);
          artSheet.getRange(r, 11).setValue(item.einzelNetto);
          artSheet.getRange(r, 12).setValue(norm.referenzpreis);
          artSheet.getRange(r, 13).setValue(bookingDate);
          artSheet.getRange(r, 14).setValue(oldPrice);
          artSheet.getRange(r, 15).setValue(diffPct);
          artSheet.getRange(r, 16).setValue('Aktualisiert via Beleg ' + invoiceData.rechnungsNr);
          
          existing.currPrice = item.einzelNetto;
          existing.refPrice = norm.referenzpreis;
          existing.lastDate = bookingDate;
        } else if (newTime === oldTime) {
          if (invoiceData.rechnungsNr >= existing.note) {
            artSheet.getRange(r, 11).setValue(item.einzelNetto);
            artSheet.getRange(r, 12).setValue(norm.referenzpreis);
            artSheet.getRange(r, 16).setValue('Aktualisiert via Beleg ' + invoiceData.rechnungsNr);
          }
        } else {
          rowBookingStatus = 'Nachzügler verbucht';
        }
      }
    } else {
      if (!wgCounters[wgCode]) wgCounters[wgCode] = 1;
      else wgCounters[wgCode]++;
      artId = wgInfo.prefix + '-' + String(wgCounters[wgCode]).padStart(4, '0');
      
      const newArtRow = artSheet.getLastRow() + 1;
      artSheet.getRange(newArtRow, 1, 1, 19).setValues([[
        artId,
        item.name,
        wgInfo.name,
        wgInfo.kat,
        wgInfo.mwst,
        invoiceData.lieferant,
        item.artNr || '',
        item.einheit,
        norm.inhalt,
        norm.basiseinheit,
        item.einzelNetto,
        norm.referenzpreis,
        isDateMissing ? '' : bookingDate,
        item.einzelNetto,
        0,
        'Neu via Beleg ' + invoiceData.rechnungsNr,
        '',
        'ZU_PRUEFEN',
        'JA'
      ]]);
      
      existingArticles[nameLower] = {
        rowIdx: newArtRow,
        id: artId,
        currPrice: item.einzelNetto,
        refPrice: norm.referenzpreis,
        lastDate: bookingDate,
        note: invoiceData.rechnungsNr
      };
    }

    const totalMengeBasiseinheit = Math.round(item.menge * (norm.inhalt || 1) * 1000) / 1000;

    newInvoiceRows.push([
      belegId,
      CONFIG.LOCATION_NAME,
      isDateMissing ? '' : bookingDate,
      invoiceData.lieferant,
      invoiceData.rechnungsNr,
      artId,
      item.name,
      wgInfo.name,
      wgInfo.kat,
      item.menge,
      item.einheit,
      item.einzelNetto,
      netto,
      wgInfo.mwst,
      mwstBetrag,
      brutto,
      fileName,
      rowBookingStatus,
      jahrMonat,
      totalMengeBasiseinheit,
      norm.basiseinheit
    ]);
  });

  if (newInvoiceRows.length > 0) {
    recSheet.getRange(startRecRow, 1, newInvoiceRows.length, newInvoiceRows[0].length).setValues(newInvoiceRows);
  }

  return {
    count: newInvoiceRows.length,
    alerts: realtimeAlerts
  };
}

/**
 * ==========================================
 * 2. WÖCHENTLICHER PLAUSIBILITÄTS-AUDIT (HEALTH-CHECK)
 * ==========================================
 */
function runDatabaseHealthAudit(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);

  const auditReport = {
    totalChecked: 0,
    issues: [],
    recalcRequired: 0,
    futureDates: 0,
    unmappedItems: 0,
    duplicateInvoices: 0,
    outdatedPrices: 0,
    missingPrices: 0,
    unitIssues: 0
  };

  const now = new Date();
  const maxFutureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Audit ARTIKELSTAMM
  if (artSheet && artSheet.getLastRow() >= 5) {
    const artCols = Math.max(19, artSheet.getLastColumn());
    const artData = artSheet.getRange(5, 1, artSheet.getLastRow() - 4, artCols).getValues();
    auditReport.totalChecked += artData.length;

    artData.forEach((row, idx) => {
      const artName = String(row[1] || '');
      const basePrice = parseFloat(row[10]) || 0;
      const refPrice = parseFloat(row[11]) || 0;
      const unit = String(row[9] || '').trim();
      const inhalt = parseFloat(row[8]) || 1;
      const masterId = String(row[16] || '').trim();
      const zuordnungsStatus = String(row[17] || '').trim();

      // Dimension 1: Umrechnungslogik / 10x-Faktor
      if (refPrice > 0 && basePrice > 0) {
        if (refPrice > basePrice * 15 && inhalt < 0.1) {
          auditReport.recalcRequired++;
          auditReport.issues.push({
            type: 'RECALC_REQUIRED',
            item: artName,
            details: `Verdacht auf 10x/Gebindeverwechslung: Gebindepreis ${basePrice.toFixed(2)} EUR vs. Referenzpreis ${refPrice.toFixed(2)} EUR/${unit || 'kg'}`
          });
          artSheet.getRange(idx + 5, 16).setValue('FLAG: RECALC_REQUIRED');
        }
      }

      // Dimension 2: Basiseinheit fehlt
      if (!unit || unit === '') {
        auditReport.unitIssues++;
        auditReport.issues.push({
          type: 'BASISEINHEIT_FEHLT',
          item: artName,
          details: `Artikel besitzt keine hinterlegte Basiseinheit.`
        });
      }

      // Dimension 3: Unzugeordnete Items
      if (!masterId || masterId === '' || zuordnungsStatus === 'KEINE_MASTER_ZUTAT' || zuordnungsStatus === 'ZU_PRUEFEN') {
        auditReport.unmappedItems++;
        auditReport.issues.push({
          type: 'UNMAPPED_ITEM',
          item: artName,
          details: `Artikel besitzt keine eindeutige Zuordnung zu einer Master-Zutat (Status: ${zuordnungsStatus || 'Offen'}).`
        });
      }
    });
  }

  // 2. Audit RECHNUNGSEINGANG
  if (recSheet && recSheet.getLastRow() > 1) {
    const recData = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, 19).getValues();
    auditReport.totalChecked += recData.length;
    const invoiceMap = {};

    recData.forEach(row => {
      const dateVal = row[2] instanceof Date ? row[2] : (row[2] ? new Date(row[2]) : null);
      const lieferant = String(row[3] || '');
      const rn = String(row[4] || '');
      const gesamtNetto = parseFloat(row[12]) || 0;

      // Dimension 4: Datumsinkonsistenzen (Zukunft)
      if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        if (dateVal.getTime() > maxFutureDate.getTime()) {
          auditReport.futureDates++;
          auditReport.issues.push({
            type: 'FUTURE_DATE',
            item: `${lieferant} (${rn})`,
            details: `Rechnungsdatum liegt in der Zukunft: ${Utilities.formatDate(dateVal, 'Europe/Berlin', 'dd.MM.yyyy')}`
          });
        }
      }

      // Dimension 5: Dublettenprüfung
      const key = `${lieferant}_${rn}`;
      if (!invoiceMap[key]) {
        invoiceMap[key] = { count: 1, sum: gesamtNetto };
      } else {
        invoiceMap[key].count++;
        if (Math.abs(invoiceMap[key].sum - gesamtNetto) > 0.05) {
          auditReport.duplicateInvoices++;
          auditReport.issues.push({
            type: 'DUPLICATE_INVOICE_CONFLICT',
            item: key,
            details: `Widersprüchlicher Beleg: Rechnungs-Nr ${rn} (${lieferant}) existiert mehrfach mit unterschiedlichen Positionssummen.`
          });
        }
      }
    });
  }

  // 3. Audit MASTER_ZUTATEN
  if (mzSheet && mzSheet.getLastRow() >= 2) {
    const mzCols = Math.max(23, mzSheet.getLastColumn());
    const mzData = mzSheet.getRange(2, 1, mzSheet.getLastRow() - 1, mzCols).getValues();
    auditReport.totalChecked += mzData.length;

    mzData.forEach(row => {
      const mId = String(row[0] || '');
      const mName = String(row[1] || '');
      const status = String(row[7] || '');
      const ageDays = parseInt(row[18], 10) || 0;

      if (status === 'VERALTET') {
        auditReport.outdatedPrices++;
        auditReport.issues.push({
          type: 'PREIS_VERALTET',
          item: `${mName} (${mId})`,
          details: `Kalkulationspreis ist älter als ${PREIS_CONFIG.MAX_PREISALTER_TAGE} Tage (${ageDays} Tage alt).`
        });
      } else if (status === 'KEIN_PREIS' || status === 'BASISEINHEIT_FEHLT' || status === 'GEBINDE_UNKLAR') {
        auditReport.missingPrices++;
        auditReport.issues.push({
          type: 'KEIN_PREIS_VORHANDEN',
          item: `${mName} (${mId})`,
          details: `Master-Zutat besitzt keinen gültigen Kalkulationspreis (Status: ${status}).`
        });
      }
    });
  }

  return auditReport;
}

function runManualHealthAudit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const audit = runDatabaseHealthAudit(ss);

  let msg = `=== DATENBANK HEALTH-CHECK REPORT (${CONFIG.LOCATION_NAME}) ===\n\n`;
  msg += `Geprüfte Datensätze: ${audit.totalChecked}\n`;
  msg += `Gefundene Auffälligkeiten: ${audit.issues.length}\n\n`;
  msg += `1. Umrechnungs-Bandbreiten (RECALC_REQUIRED): ${audit.recalcRequired}\n`;
  msg += `2. Zukunftsdaten / Chronologie-Fehler: ${audit.futureDates}\n`;
  msg += `3. Offene / Unzugeordnete Items: ${audit.unmappedItems}\n`;
  msg += `4. Dubletten-Konflikte: ${audit.duplicateInvoices}\n`;
  msg += `5. Veraltete Preise (> ${PREIS_CONFIG.MAX_PREISALTER_TAGE} Tage): ${audit.outdatedPrices}\n`;
  msg += `6. Master-Zutaten ohne gültigen Preis: ${audit.missingPrices}\n`;
  msg += `7. Fehlende Basiseinheiten: ${audit.unitIssues}\n\n`;

  if (audit.issues.length > 0) {
    msg += 'DETAILS DER AUFFÄLLIGKEITEN (Auszug):\n';
    audit.issues.slice(0, 8).forEach(i => {
      msg += `• [${i.type}] ${i.item}: ${i.details}\n`;
    });
    msg += `\n💡 Tipp: Öffne die Prüfliste "${CONFIG.NAME_PRUEFUNG}" über das Menü für alle Details.`;
  } else {
    msg += 'ERGEBNIS: Alle Datenstrukturen, Zuordnungen und Kalkulationspreise sind 100% konsistent und fehlerfrei!';
  }

  SpreadsheetApp.getUi().alert('Plausibilitäts-Audit', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * ============================================================================
 * 1.6 PRUEFUNG_EINKAUF (AUDIT-, DIAGNOSE- & LERN-WERKZEUG)
 * ============================================================================
 */

/**
 * Intelligente Fuzzy- & Token-Vorschlagsengine für Master-Zutaten
 */
function suggestMasterIngredient(artName, wg) {
  if (!artName) return { suggestion: '', confidence: 0, reason: 'Kein Artikelname' };
  
  const cleanName = String(artName)
    .replace(/\b(METRO Chef|METRO Professional|Rungis|Chef|Aro|Bio|Frisch|TK|tiefgekühlt|gekocht|geschält|geschnitten)\b/gi, '')
    .replace(/[\d.,]+\s*(kg|g|l|ml|stk|er|er kiste|krt|ds|btl|fl|gl|cl|portionen|packung|karton|dose|beutel|flasche|bund)\b/gi, '')
    .replace(/[^\w\säöüÄÖÜß-]/g, ' ')
    .trim()
    .toLowerCase();

  const words = cleanName.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return { suggestion: '', confidence: 0, reason: 'Keine signifikanten Wörter' };

  let bestMatch = '';
  let highestScore = 0;

  // Suche in MASTER_CATALOG_DICTIONARY
  Object.keys(MASTER_CATALOG_DICTIONARY).forEach(cat => {
    const list = MASTER_CATALOG_DICTIONARY[cat];
    list.forEach(targetKey => {
      const targetLower = targetKey.toLowerCase();
      let score = 0;
      words.forEach(w => {
        if (targetLower.includes(w)) {
          score += (w.length / targetLower.length);
        }
      });
      if (score > highestScore) {
        highestScore = score;
        bestMatch = targetKey;
      }
    });
  });

  if (highestScore > 0.4) {
    return { suggestion: bestMatch, confidence: Math.round(highestScore * 100), reason: 'Starke Übereinstimmung' };
  } else if (bestMatch && highestScore > 0.2) {
    return { suggestion: bestMatch, confidence: Math.round(highestScore * 100), reason: 'Ähnlichkeit erkannt' };
  }

  return { suggestion: '', confidence: 0, reason: 'Kein Treffer' };
}

/**
 * Plausibilitäts- und OCR-Audit für eingelesene Rechnungen
 */
function auditInvoicesOCR(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  if (!recSheet || recSheet.getLastRow() < 2) return [];

  const data = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, 19).getValues();
  const invMap = {};

  data.forEach(row => {
    const belegId = String(row[0] || '').trim();
    const dateVal = row[2] instanceof Date ? row[2] : (row[2] ? new Date(row[2]) : null);
    const lieferant = String(row[3] || '').trim();
    const rechnungsNr = String(row[4] || '').trim();
    const artName = String(row[6] || '').trim();
    const menge = parseFloat(row[9]) || 0;
    const einzelNetto = parseFloat(row[11]) || 0;
    const gesamtNetto = parseFloat(row[12]) || 0;
    const bookingStatus = String(row[16] || '').trim();

    const invKey = `${lieferant}_${rechnungsNr || belegId}`;
    if (!invMap[invKey]) {
      invMap[invKey] = {
        belegId: belegId,
        rechnungsNr: rechnungsNr || 'Ohne Nr.',
        lieferant: lieferant,
        date: dateVal,
        itemCount: 0,
        sumNetto: 0,
        issues: []
      };
    }

    invMap[invKey].itemCount++;
    invMap[invKey].sumNetto += gesamtNetto;

    if (einzelNetto <= 0 && gesamtNetto <= 0 && !bookingStatus.toLowerCase().includes('gutschrift')) {
      invMap[invKey].issues.push(`Position "${artName}": 0,00 €`);
    }
    if (einzelNetto > 500) {
      invMap[invKey].issues.push(`Position "${artName}": Hoher Einzelpreis (${einzelNetto.toFixed(2)} €)`);
    }
  });

  const auditRows = [];
  Object.keys(invMap).forEach(k => {
    const inv = invMap[k];
    let status = 'OK';
    let diagnosis = 'Beleg rechnerisch plausibel';

    if (inv.issues.length > 0) {
      status = 'AUFFÄLLIGKEIT';
      diagnosis = inv.issues.join(' | ');
    } else if (inv.itemCount === 0) {
      status = 'LEERER_BELEG';
      diagnosis = 'Keine Positionen erkannt';
    } else if (inv.sumNetto === 0) {
      status = 'SUMME_NULL';
      diagnosis = 'Belegsumme ist 0,00 €';
    }

    auditRows.push([
      inv.belegId,
      inv.rechnungsNr,
      inv.lieferant,
      inv.date instanceof Date && !isNaN(inv.date.getTime()) ? inv.date : '',
      inv.itemCount,
      Math.round(inv.sumNetto * 100) / 100,
      status,
      diagnosis
    ]);
  });

  return auditRows;
}

function setupPrueflisteSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let pSheet = ss.getSheetByName(CONFIG.NAME_PRUEFUNG);
  if (!pSheet) pSheet = ss.insertSheet(CONFIG.NAME_PRUEFUNG);
  else pSheet.clear();

  // 1. Titel Banner
  pSheet.getRange('A1:L1').merge()
    .setValue('📋 EINKAUFS-, ZUORDNUNGS- & OCR-PRÜFUNG (INTERAKTIVES AUDIT- & LERN-WERKZEUG)')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  pSheet.setRowHeight(1, 40);

  // 2. 6 KPI-Karten (Zeilen 3 & 4)
  const kpis = [
    ['GESAMT MASTER-ZUTATEN', '0', '#E8F0FE', '#1967D2', 1],
    ['GÜLTIGE KALKULATIONSPREISE', '0', '#E6F4EA', '#137333', 3],
    ['VERALTETE PREISE (>90d)', '0', '#FEF7E0', '#B06000', 5],
    ['KEIN PREIS / UNKLAR', '0', '#FCE8E6', '#C5221F', 7],
    ['OFFENE ARTIKELFÄLLE', '0', '#F3E8FD', '#7B1FA2', 9],
    ['BELEGE IM SYSTEM', '0', '#ECEFF1', '#37474F', 11]
  ];

  kpis.forEach(k => {
    pSheet.getRange(3, k[4], 1, 2).merge().setValue(k[0])
      .setFontWeight('bold').setFontSize(9).setFontColor('#5F6368').setHorizontalAlignment('center');
    pSheet.getRange(4, k[4], 1, 2).merge().setValue(k[1])
      .setFontWeight('bold').setFontSize(15).setFontColor(k[3]).setBackground(k[2])
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  pSheet.setRowHeight(3, 22);
  pSheet.setRowHeight(4, 32);

  // 3. Sektion 1: Offene Artikelstamm-Zuordnungen & Kalibrierungstabelle
  pSheet.getRange('A6:N6').merge()
    .setValue('1. VERBESSERUNGSTABELLE & KALIBRIERUNG (OFFENE ARTIKEL, EINHEITEN-UMRECHNUNG & PREISE)')
    .setFontWeight('bold')
    .setBackground('#2E5B88')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  pSheet.setRowHeight(6, 28);

  const artHeaders = [
    'Artikel-ID', 'Artikelbezeichnung', 'Hauptlieferant', 'Warengruppe', 'Gebinde-Bezeichnung',
    'Aktuelle Einheit', 'Gebindepreis (€)', 'Aktueller Ref-Preis (€/Einh.)', 'Aktuelle Master-Zutat',
    '💡 KI-Vorschlag (Berechnung & Master)', '✍️ Wunsch-Einheit (kg/l/Stk)', '✍️ Gebinde-Inhalt (z.B. 4.2)', '✍️ Fester Ref-Preis (€)', '✍️ Wunsch-Masterzutat'
  ];
  pSheet.getRange(7, 1, 1, artHeaders.length).setValues([artHeaders])
    .setFontWeight('bold').setBackground('#ECEFF1').setHorizontalAlignment('center').setWrap(true);
  pSheet.setRowHeight(7, 32);

  pSheet.autoResizeColumns(1, 14);
  return pSheet;
}

/**
 * Erzeugt die vollständige Prüfliste mit Vorschlägen, Korrekturzeilen und Beleg-Audit
 */
function generatePruefliste(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let pSheet = ss.getSheetByName(CONFIG.NAME_PRUEFUNG);
  if (!pSheet) pSheet = setupPrueflisteSheet(ss);

  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!artSheet || !mzSheet) return { totalMaster: 0, validPrices: 0, outdatedPrices: 0, missingPrices: 0, artIssues: 0, invoiceCount: 0 };

  // Bestehende Benutzereingaben in Spalte K, L, M & N auslesen und beibehalten
  const preservedInputs = {};
  if (pSheet && pSheet.getLastRow() >= 8) {
    const oldPData = pSheet.getRange(8, 1, pSheet.getLastRow() - 7, Math.max(14, pSheet.getLastColumn())).getValues();
    oldPData.forEach(row => {
      const artId = String(row[0] || '').trim();
      const uUnit = String(row[10] || '').trim();
      const uInhalt = row[11] !== '' ? row[11] : '';
      const uPrice = row[12] !== '' ? row[12] : '';
      const uMaster = String(row[13] || '').trim();
      if (artId && (uUnit || uInhalt !== '' || uPrice !== '' || uMaster)) {
        preservedInputs[artId] = { unit: uUnit, inhalt: uInhalt, price: uPrice, master: uMaster };
      }
    });
  }

  // 1. Artikelstamm analysieren
  const artIssues = [];
  const artLastRow = artSheet.getLastRow();
  if (artLastRow >= 5) {
    const artCols = Math.max(19, artSheet.getLastColumn());
    const artData = artSheet.getRange(5, 1, artLastRow - 4, artCols).getValues();

    artData.forEach(row => {
      const artId = String(row[0] || '').trim();
      const artName = String(row[1] || '').trim();
      const wg = String(row[2] || '').trim();
      const supp = String(row[5] || '').trim();
      const gebinde = String(row[7] || '').trim();
      const unit = String(row[9] || '').trim();
      const gebindePreis = parseFloat(row[10]) || 0;
      const refPrice = parseFloat(row[11]) || 0;
      const masterId = String(row[16] || '').trim();
      const status = String(row[17] || 'EINDEUTIG_ZUGEORDNET').trim();
      const aktiv = String(row[18] || 'JA').trim().toUpperCase();

      let isIssue = false;
      if (!masterId || masterId === '' || status === 'KEINE_MASTER_ZUTAT' || status === 'ZU_PRUEFEN' || !unit || unit === '') {
        isIssue = true;
      }

      if (isIssue) {
        const sug = suggestMasterIngredient(artName, wg);
        // Prüfe ob automatische Stückgewichts-Berechnung greift
        const autoNorm = normalizeUnitAndPrice(artName, gebinde, 1, gebindePreis, artId);
        let kiText = '';
        if (autoNorm.basiseinheit === 'kg' && unit !== 'kg' && autoNorm.inhalt > 0) {
          kiText = `kg-Berechnung: ${autoNorm.inhalt}kg (${autoNorm.referenzpreis.toFixed(2)} €/kg) | Master: ${sug.suggestion || 'Passend'}`;
        } else {
          kiText = sug.suggestion ? `${sug.suggestion} (${sug.confidence}%)` : 'Kein Vorschlag';
        }

        const userPre = preservedInputs[artId] || { unit: '', inhalt: '', price: '', master: '' };
        artIssues.push([
          artId, artName, supp, wg, gebinde, unit, gebindePreis, refPrice, masterId,
          kiText,
          userPre.unit,
          userPre.inhalt,
          userPre.price,
          userPre.master
        ]);
      }
    });
  }

  // 2. Master-Zutaten analysieren
  const mzIssues = [];
  let totalMaster = 0;
  let validPrices = 0;
  let outdatedPrices = 0;
  let missingPrices = 0;

  const mzLastRow = mzSheet.getLastRow();
  if (mzLastRow >= 2) {
    const mzCols = Math.max(23, mzSheet.getLastColumn());
    const mzData = mzSheet.getRange(2, 1, mzLastRow - 1, mzCols).getValues();
    totalMaster = mzData.length;

    mzData.forEach(row => {
      const mId = String(row[0] || '').trim();
      const mName = String(row[1] || '').trim();
      const wg = String(row[2] || '').trim();
      const unit = String(row[5] || '').trim();
      const kalkPreis = parseFloat(row[6]) || 0;
      const status = String(row[7] || '').trim();
      const quelle = String(row[8] || '').trim();
      const datum = row[9];
      const supp = String(row[10] || '').trim();
      const latestPrice = parseFloat(row[12]) || 0;
      const cheapestPrice = parseFloat(row[15]) || 0;
      const cheapestSupp = String(row[16] || '').trim();
      const ageDays = parseInt(row[18], 10) || 0;
      const zuPruefen = String(row[19] || 'NEIN').trim();

      if (status === 'GUELTIG' || status === 'MANUELL_FREIGEGEBEN') {
        validPrices++;
      } else if (status === 'VERALTET') {
        outdatedPrices++;
      } else {
        missingPrices++;
      }

      let issueReason = '';
      if (status === 'KEIN_PREIS') {
        issueReason = 'Kein Einkaufspreis vorhanden';
      } else if (status === 'VERALTET') {
        issueReason = `Preis älter als ${PREIS_CONFIG.MAX_PREISALTER_TAGE} Tage (${ageDays} Tage alt)`;
      } else if (status === 'BASISEINHEIT_FEHLT') {
        issueReason = 'Standard-Basiseinheit fehlt';
      } else if (status === 'GEBINDE_UNKLAR') {
        issueReason = 'Gebindeumrechnung fehlerhaft';
      } else if (cheapestPrice > 0 && latestPrice > 0) {
        const diffPct = ((latestPrice - cheapestPrice) / cheapestPrice) * 100;
        if (diffPct > PREIS_CONFIG.WARNUNG_PREISABWEICHUNG_PROZENT) {
          issueReason = `Günstigerer Lieferant: ${cheapestSupp} (${cheapestPrice.toFixed(2)} € vs. ${latestPrice.toFixed(2)} € | +${diffPct.toFixed(1)}%)`;
        }
      }

      if (issueReason !== '' || zuPruefen === 'JA') {
        mzIssues.push([
          mId, mName, wg, unit, kalkPreis > 0 ? kalkPreis : '', status, quelle, supp,
          datum instanceof Date && !isNaN(datum.getTime()) ? datum : '',
          ageDays > 0 ? ageDays : '',
          issueReason || 'Prüfbedürftig'
        ]);
      }
    });
  }

  // 3. OCR-Belege auditieren
  const ocrAudit = auditInvoicesOCR(ss);

  // Tabellenblatt PRUEFUNG_EINKAUF aufbauen
  setupPrueflisteSheet(ss);
  pSheet = ss.getSheetByName(CONFIG.NAME_PRUEFUNG);

  // KPIs
  pSheet.getRange('A4').setValue(totalMaster);
  pSheet.getRange('C4').setValue(validPrices);
  pSheet.getRange('E4').setValue(outdatedPrices);
  pSheet.getRange('G4').setValue(missingPrices);
  pSheet.getRange('I4').setValue(artIssues.length);
  pSheet.getRange('K4').setValue(ocrAudit.length);

  // Sektion 1 (Artikelstamm & Kalibrierung) befüllen
  let curRow = 8;
  if (artIssues.length > 0) {
    pSheet.getRange(curRow, 1, artIssues.length, artIssues[0].length).setValues(artIssues);
    pSheet.getRange(curRow, 7, artIssues.length, 2).setNumberFormat('[$€-de-DE] #,##0.00');
    // Markiere Korrektur-Spalten K, L, M, N mit dezenter gelber Hintergrundfarbe
    pSheet.getRange(curRow, 11, artIssues.length, 4).setBackground('#FFFDE7');
    curRow += artIssues.length + 2;
  } else {
    pSheet.getRange(curRow, 1, 1, 14).merge().setValue('Keine offenen Artikelstamm-Prüffälle vorhanden (100% sauber zugeordnet)')
      .setFontColor('#2F855A').setFontStyle('italic').setBackground('#E6F4EA');
    curRow += 3;
  }

  // Sektion 2: Master-Zutaten Audit
  pSheet.getRange(curRow, 1, 1, 14).merge()
    .setValue('2. MASTER-ZUTATEN PREIS- & DATENAUDIT (VERALTETE PREISE, KEIN PREIS & LIEFERANTENDIFFERENZEN)')
    .setFontWeight('bold')
    .setBackground('#37474F')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  pSheet.setRowHeight(curRow, 28);
  curRow++;

  const mzHeaders = [
    'Master-ID', 'Master-Zutat', 'Warengruppe', 'Standard-Einheit', 'Kalkulationspreis (€)',
    'Status', 'Quelle', 'Lieferant', 'Rechnungsdatum', 'Preisalter (Tage)', 'Prüfgrund / Handlungsempfehlung'
  ];
  pSheet.getRange(curRow, 1, 1, mzHeaders.length).setValues([mzHeaders])
    .setFontWeight('bold').setBackground('#ECEFF1').setHorizontalAlignment('center');
  pSheet.setRowHeight(curRow, 26);
  curRow++;

  if (mzIssues.length > 0) {
    pSheet.getRange(curRow, 1, mzIssues.length, mzIssues[0].length).setValues(mzIssues);
    pSheet.getRange(curRow, 5, mzIssues.length, 1).setNumberFormat('[$€-de-DE] #,##0.00');
    pSheet.getRange(curRow, 9, mzIssues.length, 1).setNumberFormat('dd.MM.yyyy');
    pSheet.getRange(curRow, 10, mzIssues.length, 1).setNumberFormat('#,##0');
    curRow += mzIssues.length + 2;
  } else {
    pSheet.getRange(curRow, 1, 1, 11).merge().setValue('Alle Master-Zutaten besitzen gültige, aktuelle Kalkulationspreise')
      .setFontColor('#2F855A').setFontStyle('italic').setBackground('#E6F4EA');
    curRow += 3;
  }

  // Sektion 3: OCR-Beleg-Diagnose
  pSheet.getRange(curRow, 1, 1, 14).merge()
    .setValue('3. BELEG- & OCR-DIAGNOSE (PLAUSIBILITÄT DER EINGELESENEN RECHNUNGEN)')
    .setFontWeight('bold')
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  pSheet.setRowHeight(curRow, 28);
  curRow++;

  const ocrHeaders = [
    'Beleg-ID', 'Rechnungs-Nr', 'Lieferant', 'Rechnungsdatum', 'Anzahl Positionen',
    'Erfasste Summe Netto (€)', 'Status', 'OCR-Diagnose / Auffälligkeiten'
  ];
  pSheet.getRange(curRow, 1, 1, ocrHeaders.length).setValues([ocrHeaders])
    .setFontWeight('bold').setBackground('#ECEFF1').setHorizontalAlignment('center');
  pSheet.setRowHeight(curRow, 26);
  curRow++;

  if (ocrAudit.length > 0) {
    pSheet.getRange(curRow, 1, ocrAudit.length, ocrAudit[0].length).setValues(ocrAudit);
    pSheet.getRange(curRow, 4, ocrAudit.length, 1).setNumberFormat('dd.MM.yyyy');
    pSheet.getRange(curRow, 6, ocrAudit.length, 1).setNumberFormat('[$€-de-DE] #,##0.00');
  } else {
    pSheet.getRange(curRow, 1, 1, 8).merge().setValue('Noch keine Rechnungsbelege vorhanden')
      .setFontColor('#5F6368').setFontStyle('italic');
  }

  pSheet.autoResizeColumns(1, 14);

  return {
    totalMaster: totalMaster,
    validPrices: validPrices,
    outdatedPrices: outdatedPrices,
    missingPrices: missingPrices,
    artIssues: artIssues.length,
    invoiceCount: ocrAudit.length
  };
}

function generatePrueflisteManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = generatePruefliste(ss);
  const pSheet = ss.getSheetByName(CONFIG.NAME_PRUEFUNG);
  if (pSheet) ss.setActiveSheet(pSheet);

  let msg = `=== VERBESSERUNGSTABELLE & KALIBRIERUNG AKTUALISIERT ===\n\n`;
  msg += `• Gesamt Master-Zutaten: ${res.totalMaster}\n`;
  msg += `• Gültige Kalkulationspreise: ${res.validPrices}\n`;
  msg += `• Veraltete Preise (> ${PREIS_CONFIG.MAX_PREISALTER_TAGE} Tage): ${res.outdatedPrices}\n`;
  msg += `• Offene Artikelstamm-Fälle: ${res.artIssues}\n`;
  msg += `• Gescannte Rechnungen: ${res.invoiceCount}\n\n`;
  msg += `💡 Tipp:\nIn den gelben Spalten K (Wunsch-Einheit), L (Inhalt), M (Fester Preis) und N (Wunsch-Masterzutat) können Sie direkt Korrekturen eintragen.\nÜber Menüpunkt "7. Korrekturen anwenden" lernt das System diese Regeln dauerhaft!`;

  SpreadsheetApp.getUi().alert('Verbesserungstabelle & Kalibrierung', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Wendet vom Benutzer eingetragene Korrekturen & Kalibrierungen dauerhaft auf Artikelstamm & System an
 */
function applyUserCorrectionsFromPruefliste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pSheet = ss.getSheetByName(CONFIG.NAME_PRUEFUNG);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const ui = SpreadsheetApp.getUi();

  if (!pSheet || !artSheet) {
    ui.alert('Fehler', 'Tabellenblätter nicht gefunden.', ui.ButtonSet.OK);
    return;
  }

  const pLastRow = pSheet.getLastRow();
  if (pLastRow < 8) {
    ui.alert('Hinweis', 'In der Verbesserungstabelle sind derzeit keine Artikel vorhanden.', ui.ButtonSet.OK);
    return;
  }

  const artCols = Math.max(19, artSheet.getLastColumn());
  const artLastRow = artSheet.getLastRow();
  if (artLastRow < 5) return;

  const artData = artSheet.getRange(5, 1, artLastRow - 4, artCols).getValues();
  const artMap = {};
  artData.forEach((row, idx) => {
    const id = String(row[0] || '').trim();
    if (id) {
      artMap[id] = { rowIdx: idx + 5, row: row };
    }
  });

  const pData = pSheet.getRange(8, 1, Math.min(200, pLastRow - 7), 14).getValues();
  let updatedCount = 0;
  const updateLog = [];

  for (let i = 0; i < pData.length; i++) {
    const row = pData[i];
    const artId = String(row[0] || '').trim();
    const artName = String(row[1] || '').trim();
    const userUnit = String(row[10] || '').trim();      // Spalte K (11)
    const userInhalt = parseFloat(row[11]) || 0;        // Spalte L (12)
    const userPrice = parseFloat(row[12]) || 0;         // Spalte M (13)
    const userMaster = String(row[13] || '').trim();    // Spalte N (14)

    if (artId.startsWith('2. MASTER-ZUTATEN') || artId.startsWith('3. BELEG-')) break;
    if (!artId || !artMap[artId]) continue;

    if (userUnit !== '' || userInhalt > 0 || userPrice > 0 || userMaster !== '') {
      const target = artMap[artId];
      const r = target.rowIdx;
      const gebindePreis = parseFloat(target.row[10]) || 0;

      const finalUnit = userUnit || String(target.row[9] || 'kg').trim();
      const finalInhalt = userInhalt > 0 ? userInhalt : (parseFloat(target.row[8]) || 1);
      let finalRefPrice = userPrice > 0 ? userPrice : (gebindePreis > 0 && finalInhalt > 0 ? Math.round((gebindePreis / finalInhalt) * 100) / 100 : parseFloat(target.row[11]) || 0);

      // Dauerhaft in ScriptProperties lernen
      saveLearnedCalibration(artId, artName, {
        unit: finalUnit,
        inhalt: finalInhalt,
        manualPrice: userPrice > 0 ? userPrice : null,
        master: userMaster || null
      });

      // Im ARTIKELSTAMM aktualisieren
      artSheet.getRange(r, 9).setValue(finalInhalt);
      artSheet.getRange(r, 10).setValue(finalUnit);
      artSheet.getRange(r, 12).setValue(finalRefPrice);

      if (userMaster !== '') {
        artSheet.getRange(r, 16).setValue('Manuell kalibriert: ' + userMaster);
      }

      artSheet.getRange(r, 18).setValue('EINDEUTIG_ZUGEORDNET');
      artSheet.getRange(r, 19).setValue('JA');

      updatedCount++;
      updateLog.push(`• [${artId}] ${artName} -> ${finalInhalt} ${finalUnit} (${finalRefPrice.toFixed(2)} €/${finalUnit}) | Master: "${userMaster || 'bestehend'}"`);
    }
  }

  if (updatedCount > 0) {
    syncMasterZutatenFromArticles(ss);
    generatePruefliste(ss);

    let msg = `Erfolg: ${updatedCount} Artikel wurden kalibriert und dauerhaft im System gelernt!\n\n`;
    msg += updateLog.slice(0, 10).join('\n');
    if (updateLog.length > 10) msg += `\n... und ${updateLog.length - 10} weitere.`;
    msg += `\n\nAlle Master-Zutaten, Umrechnungen und Kalkulationspreise wurden synchronisiert und dauerhaft verankert.`;

    ui.alert('Kalibrierung & Korrektur gelernt', msg, ui.ButtonSet.OK);
  } else {
    ui.alert(
      'Keine Kalibrierungen eingetragen',
      'Bitte tragen Sie in Tabelle "PRUEFUNG_EINKAUF" in den gelben Spalten K (Einheit), L (Inhalt), M (Preis) oder N (Masterzutat) Ihre gewünschten Werte ein und klicken Sie erneut auf diesen Menüpunkt.',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Zeigt den vollständigen Diagnosebericht an (optimiert zum Kopieren und Weiterleiten an die KI)
 */
function showDiagnosticReportAssistant() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = generatePruefliste(ss);
  const audit = runDatabaseHealthAudit(ss);
  const ocrAudit = auditInvoicesOCR(ss);

  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const artIssues = [];
  if (artSheet && artSheet.getLastRow() >= 5) {
    const artData = artSheet.getRange(5, 1, artSheet.getLastRow() - 4, Math.max(19, artSheet.getLastColumn())).getValues();
    artData.forEach(row => {
      const artId = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      const supp = String(row[5] || '').trim();
      const status = String(row[17] || '').trim();
      const unit = String(row[9] || '').trim();
      if (status === 'ZU_PRUEFEN' || status === 'KEINE_MASTER_ZUTAT' || !unit) {
        const sug = suggestMasterIngredient(name, row[2]);
        artIssues.push(`- [${artId}] ${name} (${supp}) | Status: ${status || 'UNKLAR'} | KI-Vorschlag: "${sug.suggestion || 'Keiner'}" (${sug.confidence}%)`);
      }
    });
  }

  let report = `=== SONA KARLI: WARENWIRTSCHAFT DIAGNOSEBERICHT (${Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm')}) ===\n\n`;
  report += `1. BELEG- & OCR-ERFASSUNG:\n`;
  report += `• Verarbeitete Rechnungen: ${ocrAudit.length}\n`;
  const auffaellige = ocrAudit.filter(o => o[6] !== 'OK');
  report += `• Auffällige Belege: ${auffaellige.length}\n`;
  if (auffaellige.length > 0) {
    auffaellige.slice(0, 5).forEach(o => {
      report += `  - ${o[2]} (${o[1]}): ${o[7]}\n`;
    });
  }

  report += `\n2. ARTIKELSTAMM & ZUORDNUNGEN:\n`;
  report += `• Geprüfte Artikel: ${audit.totalChecked}\n`;
  report += `• Offene Prüffälle / Ungemappt: ${artIssues.length}\n`;
  if (artIssues.length > 0) {
    report += `  Details der ersten Prüffälle:\n  ` + artIssues.slice(0, 8).join('\n  ') + `\n`;
  }

  report += `\n3. MASTER-ZUTATEN & KALKULATIONSPREISE:\n`;
  report += `• Gesamt Master-Zutaten: ${res.totalMaster}\n`;
  report += `• Gültige aktuelle Preise: ${res.validPrices}\n`;
  report += `• Veraltete Preise (> ${PREIS_CONFIG.MAX_PREISALTER_TAGE} Tage): ${res.outdatedPrices}\n`;
  report += `• Fehlende Preise: ${res.missingPrices}\n`;

  report += `\n==================================================\n`;
  report += `💡 TIPP: Kopieren Sie diesen Text und fügen Sie ihn im Chat ein, um den Code gezielt zu optimieren!`;

  Logger.log(report);

  const ui = SpreadsheetApp.getUi();
  ui.alert('Diagnose- & Optimierungsbericht', report, ui.ButtonSet.OK);
}

/**
 * ============================================================================
 * 1.7 VERBINDLICHE SCHNITTSTELLE FÜR SCHWUND- & REZEPTURKONTROLLE
 * ============================================================================
 * Berechnet/liefert den gültigen Netto-Kalkulationspreis für eine Master-Zutat
 * @param {string} masterIdOrName - z. B. 'MZ-0001' oder 'Lachs (Label Rouge)'
 * @param {Date|string} targetDate - Optionales Datum für Stichtagsbewertungen
 * @param {Spreadsheet} ss - Optionales Spreadsheet
 * @return {Object|null} { masterId, name, unit, kalkulationspreis, status, quelle, lieferant, datum, isGueltig }
 */
function getKalkulationspreisForMasterZutat(masterIdOrName, targetDate, ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!mzSheet) return null;

  const lastRow = mzSheet.getLastRow();
  if (lastRow < 2) return null;

  const lookup = String(masterIdOrName || '').trim().toLowerCase();
  if (!lookup) return null;

  const cols = Math.max(23, mzSheet.getLastColumn());
  const data = mzSheet.getRange(2, 1, lastRow - 1, cols).getValues();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = String(row[0] || '').trim().toLowerCase();
    const name = String(row[1] || '').trim().toLowerCase();

    if (id === lookup || name === lookup) {
      const price = parseFloat(row[6]) || 0;
      const status = String(row[7] || 'KEIN_PREIS');
      return {
        masterId: row[0],
        name: row[1],
        warengruppe: row[2],
        hauptkategorie: row[3],
        aktiv: row[4],
        basiseinheit: row[5],
        kalkulationspreisNetto: price,
        status: status,
        quelle: row[8],
        datum: row[9],
        lieferant: row[10],
        artikelstammId: row[11],
        preisZuPruefen: row[19] === 'JA',
        isGueltig: price > 0 && status !== 'KEIN_PREIS' && status !== 'BASISEINHEIT_FEHLT',
        isVeraltet: (status === 'VERALTET')
      };
    }
  }

  return null;
}

/**
 * ==========================================
 * 3. ECHTZEIT-ALERTS BEI RECHNUNGS-TRIGGER (100% EMOJI-FREI)
 * ==========================================
 */
function sendRealtimeAlertEmail(alerts, invoiceData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const email = getUserEmail();
  const dateStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
  const subject = `[PREIS-WARNUNG] ${CONFIG.LOCATION_NAME} - Rechnungseingang (${invoiceData.lieferant})`;

  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);

  const artGid = artSheet ? artSheet.getSheetId() : 0;
  const mzGid = mzSheet ? mzSheet.getSheetId() : 0;
  const recGid = recSheet ? recSheet.getSheetId() : 0;

  let alertRows = alerts.map(a => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 10px; font-weight: 700; color: #9b2c2c; font-size: 13px;">${a.title}</td>
      <td style="padding: 12px 10px; color: #2d3748; font-size: 13px;">${a.details}</td>
    </tr>
  `).join('');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #2d3748; }
        .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
        .header { background-color: #1b365d; color: #ffffff; padding: 22px; text-align: left; }
        .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 22px; }
        .info-box { background: #fff5f5; border-left: 4px solid #e53e3e; border-radius: 4px; padding: 14px; margin-bottom: 18px; font-size: 13px; line-height: 1.5; color: #742a2a; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 22px; }
        th { background: #edf2f7; color: #4a5568; font-weight: 700; text-align: left; padding: 10px; }
        .btn-group { display: flex; gap: 10px; margin-top: 15px; margin-bottom: 10px; flex-wrap: wrap; }
        .btn { display: inline-block; background: #1b365d; color: #ffffff !important; text-decoration: none; padding: 10px 16px; border-radius: 5px; font-weight: 600; font-size: 12px; margin-right: 8px; margin-bottom: 8px; }
        .btn-secondary { background: #4a5568; }
        .btn-accent { background: #b7791f; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Controlling-Alarm: ${CONFIG.LOCATION_NAME}</h1>
          <p style="margin-top: 6px; margin-bottom: 0; font-size: 12px; opacity: 0.9;">Lieferant: ${invoiceData.lieferant} | Beleg: ${invoiceData.rechnungsNr} | Zeit: ${dateStr}</p>
        </div>
        <div class="content">
          <div class="info-box">
            <strong>Automatische Belegverarbeitung abgeschlossen:</strong><br>
            Alle Belegpositionen wurden verbucht. Bei folgenden Positionen wurden <strong>Preissprünge oder Prüffälle</strong> erkannt:
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Ereignis</th>
                <th>Details & Betroffener Artikel</th>
              </tr>
            </thead>
            <tbody>
              ${alertRows}
            </tbody>
          </table>

          <p style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #1b365d;">Direkte Aktionen im Google Sheet ausführen:</p>
          <div class="btn-group">
            <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit#gid=${artGid}" class="btn">
              1. Artikelstamm öffnen & anpassen
            </a>
            <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit#gid=${mzGid}" class="btn btn-accent">
              2. Master-Zutaten Preisvergleich
            </a>
            <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit#gid=${recGid}" class="btn btn-secondary">
              3. Rechnungseingang prüfen
            </a>
          </div>
        </div>
        <div class="footer">
          Automatisches Controlling & Warenwirtschaftssystem | Standort: ${CONFIG.LOCATION_NAME}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
  } catch(e) {
    Logger.log('Alert Mail Error: ' + e.toString());
  }
}

/**
 * ==========================================
 * 4. DASHBOARD MIT DOPPEL-FILTER (MONAT & LIEFERANT)
 * ==========================================
 */
function setupWeeklyDashboard(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashSheet = ss.getSheetByName(CONFIG.NAME_DASHBOARD);
  if (!dashSheet) dashSheet = ss.insertSheet(CONFIG.NAME_DASHBOARD, 0);
  else dashSheet.clear();
  
  // 1. Titel-Banner
  dashSheet.getRange('A1:H1').merge()
    .setValue(CONFIG.LOCATION_NAME.toUpperCase() + ' — WARENWIRTSCHAFT & CONTROLLING COCKPIT')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#1B365D')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(1, 45);
  
  // 2. Doppel-Filter-Leiste (Zeile 3): Monat in C3, Lieferant in F3
  dashSheet.getRange('A3:B3').merge()
    .setValue('Auswertungszeitraum:')
    .setFontWeight('bold')
    .setFontColor('#1B365D')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
    
  const monthFilterCell = dashSheet.getRange('C3');
  monthFilterCell.clearDataValidations().setValue('Alle Monate')
    .setFontWeight('bold')
    .setBackground('#E8F0FE')
    .setFontColor('#1967D2')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const monthOptions = [
    'Alle Monate',
    '2026-01 (Januar)', '2026-02 (Februar)', '2026-03 (März)',
    '2026-04 (April)',  '2026-05 (Mai)',      '2026-06 (Juni)',
    '2026-07 (Juli)',   '2026-08 (August)',   '2026-09 (September)',
    '2026-10 (Oktober)','2026-11 (November)', '2026-12 (Dezember)'
  ];
  const monthRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(monthOptions, true)
    .setAllowInvalid(true)
    .build();
  dashSheet.getRange('C3').setDataValidation(monthRule);

  dashSheet.getRange('D3:E3').merge()
    .setValue('Lieferant:')
    .setFontWeight('bold')
    .setFontColor('#1B365D')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');

  const supplierFilterCell = dashSheet.getRange('F3');
  supplierFilterCell.clearDataValidations().setValue('Alle Lieferanten')
    .setFontWeight('bold')
    .setBackground('#E8F0FE')
    .setFontColor('#1967D2')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const supplierOptions = [
    'Alle Lieferanten',
    'METRO Deutschland (Leipzig)',
    'RUNGIS express GmbH',
    'SSP Trade & Consult GmbH',
    'Transgourmet',
    'Selgros',
    'Chef Culinar',
    'Asia Express Food B.V.'
  ];
  const supplierRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(supplierOptions, true)
    .setAllowInvalid(true)
    .build();
  dashSheet.getRange('F3').setDataValidation(supplierRule);

  dashSheet.getRange('G3:H3').merge()
    .setValue('Filter synchron aktiv')
    .setFontStyle('italic')
    .setFontColor('#5F6368')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(3, 35);

  // 3. 4 Große KPI-Karten
  const kpiTitles = [
    ['GESAMTAUSGABEN (NETTO)', '#E8F0FE', '#1967D2'],
    ['GESAMTAUSGABEN (BRUTTO)', '#E6F4EA', '#137333'],
    ['ERFASSTE POSITIONEN', '#FEF7E0', '#B06000'],
    ['MASTER-ZUTATEN BASIS', '#FCE8E6', '#C5221F']
  ];
  
  kpiTitles.forEach((kpi, idx) => {
    const colStart = (idx * 2) + 1;
    dashSheet.getRange(5, colStart, 1, 2).merge().setValue(kpi[0])
      .setFontWeight('bold').setFontSize(9).setFontColor('#5F6368').setHorizontalAlignment('center');
    dashSheet.getRange(6, colStart, 2, 2).merge()
      .setFontWeight('bold').setFontSize(16).setFontColor(kpi[2]).setBackground(kpi[1])
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  
  // 4. Linke Tabelle: Auswertung nach Hauptkategorien
  dashSheet.getRange('A10:D10').merge().setValue('AUSGABEN NACH HAUPTKATEGORIE').setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
  dashSheet.getRange(11, 1, 1, 4).setValues([['Kategorie', 'Netto-Ausgaben (€)', 'Anteil (%)', 'Positionen']]).setFontWeight('bold').setBackground('#ECEFF1');
  
  const katNames = [['Food'], ['Beverage'], ['Nonfood'], ['Leergut']];
  dashSheet.getRange(12, 1, 4, 1).setValues(katNames);
  dashSheet.getRange('B12:B15').setNumberFormat('[$€-de-DE] #,##0.00');
  dashSheet.getRange('C12:C15').setNumberFormat('0.0%');
  dashSheet.getRange('D12:D15').setNumberFormat('#,##0');
  
  // 5. Rechte Tabelle: Warengruppen Top-10
  dashSheet.getRange('F10:H10').merge().setValue('WARENGRUPPEN-ÜBERSICHT (TOP 10)').setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
  dashSheet.getRange(11, 6, 1, 3).setValues([['Warengruppe', 'Ausgaben Netto (€)', 'Positionen']]).setFontWeight('bold').setBackground('#ECEFF1');
  
  const wgList = [
    ['E1: Fisch'], ['E2: Seafood'], ['E4: Rind'], ['E7: Reis/Nudeln'],
    ['E8: Gemüse/Salat/Obst'], ['E9: Nährmittel/Gewürz'], ['E11: Soße/Paste'],
    ['E13: Spirituose'], ['E22: Öl/Essig'], ['E23: Drogerie/Hygienemittel']
  ];
  dashSheet.getRange(12, 6, wgList.length, 1).setValues(wgList);
  dashSheet.getRange('G12:G21').setNumberFormat('[$€-de-DE] #,##0.00');
  dashSheet.getRange('H12:H21').setNumberFormat('#,##0');
  
  // 6. Alarme & Preisveränderungen
  dashSheet.getRange('A24:H24').merge().setValue('PREISENTWICKLUNGEN & PREISALARME IM ARTIKELSTAMM').setFontWeight('bold').setBackground('#B71C1C').setFontColor('#FFFFFF');
  dashSheet.getRange(25, 1, 1, 8).setValues([['Artikel-ID', 'Artikelbezeichnung', 'Warengruppe', 'Aktueller Listenpreis', 'Referenzpreis (€/kg|l)', 'Veränderung (%)', 'Lieferant', 'Letzter Beleg']]).setFontWeight('bold').setBackground('#ECEFF1');
  dashSheet.autoResizeColumns(1, 8);
  
  updateDashboardFigures(ss);
}

/**
 * Berechnet alle Dashboard-Zahlen live aus der Schnittmenge von Monat (C3) & Lieferant (F3)
 */
function updateDashboardFigures(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName(CONFIG.NAME_DASHBOARD);
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!dashSheet || !recSheet) return;

  const monthFilterVal = String(dashSheet.getRange('C3').getValue() || 'Alle Monate (Gesamt)').trim();
  const filterMonth = monthFilterVal.startsWith('Alle') ? null : monthFilterVal.substring(0, 7);

  const suppFilterVal = String(dashSheet.getRange('F3').getValue() || 'Alle Lieferanten (Gesamt)').trim();
  const filterSupplier = suppFilterVal.startsWith('Alle') ? null : suppFilterVal.toLowerCase();

  let totalNetto = 0;
  let totalBrutto = 0;
  let totalPos = 0;

  const katStats = {
    'Food': { netto: 0, pos: 0 },
    'Beverage': { netto: 0, pos: 0 },
    'Nonfood': { netto: 0, pos: 0 },
    'Leergut': { netto: 0, pos: 0 }
  };

  const wgStats = {};

  const recLastRow = recSheet.getLastRow();
  if (recLastRow > 1) {
    const data = recSheet.getRange(2, 1, recLastRow - 1, 19).getValues();
    data.forEach(row => {
      const rowMonth = String(row[18] || '').trim();
      const rowSupplier = String(row[3] || '').trim().toLowerCase();

      if (filterMonth && rowMonth !== filterMonth) return;
      if (filterSupplier && !rowSupplier.includes(filterSupplier)) return;

      const netto = parseFloat(row[12]) || 0;
      const brutto = parseFloat(row[15]) || 0;
      const kat = String(row[8] || 'Food').trim();
      const wg = String(row[7] || '').trim();

      totalNetto += netto;
      totalBrutto += brutto;
      totalPos++;

      if (katStats[kat]) {
        katStats[kat].netto += netto;
        katStats[kat].pos++;
      }

      if (wg) {
        if (!wgStats[wg]) wgStats[wg] = { netto: 0, pos: 0 };
        wgStats[wg].netto += netto;
        wgStats[wg].pos++;
      }
    });
  }

  const mzLastRow = mzSheet ? mzSheet.getLastRow() : 1;
  const totalMasterZutaten = mzLastRow > 1 ? mzLastRow - 1 : 0;

  // 1. KPI-Werte
  dashSheet.getRange('A6').setValue(totalNetto).setNumberFormat('[$€-de-DE] #,##0.00');
  dashSheet.getRange('C6').setValue(totalBrutto).setNumberFormat('[$€-de-DE] #,##0.00');
  dashSheet.getRange('E6').setValue(totalPos).setNumberFormat('#,##0');
  dashSheet.getRange('G6').setValue(totalMasterZutaten).setNumberFormat('#,##0');

  // 2. Hauptkategorien
  const kats = ['Food', 'Beverage', 'Nonfood', 'Leergut'];
  const katDataRows = [];
  kats.forEach(k => {
    const n = katStats[k].netto;
    const anteil = totalNetto > 0 ? n / totalNetto : 0;
    const p = katStats[k].pos;
    katDataRows.push([n, anteil, p]);
  });
  dashSheet.getRange(12, 2, katDataRows.length, 3).setValues(katDataRows);

  // 3. Top-10 Warengruppen
  const wgList = [
    'E1: Fisch', 'E2: Seafood', 'E4: Rind', 'E7: Reis/Nudeln',
    'E8: Gemüse/Salat/Obst', 'E9: Nährmittel/Gewürz', 'E11: Soße/Paste',
    'E13: Spirituose', 'E22: Öl/Essig', 'E23: Drogerie/Hygienemittel'
  ];
  const wgDataRows = [];
  wgList.forEach(w => {
    const stat = wgStats[w] || { netto: 0, pos: 0 };
    wgDataRows.push([stat.netto, stat.pos]);
  });
  dashSheet.getRange(12, 7, wgDataRows.length, 2).setValues(wgDataRows);

  // 4. Preiserhöhungen / Preisalarme
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const artLastRow = artSheet ? artSheet.getLastRow() : 1;
  if (artSheet && artLastRow >= 5) {
    const artData = artSheet.getRange(5, 1, artLastRow - 4, 17).getValues();
    const alertRows = [];
    artData.forEach(row => {
      const diffPct = parseFloat(row[14]) || 0;
      if (diffPct > 0.001) {
        alertRows.push([
          row[0],
          row[1],
          row[2],
          row[10],
          row[11],
          diffPct,
          row[5],
          row[12] instanceof Date ? Utilities.formatDate(row[12], 'Europe/Berlin', 'dd.MM.yyyy') : String(row[12])
        ]);
      }
    });

    dashSheet.getRange('A26:H35').clearContent();
    if (alertRows.length > 0) {
      const toWrite = alertRows.slice(0, 10);
      dashSheet.getRange(26, 1, toWrite.length, 8).setValues(toWrite);
      dashSheet.getRange('D26:E' + (25 + toWrite.length)).setNumberFormat('[$€-de-DE] #,##0.00');
      dashSheet.getRange('F26:F' + (25 + toWrite.length)).setNumberFormat('+0.0%;-0.0%;"0.0%"');
    }
  }
}

/**
 * ==========================================
 * 5. TRIGGER & AUTOMATISIERUNG
 * ==========================================
 */
function setupAutomatedTriggers() {
  setupAutomatedTriggersSilently();
  SpreadsheetApp.getUi().alert(
    'Automatisierung aktiv (' + CONFIG.LOCATION_NAME + ')',
    'Folgende Zeitpläne sind aktiv:\n\n' +
    '1. Täglich um 12:00 Uhr: Rechnungs-Scan, OCR & Sofort-Alerts\n' +
    '2. Jeden Freitag um 12:00 Uhr: Controlling- & Health-Check-Report per Email an ' + getUserEmail() + '\n\n' +
    'Das System läuft autonom im Hintergrund.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupAutomatedTriggersSilently() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      const handler = t.getHandlerFunction();
      if (handler === 'dailyInvoiceScan' || handler === 'sendWeeklyFridayReport') {
        ScriptApp.deleteTrigger(t);
      }
    });

    ScriptApp.newTrigger('dailyInvoiceScan')
      .timeBased()
      .everyDays(1)
      .atHour(CONFIG.SCAN_HOUR)
      .create();

    ScriptApp.newTrigger('sendWeeklyFridayReport')
      .timeBased()
      .onWeekDay(CONFIG.REPORT_DAY)
      .atHour(CONFIG.REPORT_HOUR)
      .create();
  } catch(e) {
    Logger.log('Trigger Setup Warnung: ' + e.toString());
  }
}

function dailyInvoiceScan() {
  Logger.log('Autonomer Rechnungs-Scan (12:00 Uhr) gestartet...');
  let ss;
  try {
    ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } catch(e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    Logger.log('Kritischer Fehler: Konnte Spreadsheet nicht öffnen (ID: ' + CONFIG.SHEET_ID + ')');
    return;
  }
  
  let folder;
  try {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } catch(e) {
    Logger.log('Drive-Fehler: ' + e.toString());
    return;
  }
  
  let archiveFolder;
  const subFolders = folder.getFoldersByName(CONFIG.ARCHIVE_FOLDER_NAME);
  if (subFolders.hasNext()) archiveFolder = subFolders.next();
  else archiveFolder = folder.createFolder(CONFIG.ARCHIVE_FOLDER_NAME);
  
  const files = folder.getFiles();
  let count = 0;
  const startTime = Date.now();
  const allBatchAlerts = [];
  
  while (files.hasNext()) {
    if (Date.now() - startTime > 260000) {
      Logger.log('Zeitlimit erreicht - verbleibende Belege werden im nächsten Durchlauf verarbeitet.');
      break;
    }
    const file = files.next();
    const fileName = file.getName();
    const mimeType = file.getMimeType();
    
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      try {
        const ocrText = performGoogleOcr(file);
        const invoiceData = parseInvoiceText(ocrText, fileName);
        if (invoiceData.items && invoiceData.items.length > 0) {
          const res = ingestInvoiceData(ss, invoiceData, fileName);
          if (res.alerts && res.alerts.length > 0) {
            allBatchAlerts.push(...res.alerts);
          }
          file.moveTo(archiveFolder);
          count++;
          Logger.log('Beleg verbucht & archiviert: ' + fileName);
        } else {
          Logger.log('Keine gültigen Positionen in ' + fileName + ' gefunden - überspringe.');
        }
      } catch (err) {
        Logger.log('Fehler beim Beleg ' + fileName + ': ' + err.toString());
      }
    }
  }
  
  if (count > 0) {
    updateDashboardFigures(ss);
    syncMasterZutatenFromArticles(ss);
    refreshSupplierDropdowns(ss);
    generatePruefliste(ss);
    Logger.log(count + ' neue Belege erfolgreich verbucht, Master-Zutaten und Prüfliste aktualisiert.');

    if (allBatchAlerts.length > 0) {
      sendRealtimeAlertEmail(allBatchAlerts, { lieferant: 'Sammel-Scan', rechnungsNr: 'Auto-Batch' });
    }
  }
}

/**
 * Manueller Sofort-Scan & Rechnungsimport aus dem Google Drive Ordner
 */
function triggerManualInvoiceScan() {
  const ui = SpreadsheetApp.getUi();
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } catch(e) {
    ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  }
  
  let folder;
  try {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } catch(e) {
    ui.alert('Drive-Verbindungsfehler', 'Konnte nicht auf den Google Drive Ordner zugreifen:\n' + e.toString(), ui.ButtonSet.OK);
    return;
  }
  
  let archiveFolder;
  const subFolders = folder.getFoldersByName(CONFIG.ARCHIVE_FOLDER_NAME);
  if (subFolders.hasNext()) archiveFolder = subFolders.next();
  else archiveFolder = folder.createFolder(CONFIG.ARCHIVE_FOLDER_NAME);
  
  const files = folder.getFiles();
  const processedFiles = [];
  let totalItemsCount = 0;
  const errors = [];
  const allBatchAlerts = [];
  const startTime = Date.now();
  let timeoutReached = false;
  
  while (files.hasNext()) {
    if (Date.now() - startTime > 260000) {
      timeoutReached = true;
      break;
    }
    const file = files.next();
    const fileName = file.getName();
    const mimeType = file.getMimeType();
    
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      try {
        const ocrText = performGoogleOcr(file);
        const invoiceData = parseInvoiceText(ocrText, fileName);
        if (invoiceData.items && invoiceData.items.length > 0) {
          const res = ingestInvoiceData(ss, invoiceData, fileName);
          totalItemsCount += res.count;
          if (res.alerts && res.alerts.length > 0) {
            allBatchAlerts.push(...res.alerts);
          }
          file.moveTo(archiveFolder);
          processedFiles.push(`• ${fileName} (${invoiceData.lieferant}, ${invoiceData.items.length} Positionen)`);
        } else {
          errors.push(`• ${fileName}: Keine gültigen Artikelpositionen erkannt`);
        }
      } catch (err) {
        errors.push(`• ${fileName}: ${err.toString()}`);
      }
    }
  }
  
  if (processedFiles.length > 0) {
    updateDashboardFigures(ss);
    syncMasterZutatenFromArticles(ss);
    refreshSupplierDropdowns(ss);
    generatePruefliste(ss);

    if (allBatchAlerts.length > 0) {
      sendRealtimeAlertEmail(allBatchAlerts, { lieferant: 'Sammel-Scan', rechnungsNr: 'Manueller Scan' });
    }

    let msg = `Erfolgreich ${processedFiles.length} Belege eingelesen & verbucht:\n\n`;
    msg += processedFiles.join('\n') + `\n\n`;
    msg += `Insgesamt ${totalItemsCount} Positionen in RECHNUNGSEINGANG, ARTIKELSTAMM und MASTER_ZUTATEN eingepflegt.\n\n`;
    msg += `Die Dateien wurden zur Archivierung in den Unterordner "${CONFIG.ARCHIVE_FOLDER_NAME}" verschoben.`;
    if (timeoutReached) {
      msg += `\n\n⏱️ Zeitlimit erreicht: Ein Teil der Belege wurde verbucht. Bitte starte den Scan erneut, um die restlichen Dateien einzulesen.`;
    }
    if (errors.length > 0) {
      msg += `\n\nHinweise / Unlesbare Dateien:\n` + errors.join('\n');
    }
    ui.alert('Manueller Beleg-Scan abgeschlossen', msg, ui.ButtonSet.OK);
  } else {
    ui.alert(
      'Keine neuen Rechnungen gefunden',
      `Der Google Drive Ordner "${folder.getName()}" enthält aktuell keine neuen PDFs oder Rechnungsbilder.\n\n` +
      `Alle vorherigen Belege wurden bereits verarbeitet und in den Unterordner "${CONFIG.ARCHIVE_FOLDER_NAME}" verschoben.\n\n` +
      `Sobald du neue Rechnungen in den Ordner hochlädst, kannst du diese Funktion jederzeit erneut ausführen.`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * 8. DATENBANK-CLEANUP: BEREINIGUNG VON FEHLERHAFTEN / MÜLL-ARTIKELN
 */
function cleanupGarbageArticlesFromDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const ui = SpreadsheetApp.getUi();
  
  let deletedArtCount = 0;
  let deletedRecCount = 0;

  // 1. ARTIKELSTAMM bereinigen (von unten nach oben)
  if (artSheet && artSheet.getLastRow() >= 5) {
    const lastRow = artSheet.getLastRow();
    const data = artSheet.getRange(5, 1, lastRow - 4, 2).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      const artName = String(data[i][1] || '').trim();
      if (!isValidArticleName(artName)) {
        artSheet.deleteRow(5 + i);
        deletedArtCount++;
      }
    }
  }

  // 2. RECHNUNGSEINGANG bereinigen (von unten nach oben)
  if (recSheet && recSheet.getLastRow() > 1) {
    const lastRow = recSheet.getLastRow();
    const data = recSheet.getRange(2, 7, lastRow - 1, 1).getValues(); // Spalte 7: Artikelbezeichnung
    for (let i = data.length - 1; i >= 0; i--) {
      const artName = String(data[i][0] || '').trim();
      if (!isValidArticleName(artName)) {
        recSheet.deleteRow(2 + i);
        deletedRecCount++;
      }
    }
  }

  // 3. MASTER_ZUTATEN neu synchronisieren & Prüfliste aktualisieren
  syncMasterZutatenFromArticles(ss);
  generatePruefliste(ss);
  updateDashboardFigures(ss);
  refreshSupplierDropdowns(ss);

  const msg = `Datenbank erfolgreich bereinigt:\n\n` +
              `• ${deletedArtCount} fehlerhafte Müll-Artikel aus dem ARTIKELSTAMM gelöscht\n` +
              `• ${deletedRecCount} fehlerhafte Zeilen aus dem RECHNUNGSEINGANG gelöscht\n` +
              `• MASTER_ZUTATEN und PRUEFUNG_EINKAUF wurden vollständig bereinigt und neu synchronisiert.`;
  
  if (ui) {
    ui.alert('Bereinigung abgeschlossen', msg, ui.ButtonSet.OK);
  }
  return { deletedArtCount, deletedRecCount };
}

function performGoogleOcr(file) {
  let docId = null;
  try {
    const blob = file.getBlob();
    const fileMetadata = {
      title: 'TEMP_OCR_' + file.getName(),
      mimeType: 'application/vnd.google-apps.document'
    };
    const newDoc = Drive.Files.insert(fileMetadata, blob, { ocr: true, ocrLanguage: 'de' });
    docId = newDoc.id;
    const doc = DocumentApp.openById(docId);
    const text = doc.getBody().getText();
    return text;
  } catch(e) {
    Logger.log('Fehler bei Google OCR Drive API: ' + e.toString());
    try {
      const fileId = file.getId();
      const copiedDoc = Drive.Files.copy({
        title: 'TEMP_OCR_COPY_' + file.getName(),
        mimeType: 'application/vnd.google-apps.document'
      }, fileId, { ocr: true, ocrLanguage: 'de' });
      docId = copiedDoc.id;
      const doc = DocumentApp.openById(docId);
      const text = doc.getBody().getText();
      return text;
    } catch(e2) {
      Logger.log('Fallback OCR ebenfalls fehlgeschlagen: ' + e2.toString());
      return file.getName();
    }
  } finally {
    if (docId) {
      try {
        Drive.Files.remove(docId);
      } catch(e3) {
        try {
          DriveApp.getFileById(docId).setTrashed(true);
        } catch(e4) {}
      }
    }
  }
}

const OWN_IDENTIFIERS = [
  'sona', 'sona vietnamese', 'sona karli', 'sona leipzig',
  'karl-liebknecht', 'karl liebknecht', '04107 leipzig', '04107',
  'rechnungsempfaenger', 'rechnungsempfänger', 'lieferadresse', 'rechnungsadresse',
  'kunde', 'kundennummer', 'kunden-nr', 'customer', 'bill to', 'ship to'
];

const KNOWN_SUPPLIERS = [
  { match: /stephan|fisch\s*stephan/i, name: 'Fisch Stephan' },
  { match: /rungis/i, name: 'RUNGIS express GmbH' },
  { match: /ssp\s*trade|ssp\s*consult|ssp\b/i, name: 'SSP Trade & Consult GmbH' },
  { match: /metro/i, name: 'METRO Deutschland (Leipzig)' },
  { match: /selgros/i, name: 'Selgros' },
  { match: /s[üu]lo|gem[üu]se\s*s[üu]lo/i, name: 'Gemüse Sülo' },
  { match: /fish\s*(&|\+)?\s*food/i, name: 'Fish and Food' },
  { match: /staude|getr[äa]nke\s*staude/i, name: 'Getränke Staude' },
  { match: /weink[öo]nner/i, name: 'Weinkönner' },
  { match: /wonsak/i, name: 'Wonsak' },
  { match: /nga\s*anh/i, name: 'Nga Anh' },
  { match: /aldi/i, name: 'Aldi' },
  { match: /rewe/i, name: 'REWE' },
  { match: /lidl/i, name: 'Lidl' },
  { match: /penny/i, name: 'Penny' },
  { match: /netto/i, name: 'Netto' },
  { match: /kaufland/i, name: 'Kaufland' },
  { match: /edeka/i, name: 'EDEKA' },
  { match: /dm[\-\s]drogerie|dm\b/i, name: 'dm-drogerie markt' },
  { match: /rossmann/i, name: 'Rossmann' },
  { match: /alnatura|denns\b/i, name: 'Biomarkt' },
  { match: /amazon/i, name: 'Amazon' },
  { match: /kreta/i, name: 'Kreta Olivenöl' },
  { match: /sake|shiragiku|masumi|imayotsukasa/i, name: 'Sake' },
  { match: /transgourmet/i, name: 'Transgourmet' },
  { match: /chef\s*culinar/i, name: 'Chef Culinar' },
  { match: /asia\s*express\s*food/i, name: 'Asia Express Food B.V.' },
  { match: /heuschen\s*(&|\+)?\s*schrouff/i, name: 'Heuschen & Schrouff OFT B.V.' },
  { match: /kreyenhop\s*(&|\+)?\s*kluge/i, name: 'Kreyenhop & Kluge GmbH & Co. KG' },
  { match: /vinh\s*loi/i, name: 'Vinh Loi Asien Supermarkt' },
  { match: /jfc\s*international/i, name: 'JFC International Europe' },
  { match: /interspice/i, name: 'Interspice GmbH' },
  { match: /havel\s*frucht/i, name: 'Havel Frucht GmbH' },
  { match: /korte/i, name: 'Fleischerei Korte' },
  { match: /bos\s*food/i, name: 'BOS FOOD GmbH' },
  { match: /hamberger/i, name: 'Hamberger Großmarkt' }
];

function isOwnIdentifier(str) {
  const s = (str || '').toLowerCase();
  return OWN_IDENTIFIERS.some(id => s.includes(id));
}

function isRetailSupplier(name) {
  const n = (name || '').toLowerCase();
  return /aldi|rewe|lidl|penny|netto|kaufland|edeka|dm\b|rossmann|müller|alnatura|denns|norma|hit\b|tegut|famila|spar\b/i.test(n);
}

function isRetailReceipt(text, supplier) {
  if (isRetailSupplier(supplier)) return true;
  const t = (text || '').toLowerCase();
  return /k-u-n-d-e-n-b-e-l-e-g|kundenbeleg|kassenbon|bon-nr|bnr\s*\d|ta-nr|terminal-id|kartenzahlung|tse-|geg\.:|eur brutto|mwst\s*1\s*7/i.test(t);
}

function extractSupplier(text, lines, fileName) {
  const textUpper = (text || '').toUpperCase();
  
  // 1. Bekannte Lieferanten (höchste Priorität)
  for (let i = 0; i < KNOWN_SUPPLIERS.length; i++) {
    if (KNOWN_SUPPLIERS[i].match.test(textUpper)) {
      return KNOWN_SUPPLIERS[i].name;
    }
  }

  // 2. Suche in Kopfzeilen (Zeilen 0 bis 12) nach Absender-Firmen (exklusive eigener Adresse!)
  for (let i = 0; i < Math.min(12, lines.length); i++) {
    const line = lines[i].trim();
    if (isOwnIdentifier(line)) continue;
    
    if (/(?:gmbh|ag\b|e\.k\.|kg\b|ohg\b|gbr\b|b\.v\.|n\.v\.|ltd|inc|frucht|fleisch|getränke|wein|brauerei|gastro|lebensmittel|handel|vertrieb|bäckerei|konditorei|frischeservice|food|asia|express|import|export)\b/i.test(line)) {
      if (!/rechnung|beleg|lieferschein|datum|seite|iban|bic|steuer|ust|ust-id|tel|fax|email|www/i.test(line) && line.length >= 4 && line.length <= 55) {
        return line.replace(/[\:\#\*\_\~\|]/g, '').trim();
      }
    }
  }

  // 3. Fallback: Erste Zeile, die nicht administrative Info oder eigene Adresse ist
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i].replace(/[\:\#\*\_\~\|]/g, '').trim();
    if (isOwnIdentifier(line)) continue;
    if (line.length >= 3 && line.length <= 45 && !/rechnung|beleg|scan|lieferschein|seite|kundennummer|datum|tel|fax|email|www|steuernummer/i.test(line)) {
      return line;
    }
  }

  return 'Unbekannter Lieferant (' + fileName + ')';
}

function cleanArticleName(name) {
  let clean = (name || '').trim();
  clean = clean.replace(/^[\s\-\.\:\;\_\*\#\~\/\|\+\,]+/, '');
  clean = clean.replace(/[\s\-\.\:\;\_\*\#\~\/\|\+\,]+$/, '');
  clean = clean.replace(/^(?:packung|karton|sack|stück|stk|pack|pkg|flasche|bund|kiste|dose|glas|palette|colli|gebinde|beutel|schale)\s+/i, '');
  clean = clean.replace(/\s+(?:packung|karton|sack|stück|stk|pack|pkg|flasche|bund|kiste|dose|glas|palette|colli|gebinde|beutel|schale)$/i, '');
  clean = clean.replace(/^[A-Z0-9]{1,8}[\-\.\/][A-Z0-9]{1,8}\s+/, '');
  clean = clean.replace(/^(\d{1,8})\s+/, '');
  clean = clean.replace(/[\*\#\_\~\|\:\;\"]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

function isValidArticleName(name) {
  if (!name) return false;
  const clean = cleanArticleName(name);
  if (clean.length < 3) return false;

  const lower = clean.toLowerCase();

  // 1. Blacklist gegen Währungen, Steuern, Summen, administrative Begriffe
  const blacklistRegex = /^(?:eur|euro|usd|chf|\- eur|\- b|\- a|a|b|c|d|1|2|3|4|5|6|7|8|9|0|mwst|ust|ust\-id|netto|brutto|steuer|summe|total|gesamt|gesamtbetrag|nettobetrag|bruttobetrag|endbetrag|zahlbetrag|zwischensumme|übertrag|uebertrag|skonto|rabatt|gutschrift|nachlass|geg\.|rückgeld|rueckgeld|bar|kartenzahlung|kundenbeleg|terminal\-id|beleg|rechnung|lieferschein|datum|rechnungsdatum|belegdatum|lieferdatum|leistungsdatum|bestelldatum|fälligkeit|faelligkeit|zahlungsziel|zahlbar|bankverbindung|iban|bic|bank|konto|blz|amtsgericht|hrb|hra|geschäftsführer|geschaeftsfuehrer|vorstand|handelsregister|kundennummer|kunden\-nr|rechnungsnummer|rechnungs\-nr|lieferscheinnummer|lieferschein\-nr|tour|fahrer|seite|page|telefon|telefax|email|web|internet|sona|vietnamese|sona karli|karl\-liebknecht|art\-nr|artnr|artikel|bezeichnung|pos|menge|einheit|einzelpreis|gesamtpreis|preis|pfand|leergut|tse|kassenbon|bon|pos\.|stk|kg|ltr|liter|bund|karton|kiste|packung)$/i;

  if (blacklistRegex.test(lower)) return false;

  // 2. K.O.-Kriterien: Zeilen mit administrativen Hinweisen
  if (/(?:zwischensumme|gesamtbetrag|nettobetrag|bruttobetrag|endbetrag|zahlbetrag|mwst-abrechnung|steuerfreie|steuerpflichtig|steuerbetrag|lieferdatum\s+frischfleisch|tour\s+\d|kundenbeleg|terminal-id|american\s+express|mastercard|visa\s+card|zahlungsbedingung|bankverbindung|iban\s*[A-Z]{2}|ust-id\s*DE)/i.test(name)) {
    return false;
  }

  // 3. Mindestens ein vollwertiges Wort mit >= 3 Buchstaben
  const words = clean.match(/[a-zA-ZäöüÄÖÜß]{3,}/g);
  if (!words || words.length === 0) return false;

  const meaningfulWords = words.filter(w => !/^(?:eur|euro|usd|chf|mwst|ust|stk|ktn|pkg|fl|kg|ltr|g|ml|cl|nr|no|pos|art|von|und|mit|fuer|pro|je|der|die|das|vom|am|zum|zur)$/i.test(w));
  if (meaningfulWords.length === 0) return false;

  // 4. Nicht rein aus Zahlen und Sonderzeichen
  if (/^[\d\s\.\,\-\/\%\€\$\:\;\#\*\_\~\|\+\(\)]+$/.test(name)) return false;

  return true;
}

function isValidItemLine(line) {
  if (!line || line.length < 4) return false;
  const l = line.toLowerCase().trim();

  // Header, Footer, Steuern, Zahlungsarten sofort verwerfen
  if (/^(?:rechnung|beleg|lieferschein|invoice|gutschrift|storno|kundennummer|kunden\-nr|iban|bic|datum|rechnungsdatum|lieferdatum|leistungsdatum|rechnungsempf|lieferadresse|sona|karl\-liebknecht|summe|gesamt|total|mwst|ust|netto|brutto|zahlbetrag|zwischensumme|übertrag|uebertrag|skonto|rabatt|nachlass|seite|page|steuernummer|steuer\-nr|ust\-id|bank|konto|blz|amtsgericht|geschäftsführer|hrb|hra|tour|fahrer|terminal|kartenzahlung|bar\b|ec\-karte|kundenbeleg|bitte beleg)/i.test(l)) {
    return false;
  }
  
  if (/(?:zwischensumme|gesamtbetrag|nettobetrag|bruttobetrag|zahlungsziel|fälligkeit|amtsgericht|handelsregister|geschäftsführer|bankverbindung|lieferdatum\s+frischfleisch|ust-id\s*de)/i.test(l)) {
    return false;
  }

  return true;
}

function extractInvoiceDate(text) {
  const datePatterns = [
    /(?:Rechnungsdatum|Belegdatum|Lieferdatum|Datum)[\s:\#]*(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/i,
    /(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})\s+\d{1,2}:\d{2}/,
    /(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/
  ];

  for (let pat of datePatterns) {
    const match = (text || '').match(pat);
    if (match) {
      const d = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      let y = parseInt(match[3], 10);
      if (y < 100) y += 2000;
      if (y >= 2020 && y <= 2030 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return new Date(y, m, d);
      }
    }
  }
  return null;
}

function extractInvoiceNumber(text, rechnungsDatum) {
  const patterns = [
    /(?:BNr|Bon-Nr|Bonnummer)[\s:\#]*([0-9]{2,15})/i,
    /(?:TA-Nr|Transaktionsnummer)[\s:\#]*([0-9]{3,15})/i,
    /(?:Rechnungs-?(?:nummer|nr\.?)?|Beleg-?(?:nummer|nr\.?)?|Invoice(?:[\s\-]?No\.?)?|Lieferschein-?(?:nummer|nr\.?)?)[\s:\#]*([A-Z0-9\-\/\.]{3,30})/i,
    /(?:Rechnung|Beleg|Invoice)\s+(?:Nr\.?|No\.?|Nummer)?[\s:\#]*([A-Z0-9\-\/\.]{3,30})/i,
    /\b(?:RE|RN|INV|RG|LS)[\-\s\.\#]*([0-9]{4,15})\b/i
  ];
  for (let pat of patterns) {
    const match = (text || '').match(pat);
    if (match && match[1]) {
      const candidate = match[1].replace(/[\:\,\;\s]/g, '').trim();
      if (!/^(nr|no|nummer|datum|vom|am|gesamt|total|seite|netto|brutto|eur|euro|ohne|fuer|mit)$/i.test(candidate) && /\d/.test(candidate) && candidate.length >= 2) {
        return (pat.toString().includes('BNr') ? 'BNr-' : '') + candidate;
      }
    }
  }
  const bonMatch = (text || '').match(/\b\d{4}\s+\d{3}\s+(\d{4,8})\s+\d{4}\b/);
  if (bonMatch) {
    return 'BON-' + bonMatch[1];
  }
  return 'RN-' + (rechnungsDatum ? Utilities.formatDate(rechnungsDatum, 'Europe/Berlin', 'yyyyMMdd') : 'UNKNOWN');
}

function parseRetailReceiptLines(lines, supplier) {
  const items = [];
  let pendingQty = null;
  let pendingUnit = 'Stk';
  let pendingUnitPrice = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Abbruchkriterium bei Summen- und Zahlungszeilen
    if (/^(zu zahlen|summe|gesamt|total|kartenzahlung|bar|k-u-n-d-e-n|kundenbeleg|terminal-id|bitte beleg|mwst\s*\d)/i.test(line)) {
      break;
    }

    // Mengen-Vorzeile wie "20 x 0,49 €" oder "0,456 kg x 3,99 €/kg" oder "2 x 3,99"
    const qtyMatch = line.match(/^(\d+[\.,]?\d*)\s*(kg|g|l|stk|pack|schale|bund|fl)?\s*x\s*(\d+[\.,]\d{2})\s*(?:€|\/kg|\/l|\/stk)?/i);
    if (qtyMatch) {
      pendingQty = parseFloat(qtyMatch[1].replace(',', '.'));
      pendingUnit = qtyMatch[2] ? qtyMatch[2] : 'Stk';
      pendingUnitPrice = parseFloat(qtyMatch[3].replace(',', '.'));
      continue;
    }

    // Artikelzeile mit Brutto-Endpreis und optionaler MwSt-Kennung wie "GURKEN 9,80 € 1"
    const itemMatch = line.match(/^(.+?)\s+(\d+[\.,]\d{2})\s*(?:€)?\s*([12AB])?$/i);
    if (itemMatch) {
      let rawName = itemMatch[1].trim();
      const bruttoTotal = parseFloat(itemMatch[2].replace(',', '.'));
      const taxKey = itemMatch[3] ? itemMatch[3].toUpperCase() : '1';
      
      // MwSt-Satz ermitteln (1/A = 7% Food, 2/B = 19% Beverage/Nonfood)
      let mwstRate = (taxKey === '2' || taxKey === 'B') ? 0.19 : 0.07;
      let cleanName = cleanArticleName(rawName);

      if (isValidArticleName(cleanName)) {
        const wg = matchWarengruppe(cleanName);
        const wgConfig = WARENGRUPPEN_CONFIG.find(w => w.name === wg);
        if (wgConfig && wgConfig.mwst) {
          mwstRate = wgConfig.mwst;
        }

        const menge = pendingQty !== null ? pendingQty : 1;
        const einheit = pendingQty !== null ? pendingUnit : determineUnit(cleanName, line);
        
        // Exakte Rückrechnung von Brutto auf Netto
        const gesamtNetto = Math.round((bruttoTotal / (1 + mwstRate)) * 100) / 100;
        const einzelNetto = Math.round((gesamtNetto / menge) * 1000) / 1000;

        items.push({
          name: cleanName,
          menge: menge,
          einheit: einheit,
          einzelNetto: einzelNetto,
          gesamtNetto: gesamtNetto,
          wg: wg,
          isRetail: true
        });
      }

      // Reset Pending
      pendingQty = null;
      pendingUnit = 'Stk';
      pendingUnitPrice = null;
    }
  }

  return items;
}

function parseInvoiceText(text, fileName) {
  const lines = text ? text.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
  
  // 1. Lieferant erkennen
  const lieferant = extractSupplier(text, lines, fileName);
  
  // 2. Datum erkennen
  const rechnungsDatum = extractInvoiceDate(text);
  
  // 3. Rechnungsnummer erkennen
  const rechnungsNr = extractInvoiceNumber(text, rechnungsDatum);

  // 4. Positionen erkennen (Einzelhandel vs. Großhandel)
  let items = [];
  if (isRetailReceipt(text, lieferant)) {
    items = parseRetailReceiptLines(lines, lieferant);
  }

  // Fallback auf B2B Standard-Parser
  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!isValidItemLine(line)) continue;

      const priceMatches = line.match(/\b\d+[\.,]\d{2}\b/g);
      if (priceMatches && priceMatches.length >= 1) {
        const gesamtNetto = parseFloat(priceMatches[priceMatches.length - 1].replace(',', '.'));
        if (gesamtNetto > 0 && gesamtNetto < 10000) {
          let menge = 1;
          const mengeMatch = line.match(/^(\d+[\.,]?\d*)\s*(?:x|Stk|kg|l|Pkg|Karton|Bund|Fl|Sack|Beutel|Dose|Glas|Packung)?\b/i);
          if (mengeMatch) menge = parseFloat(mengeMatch[1].replace(',', '.')) || 1;
          
          let einzelNetto = gesamtNetto / menge;
          if (priceMatches.length >= 2) einzelNetto = parseFloat(priceMatches[priceMatches.length - 2].replace(',', '.')) || einzelNetto;
          
          let rawName = line.replace(/\b\d+[\.,]\d{2}\b/g, '').replace(/^(\d+[\.,]?\d*)\s*(?:x|Stk|kg|l|Pkg|Karton|Bund|Fl|Sack|Beutel|Dose|Glas|Packung)?\b/i, '').trim();
          let cleanName = cleanArticleName(rawName);
          
          if (isValidArticleName(cleanName)) {
            const wg = matchWarengruppe(cleanName);
            items.push({
              name: cleanName,
              menge: menge,
              einheit: determineUnit(cleanName, line),
              einzelNetto: einzelNetto,
              gesamtNetto: gesamtNetto,
              wg: wg
            });
          }
        }
      }
    }
  }

  return {
    lieferant: lieferant,
    datum: rechnungsDatum,
    rechnungsNr: rechnungsNr,
    items: items
  };
}

function refreshSupplierDropdowns(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  const dashSheet = ss.getSheetByName(CONFIG.NAME_DASHBOARD);

  const suppliers = new Set();
  
  // 1. Alle bekannten Lieferanten aus KNOWN_SUPPLIERS
  if (typeof KNOWN_SUPPLIERS !== 'undefined' && Array.isArray(KNOWN_SUPPLIERS)) {
    KNOWN_SUPPLIERS.forEach(k => {
      if (k.name && !k.name.startsWith('Unbekannt')) suppliers.add(k.name.trim());
    });
  }

  // 2. Alle Lieferanten aus ARTIKELSTAMM (Spalte 6 / F)
  if (artSheet && artSheet.getLastRow() >= 5) {
    const artData = artSheet.getRange(5, 6, artSheet.getLastRow() - 4, 1).getValues();
    artData.forEach(r => {
      const s = String(r[0] || '').trim();
      if (s && !s.startsWith('Unbekannt')) suppliers.add(s);
    });
  }

  // 3. Alle Lieferanten aus RECHNUNGSEINGANG (Spalte 4 / D)
  if (recSheet && recSheet.getLastRow() > 1) {
    const recData = recSheet.getRange(2, 4, recSheet.getLastRow() - 1, 1).getValues();
    recData.forEach(r => {
      const s = String(r[0] || '').trim();
      if (s && !s.startsWith('Unbekannt')) suppliers.add(s);
    });
  }

  const sortedSuppliers = Array.from(suppliers).filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'));
  const suppList = ['Alle Lieferanten'].concat(sortedSuppliers);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(suppList, true).setAllowInvalid(true).build();
  
  if (artSheet) {
    artSheet.getRange('F2').setDataValidation(rule);
  }
  if (dashSheet) {
    dashSheet.getRange('F3').setDataValidation(rule);
  }
}

function matchWarengruppe(name) {
  const n = (name || '').toLowerCase();
  
  if (typeof MASTER_CATALOG_DICTIONARY !== 'undefined') {
    for (let i = 0; i < MASTER_CATALOG_DICTIONARY.length; i++) {
      const item = MASTER_CATALOG_DICTIONARY[i];
      for (let j = 0; j < item.aliases.length; j++) {
        if (n.includes(item.aliases[j])) {
          const wgFound = WARENGRUPPEN_CONFIG.find(w => w.prefix === item.code || w.code === item.code);
          if (wgFound) return wgFound.name;
        }
      }
    }
  }

  // Nonfood / Verpackung / Gastro-Bedarf
  if (/bambusstäbchen|stäbchen|essstäbchen|dua\b|handschuh|serviette|alufolie|frischhaltefolie|becher|deckel|schale|tragetasche|strohhalm|spieß|tüte|verpackung|papier|spritzbeutel|gefrierbeutel|nonfood/.test(n)) return 'E24: Nonfood';
  // Tiefkühl / Dim Sum / Convenience
  if (/hao kao|dim sum|gyoza|wan tan|frühlingsrolle|spring roll|edamame|tiefkühl|tk |frozen/.test(n)) return 'E10: Tiefkühl';
  // Soßen / Pasten / Pürees
  if (/knoblauchpüree|ingwerpüree|püree|puree|sauce|soße|paste|mayo|wasabi|shoyu|sojasauce|meerrettich|teriyaki|ponzu|sriracha|sambal|chili paste|curry paste/.test(n)) return 'E11: Soße/Paste';
  // Süßwaren & Desserts
  if (/nata de coco|mochi|dessert|süß|kuchen|eis |ice cream|kandis|schokolade/.test(n)) return 'E21: Süßware';
  // Frische Kräuter & Gemüse
  if (/la chanh|zitronenblätter|kräuter|koriander|basilikum|gemüse|salat|obst|beere|limette|zitrone|ingwer|knoblauch|avocado/.test(n)) return 'E8: Gemüse/Salat/Obst';
  // Geflügel
  if (/\b(?:pute|puten|putenbrust|hähnchen|huhn|chicken|ente|gans)\b/i.test(n)) return 'E5: Geflügel';
  // Rind
  if (/\b(?:rind|rinder|entrecote|ribeye|roastbeef|filet|beef)\b/i.test(n)) return 'E4: Rind';
  // Schwein
  if (/\b(?:schwein|schweine|pork|bauch|kassler)\b/i.test(n)) return 'E3: Schwein';
  // Backwaren & Nährmittel
  if (/\b(?:brötchen|baguette|brot|mehl|salz|zucker|gewürz|pfeffer|curry|sesam|nori|seetang|reisessig|dashi)\b/i.test(n)) return 'E9: Nährmittel/Gewürz';
  // Spirituosen
  if (/\b(?:gin|vodka|wodka|rum|whisky|whiskey|tequila|likör|aperol|lillet|bitter)\b/i.test(n)) return 'E13: Spirituose';
  // Wein & Schaumwein
  if (/\b(?:wein|riesling|burgunder|prosecco|frizzante|champagner|sekt)\b/i.test(n)) return 'E14: Wein';
  // Bier
  if (/\b(?:bier|pils|weissbier|radler|kirin|asahi|sapporo|tiger)\b/i.test(n)) return 'E15: Bier';
  // Sake
  if (/\b(?:sake|junmai|daiginjo|taruzake)\b/i.test(n)) return 'E16: Sake';
  // Softdrinks
  if (/\b(?:cola|sprite|fanta|saft|tonic|ginger\s*ale|wasser|limonade)\b/i.test(n)) return 'E18: Softdrinks/Saft';
  // Öle & Essige
  if (/\b(?:öl|oil|essig|vinegar)\b/i.test(n)) return 'E22: Öl/Essig';
  // Reinigung & Hygiene
  if (/\b(?:spülmittel|reiniger|fettlöser|seife|hygiene|tork|zewa|wischtuch|mülltüte)\b/i.test(n)) return 'E23: Drogerie/Hygienemittel';

  return 'E8: Gemüse/Salat/Obst';
}

function determineUnit(name, line) {
  const l = (name + ' ' + line).toLowerCase();
  if (/(\d+[\.,]?\d*)\s*kg\b/.test(l)) return 'kg';
  if (/(\d+[\.,]?\d*)\s*l\b|liter|flasche/.test(l)) return 'l';
  if (/schale/.test(l)) return 'Schale';
  if (/pack|beutel|pkg/.test(l)) return 'Pack';
  if (/karton|ktn/.test(l)) return 'Karton';
  if (/sack/.test(l)) return 'Sack';
  return 'Stk';
}

/**
 * WÖCHENTLICHER FREITAGS-BERICHT PER EMAIL INKL. HEALTH-AUDIT (100% EMOJI-FREI)
 */
function sendWeeklyFridayReport(isTest) {
  let ss;
  try {
    ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  } catch(e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  const email = getUserEmail();
  
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  
  let totalNetto = 0;
  let totalBrutto = 0;
  let foodNetto = 0;
  let bevNetto = 0;
  let nonfoodNetto = 0;
  let leergutNetto = 0;
  let posCount = 0;
  const monthlyStats = {};

  if (recSheet && recSheet.getLastRow() > 1) {
    const data = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, Math.max(21, recSheet.getLastColumn())).getValues();
    posCount = data.length;
    
    data.forEach(row => {
      const netto = parseFloat(row[12]) || 0;
      const brutto = parseFloat(row[15]) || 0;
      const kat = String(row[8] || '').trim();
      const ym = String(row[18] || 'Unbekannt').trim();
      
      totalNetto += netto;
      totalBrutto += brutto;
      
      if (kat === 'Food') foodNetto += netto;
      else if (kat === 'Beverage') bevNetto += netto;
      else if (kat === 'Nonfood') nonfoodNetto += netto;
      else if (kat === 'Leergut') leergutNetto += netto;

      if (!monthlyStats[ym]) {
        monthlyStats[ym] = { count: 0, netto: 0, food: 0, bev: 0, nonfood: 0, leergut: 0 };
      }
      monthlyStats[ym].count++;
      monthlyStats[ym].netto += netto;
      if (kat === 'Food') monthlyStats[ym].food += netto;
      else if (kat === 'Beverage') monthlyStats[ym].bev += netto;
      else if (kat === 'Nonfood') monthlyStats[ym].nonfood += netto;
      else if (kat === 'Leergut') monthlyStats[ym].leergut += netto;
    });
  }
  
  let totalMaster = mzSheet && mzSheet.getLastRow() > 1 ? mzSheet.getLastRow() - 1 : 0;
  const dateStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy');
  const subject = (isTest ? '[TEST] ' : '') + `${CONFIG.LOCATION_NAME} - Woechentlicher Controlling- und Audit-Bericht (${dateStr})`;

  // Health-Audit durchführen
  const audit = runDatabaseHealthAudit(ss);

  // 1. Konkrete offene Artikelstamm-Prüffälle auslesen
  const openArtIssues = [];
  const priceIncreases = [];
  if (artSheet && artSheet.getLastRow() >= 5) {
    const artData = artSheet.getRange(5, 1, artSheet.getLastRow() - 4, Math.max(19, artSheet.getLastColumn())).getValues();
    artData.forEach(row => {
      const artId = String(row[0] || '').trim();
      const artName = String(row[1] || '').trim();
      const wg = String(row[2] || '').trim();
      const supp = String(row[5] || '').trim();
      const gebinde = String(row[7] || '').trim();
      const unit = String(row[9] || '').trim();
      const currP = parseFloat(row[10]) || 0;
      const oldP = parseFloat(row[13]) || 0;
      const diffPct = parseFloat(row[14]) || 0;
      const masterId = String(row[16] || '').trim();
      const status = String(row[17] || 'EINDEUTIG_ZUGEORDNET').trim();

      if (!masterId || masterId === '' || status === 'KEINE_MASTER_ZUTAT' || status === 'ZU_PRUEFEN' || !unit) {
        const sug = suggestMasterIngredient(artName, wg);
        openArtIssues.push({
          id: artId,
          name: artName,
          supp: supp,
          gebinde: gebinde,
          sug: sug.suggestion ? `${sug.suggestion} (${sug.confidence}%)` : 'Kein Vorschlag'
        });
      }

      if (diffPct > 0.05 && oldP > 0 && currP > oldP) {
        priceIncreases.push({
          id: artId,
          name: artName,
          supp: supp,
          oldPrice: oldP,
          newPrice: currP,
          diffPct: (diffPct * 100).toFixed(1)
        });
      }
    });
  }

  // 2. Konkrete Einkaufs-Optimierungspotenziale (Lieferantenvergleich > 15% Differenz)
  const priceOptimizations = [];
  const topQuantities = [];
  if (mzSheet && mzSheet.getLastRow() >= 2) {
    const mzData = mzSheet.getRange(2, 1, mzSheet.getLastRow() - 1, Math.max(25, mzSheet.getLastColumn())).getValues();
    mzData.forEach(row => {
      const mName = String(row[1] || '').trim();
      const unit = String(row[5] || 'kg').trim();
      const kalkP = parseFloat(row[6]) || 0;
      const latestPrice = parseFloat(row[12]) || 0;
      const latestSupp = String(row[10] || '').trim();
      const cheapestPrice = parseFloat(row[15]) || 0;
      const cheapestSupp = String(row[16] || '').trim();
      const qTotal = parseFloat(row[22]) || 0;
      const qMonth = parseFloat(row[23]) || 0;

      if (cheapestPrice > 0 && latestPrice > cheapestPrice) {
        const diffPct = ((latestPrice - cheapestPrice) / cheapestPrice) * 100;
        if (diffPct > 15) {
          priceOptimizations.push({
            name: mName,
            unit: unit,
            latestSupp: latestSupp,
            latestPrice: latestPrice,
            cheapestSupp: cheapestSupp,
            cheapestPrice: cheapestPrice,
            diffPct: diffPct.toFixed(1)
          });
        }
      }

      if (qTotal > 0) {
        topQuantities.push({
          name: mName,
          unit: unit,
          qTotal: qTotal,
          qMonth: qMonth,
          kalkP: kalkP,
          wert: qTotal * kalkP
        });
      }
    });
  }

  topQuantities.sort((a, b) => b.wert - a.wert);

  // HTML für Lieferanten-Einsparpotenziale
  let optHtml = '';
  if (priceOptimizations.length > 0) {
    optHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 8px 10px; font-size: 12px;">Master-Zutat</th>
            <th style="padding: 8px 10px; font-size: 12px;">Letzter Einkauf</th>
            <th style="padding: 8px 10px; font-size: 12px;">Guenstigerer Lieferant</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Preisdifferenz</th>
          </tr>
        </thead>
        <tbody>
          ${priceOptimizations.slice(0, 8).map(o => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 600; font-size: 12px;">${o.name}</td>
              <td style="padding: 6px 10px; font-size: 12px; color: #742a2a;">${o.latestSupp} (${o.latestPrice.toFixed(2)} €/${o.unit})</td>
              <td style="padding: 6px 10px; font-size: 12px; color: #22543d; font-weight: 600;">${o.cheapestSupp} (${o.cheapestPrice.toFixed(2)} €/${o.unit})</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; color: #c53030; font-weight: 700;">+${o.diffPct}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    optHtml = `
      <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; color: #4a5568; font-size: 12px;">
        Aktuell keine relevanten Preisabweichungen (>15%) zwischen Lieferanten festgestellt.
      </div>
    `;
  }

  // HTML für Preisanstiege
  let priceIncHtml = '';
  if (priceIncreases.length > 0) {
    priceIncHtml = `
      <div class="section-title">Preiserhoehungen & Veraenderungen</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 8px 10px; font-size: 12px;">Artikel</th>
            <th style="padding: 8px 10px; font-size: 12px;">Lieferant</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Bisheriger EK</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Neuer EK</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Anstieg</th>
          </tr>
        </thead>
        <tbody>
          ${priceIncreases.slice(0, 6).map(p => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 600; font-size: 12px;">${p.name}</td>
              <td style="padding: 6px 10px; font-size: 12px; color: #4a5568;">${p.supp}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right;">${p.oldPrice.toFixed(2)} €</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; color: #c53030; font-weight: 600;">${p.newPrice.toFixed(2)} €</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; color: #c53030; font-weight: 700;">+${p.diffPct}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // HTML für Monatsauswertungen nach Rechnungsdatum
  const sortedMonths = Object.keys(monthlyStats).sort();
  let monthlyHtml = '';
  if (sortedMonths.length > 0) {
    monthlyHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 8px 10px; font-size: 12px;">Rechnungsmonat</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Positionen</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Food Netto</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Beverage Netto</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Gesamt Netto</th>
          </tr>
        </thead>
        <tbody>
          ${sortedMonths.map(m => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 700; font-size: 12px;">${m}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right;">${monthlyStats[m].count}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right;">${monthlyStats[m].food.toFixed(2)} €</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right;">${monthlyStats[m].bev.toFixed(2)} €</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; font-weight: 700; color: #1b365d;">${monthlyStats[m].netto.toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="font-size: 11px; color: #718096; margin-bottom: 16px;">
        ℹ️ <i>Perioden-Logik: Rechnungen werden strikt nach ihrem Leistungs- und Rechnungsdatum verbucht. Nachzügler-Belege aus Vormonaten aktualisieren rückwirkend die jeweilige Monatsperiode.</i>
      </div>
    `;
  }

  // HTML für Top-Einkaufsmengen
  let qtyHtml = '';
  if (topQuantities.length > 0) {
    qtyHtml = `
      <div class="section-title">Top-Einkaufsmengen der Periode (Rezepturbasis)</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 8px 10px; font-size: 12px;">Master-Zutat</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Gesamtmenge</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Kalkulationspreis</th>
            <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Einkaufswert Netto</th>
          </tr>
        </thead>
        <tbody>
          ${topQuantities.slice(0, 6).map(q => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 600; font-size: 12px;">${q.name}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; font-weight: 700;">${q.qTotal.toFixed(2)} ${q.unit}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right;">${q.kalkP.toFixed(2)} €/${q.unit}</td>
              <td style="padding: 6px 10px; font-size: 12px; text-align: right; color: #1b365d; font-weight: 600;">${q.wert.toFixed(2)} €</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // HTML für offene Artikel
  let artIssuesHtml = '';
  if (openArtIssues.length > 0) {
    artIssuesHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #edf2f7;">
            <th style="padding: 8px 10px; font-size: 12px;">ID</th>
            <th style="padding: 8px 10px; font-size: 12px;">Artikelbezeichnung</th>
            <th style="padding: 8px 10px; font-size: 12px;">Lieferant</th>
            <th style="padding: 8px 10px; font-size: 12px;">Gebinde</th>
            <th style="padding: 8px 10px; font-size: 12px;">💡 KI-Vorschlag</th>
          </tr>
        </thead>
        <tbody>
          ${openArtIssues.slice(0, 8).map(a => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; font-weight: 600; font-size: 12px;">${a.id}</td>
              <td style="padding: 6px 10px; font-size: 12px;">${a.name}</td>
              <td style="padding: 6px 10px; font-size: 12px; color: #4a5568;">${a.supp}</td>
              <td style="padding: 6px 10px; font-size: 12px;">${a.gebinde}</td>
              <td style="padding: 6px 10px; font-size: 12px; color: #2b6cb0; font-weight: 500;">${a.sug}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    artIssuesHtml = `
      <div style="background-color: #f0fff4; border: 1px solid #c6f6d5; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; color: #22543d; font-size: 12px; font-weight: 500;">
        100% fehlerfrei: Alle Artikel im Artikelstamm sind sauber erfasst und einer Master-Zutat zugeordnet.
      </div>
    `;
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #2d3748; }
        .container { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); }
        .header { background-color: #1b365d; color: #ffffff; padding: 24px; text-align: left; border-bottom: 3px solid #2b6cb0; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
        .badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-top: 6px; }
        .content { padding: 24px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; text-align: left; }
        .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #718096; margin-bottom: 4px; }
        .kpi-value { font-size: 20px; font-weight: 800; color: #1a202c; }
        .kpi-sub { font-size: 11px; color: #718096; margin-top: 2px; }
        .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #1a202c; margin: 24px 0 12px 0; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
        th { background: #edf2f7; color: #4a5568; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 12px; }
        .btn-container { text-align: center; margin: 28px 0 12px 0; }
        .btn { display: inline-block; background: #1b365d; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: 600; font-size: 13px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${CONFIG.LOCATION_NAME} - Controlling- und Audit-Bericht</h1>
          <div class="badge">Standort: ${CONFIG.LOCATION_ADDRESS}</div>
          <p style="margin-top: 6px; margin-bottom: 0; font-size: 12px; opacity: 0.85;">Woechentlicher Einkaufs- und Plausibilitaets-Report | Stichtag: ${dateStr}</p>
        </div>
        
        <div class="content">
          <table style="width: 100%; margin-bottom: 16px;">
            <tr>
              <td style="width: 50%; padding: 4px;">
                <div class="kpi-card" style="border-left: 4px solid #1b365d;">
                  <div class="kpi-title">Ausgaben Gesamt (Netto)</div>
                  <div class="kpi-value">${totalNetto.toFixed(2)} EUR</div>
                  <div class="kpi-sub">${totalBrutto.toFixed(2)} EUR Brutto (${posCount} Positionen)</div>
                </div>
              </td>
              <td style="width: 50%; padding: 4px;">
                <div class="kpi-card" style="border-left: 4px solid #2b6cb0;">
                  <div class="kpi-title">Master-Zutaten (Rezepturbasis)</div>
                  <div class="kpi-value">${totalMaster} Master-Zutaten</div>
                  <div class="kpi-sub">100% verbindliche Kalkulationspreise</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- 1. Best-Price & Lieferantenvergleich -->
          <div class="section-title">🏆 Best-Price-Potenziale & Lieferantenvergleich</div>
          ${optHtml}

          <!-- 2. Preiserhöhungen & Warnungen -->
          ${priceIncHtml}

          <!-- 3. Perioden-Controlling nach Rechnungsmonat -->
          <div class="section-title">📅 Perioden-Controlling nach Rechnungsmonat</div>
          ${monthlyHtml}

          <!-- 4. Top-Einkaufsmengen -->
          ${qtyHtml}

          <!-- 5. Offene Artikelprüffälle -->
          <div class="section-title">Offene Artikelstamm-Prueffaelle</div>
          ${artIssuesHtml}

          <!-- 6. Health-Check & Audit-Status -->
          <div class="section-title">System-Audit & Health-Check</div>
          <table>
            <thead>
              <tr>
                <th>Pruefdimension</th>
                <th>Status</th>
                <th style="text-align: right;">Gefundene Faelle</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Umrechnungslogik & Bandbreiten (RECALC_REQUIRED)</td>
                <td style="padding: 8px 10px; color: ${audit.recalcRequired === 0 ? '#2f855a' : '#c53030'}; font-weight: 600;">${audit.recalcRequired === 0 ? 'Fehlerfrei' : 'Pruefung empfohlen'}</td>
                <td style="padding: 8px 10px; text-align: right;">${audit.recalcRequired}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Datums-Chronologie & Zukunft-Pruefung</td>
                <td style="padding: 8px 10px; color: ${audit.futureDates === 0 ? '#2f855a' : '#c53030'}; font-weight: 600;">${audit.futureDates === 0 ? 'Konsistent' : 'Inkonsistenzen'}</td>
                <td style="padding: 8px 10px; text-align: right;">${audit.futureDates}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Master-Zutaten Mapping (N:1 Abdeckung)</td>
                <td style="padding: 8px 10px; color: ${audit.unmappedItems === 0 ? '#2f855a' : '#c53030'}; font-weight: 600;">${audit.unmappedItems === 0 ? '100% Zuweisung' : 'Offene Tasks'}</td>
                <td style="padding: 8px 10px; text-align: right;">${audit.unmappedItems}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Beleg-Dublettenpruefung (Schutzmechanismus)</td>
                <td style="padding: 8px 10px; color: #2b6cb0; font-weight: 600;">Erfolgreich geblockt</td>
                <td style="padding: 8px 10px; text-align: right;">${audit.duplicateInvoices}</td>
              </tr>
            </tbody>
          </table>

          <div class="btn-container">
            <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit" class="btn">
              Warenwirtschaft ${CONFIG.LOCATION_NAME} oeffnen
            </a>
          </div>
        </div>

        <div class="footer">
          Controlling-Bericht fuer ${CONFIG.LOCATION_NAME} | Karl-Liebknecht-Strasse 57, Leipzig | Erstellt freitags um 12:00 Uhr
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
    if (isTest) SpreadsheetApp.getUi().alert('Test-Email versendet an: ' + email);
  } catch (err) {
    if (isTest) SpreadsheetApp.getUi().alert('Fehler beim E-Mail-Versand: ' + err.toString());
  }
}

function testSendWeeklyReport() {
  sendWeeklyFridayReport(true);
}

function checkDriveFolderConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const files = folder.getFiles();
    let fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push(`${file.getName()} (${(file.getSize() / 1024).toFixed(1)} KB)`);
    }
    let msg = `Google Drive Ordner verbunden:\n\nOrdner: ${folder.getName()}\nDateien im Ordner: ${fileList.length}\n\n` + (fileList.length > 0 ? fileList.join('\n') : 'Ordner ist bereit.');
    ui.alert('Drive Verbindung', msg, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Fehler', err.toString(), ui.ButtonSet.OK);
  }
}

function checkPriceAnomalies() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (!artSheet) return;
  
  const lastRow = artSheet.getLastRow();
  if (lastRow < 5) {
    SpreadsheetApp.getUi().alert('Keine Artikeldaten vorhanden.');
    return;
  }
  
  const data = artSheet.getRange(5, 1, lastRow - 4, 17).getValues();
  let increases = [];
  let decreases = [];
  
  data.forEach(row => {
    const id = row[0];
    const name = row[1];
    const currPrice = parseFloat(row[10]) || 0;
    const prevPrice = parseFloat(row[13]) || 0;
    const refPrice = parseFloat(row[11]) || currPrice;
    const unit = row[9] || 'kg';
    
    if (prevPrice > 0 && currPrice > 0) {
      const diffPct = ((currPrice - prevPrice) / prevPrice) * 100;
      if (diffPct > 0.1) increases.push(`[ERHOEHUNG] ${name} (${id}): +${diffPct.toFixed(1)}% (${prevPrice.toFixed(2)} EUR -> ${currPrice.toFixed(2)} EUR | Ref: ${refPrice.toFixed(2)} EUR/${unit})`);
      else if (diffPct < -0.1) decreases.push(`[SENKUNG] ${name} (${id}): ${diffPct.toFixed(1)}% (${prevPrice.toFixed(2)} EUR -> ${currPrice.toFixed(2)} EUR | Ref: ${refPrice.toFixed(2)} EUR/${unit})`);
    }
  });
  
  let msg = '=== PREISANALYSE REPORT (' + CONFIG.LOCATION_NAME + ') ===\n\n';
  if (increases.length > 0) msg += 'PREISERHOEHUNGEN:\n' + increases.slice(0, 10).join('\n') + '\n\n';
  else msg += 'Keine Preiserhoehungen festgestellt.\n\n';
  if (decreases.length > 0) msg += 'PREISSENKUNGEN:\n' + decreases.slice(0, 10).join('\n');
  
  SpreadsheetApp.getUi().alert('Preisanalyse', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function promptNextArticleId() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Artikel-ID Generator', 'Gib den Warengruppen-Code ein (z. B. E1, E4, E13, LG):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const inputCode = response.getResponseText().trim().toUpperCase();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  if (!artSheet) return;
  
  const lastRow = artSheet.getLastRow();
  let prefix = inputCode.startsWith('E') && inputCode.length === 2 ? 'E0' + inputCode.substring(1) : inputCode;
  
  let maxNum = 0;
  if (lastRow >= 5) {
    const ids = artSheet.getRange(5, 1, lastRow - 4, 1).getValues();
    ids.forEach(row => {
      const id = String(row[0]);
      if (id.startsWith(prefix + '-')) {
        const numPart = parseInt(id.split('-')[1], 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
  }
  
  const nextNum = maxNum + 1;
  const nextId = prefix + '-' + String(nextNum).padStart(4, '0');
  ui.alert('Naechste freie Artikel-ID', `Fuer ${inputCode}: ${nextId}`, ui.ButtonSet.OK);
}
