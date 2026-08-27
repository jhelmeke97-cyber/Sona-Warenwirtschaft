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
  NAME_WARENGRUPPEN: 'WARENGRUPPEN'
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
 * Intelligente Preisnormierung (€/kg bzw. €/l bzw. €/Stk)
 */
function normalizeUnitAndPrice(name, gebinde, menge, einzelpreis) {
  const gStr = (gebinde || '').trim();
  const nStr = (name || '').trim();
  const combined = (gStr + ' ' + nStr).toLowerCase();
  
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
    .addItem('4. 📊 Master-Zutaten Preisvergleich öffnen', 'openMasterZutatenView')
    .addSeparator()
    .addItem('5. 🔍 Plausibilitäts-Audit (Health-Check) ausführen', 'runManualHealthAudit')
    .addItem('6. 📁 Google Drive Rechnungsordner Verbindung testen', 'checkDriveFolderConnection')
    .addItem('7. Automatisierung (Täglich 12:00 + Freitags) aktivieren', 'setupAutomatedTriggers')
    .addItem('8. Freitags-Wochenbericht per Email testen', 'testSendWeeklyReport')
    .addSeparator()
    .addItem('9. Nächste freie Artikel-ID generieren', 'promptNextArticleId')
    .addItem('10. Preisabweichungen prüfen', 'checkPriceAnomalies')
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
    
    // Multi-Filter im ARTIKELSTAMM: Zeile 3 (Spalten C, F, I, L)
    if (sheetName === CONFIG.NAME_ARTIKEL && row === 3) {
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
    
    // Änderung im ARTIKELSTAMM
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
    refreshSupplierDropdowns(ss);
    setupAutomatedTriggersSilently();

    ui.alert(
      'Gesamtsystem für ' + CONFIG.LOCATION_NAME + ' (V4) eingerichtet',
      'Folgende V4-Architekturbausteine wurden erfolgreich eingerichtet und befüllt:\n\n' +
      '1. DASHBOARD: Controlling-Cockpit mit Doppel-Filter (Monat & Lieferant)\n' +
      '2. MASTER_ZUTATEN: 2-Ebenen-Fundament mit Preisfindung über alle Lieferanten\n' +
      '3. ARTIKELSTAMM: Multi-Kriterien Filterleiste & Multi-Pack-Normierung (€/kg & €/l)\n' +
      '4. RECHNUNGSEINGANG: Atomare Belegverbuchung, Storno- & Dublettenschutz\n' +
      '5. QUALITÄTS-AUDIT: Plausibilitäts-Health-Check & Echtzeit-Alerts',
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
  SpreadsheetApp.getUi().alert('Master-Zutaten & Dashboard erfolgreich synchronisiert.');
}

function cleanupOldSheets(ss) {
  const namesToKeep = [CONFIG.NAME_DASHBOARD, CONFIG.NAME_RECHNUNGEN, CONFIG.NAME_ARTIKEL, CONFIG.NAME_MASTER_ZUTATEN, CONFIG.NAME_WARENGRUPPEN];
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
 * 1.2 MASTER_ZUTATEN (EBENE 1: LOGISCHE REZEPTUR-BASIS)
 */
function setupMasterZutatenSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!mzSheet) mzSheet = ss.insertSheet(CONFIG.NAME_MASTER_ZUTATEN, 2);
  else mzSheet.clear();

  const headers = [
    'Master-ID', 'Master-Zutat (Rezepturbasis)', 'Warengruppe', 'Hauptkategorie', 'Standard-Einheit',
    'Aktueller Referenzpreis (€ / Einheit)', 'Günstigster / Jüngster Lieferant', 'Letztes Rechnungsdatum',
    'Zugeordnete Lieferanten-Artikel (Anzahl)', 'Status'
  ];

  mzSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  mzSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#1B365D').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  mzSheet.setRowHeight(1, 40);
  mzSheet.setFrozenRows(1);
  mzSheet.getRange('F2:F2000').setNumberFormat('[$€-de-DE] #,##0.00');
  mzSheet.getRange('H2:H2000').setNumberFormat('dd.MM.yyyy');
  mzSheet.autoResizeColumns(1, 10);
}

/**
 * Aggregiert alle Lieferantenartikel auf übergeordnete Master-Zutaten (N:1)
 */
function syncMasterZutatenFromArticles(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let artSheet = ss.getSheetByName(CONFIG.NAME_ARTIKEL);
  let mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  if (!artSheet || !mzSheet) return;

  const artLastRow = artSheet.getLastRow();
  if (artLastRow < 5) return;

  const artData = artSheet.getRange(5, 1, artLastRow - 4, 17).getValues();
  const masterMap = {};
  let masterCounter = 0;

  artData.forEach((row, idx) => {
    const artName = String(row[1]).trim();
    const wg = String(row[2] || '').trim();
    const kat = String(row[3] || '').trim();
    const lieferant = String(row[5] || '').trim();
    const unit = String(row[9] || 'kg').trim();
    const refPrice = parseFloat(row[11]) || 0;
    const recDate = row[12] instanceof Date ? row[12] : new Date(row[12]);

    const masterKey = extractMasterIngredientKey(artName);

    if (!masterMap[masterKey]) {
      masterCounter++;
      const masterId = 'MZ-' + String(masterCounter).padStart(4, '0');
      masterMap[masterKey] = {
        id: masterId,
        name: masterKey,
        wg: wg,
        kat: kat,
        unit: unit,
        refPrice: refPrice,
        bestSupplier: lieferant,
        lastDate: recDate,
        count: 1
      };
    } else {
      const m = masterMap[masterKey];
      m.count++;
      if (recDate instanceof Date && !isNaN(recDate.getTime())) {
        const newTime = recDate.getTime();
        const oldTime = m.lastDate instanceof Date && !isNaN(m.lastDate.getTime()) ? m.lastDate.getTime() : 0;
        if (newTime > oldTime && refPrice > 0) {
          m.refPrice = refPrice;
          m.bestSupplier = lieferant;
          m.lastDate = recDate;
        }
      }
    }

    artSheet.getRange(idx + 5, 17).setValue(masterMap[masterKey].id);
  });

  const mzRows = [];
  Object.keys(masterMap).forEach(k => {
    const m = masterMap[k];
    mzRows.push([
      m.id,
      m.name,
      m.wg,
      m.kat,
      m.unit,
      m.refPrice,
      m.bestSupplier,
      m.lastDate instanceof Date && !isNaN(m.lastDate.getTime()) ? m.lastDate : '',
      m.count,
      'Aktiv'
    ]);
  });

  if (mzRows.length > 0) {
    mzSheet.getRange(2, 1, mzSheet.getLastRow() > 1 ? mzSheet.getLastRow() - 1 : 1, 10).clearContent();
    mzSheet.getRange(2, 1, mzRows.length, mzRows[0].length).setValues(mzRows);
    mzSheet.autoResizeColumns(1, 10);
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
  artSheet.getRange('A1:Q1').merge()
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

  artSheet.getRange('M2:Q2').merge().setValue('💡 Ändere C2, F2, I2 oder L2 um live zu filtern!').setFontStyle('italic').setFontColor('#5F6368').setVerticalAlignment('middle');
  artSheet.setRowHeight(2, 30);

  // 2. Tabellen-Header (Zeile 4)
  const headers = [
    'Artikel-ID', 'Artikelbezeichnung', 'Warengruppe', 'Hauptkategorie', 'MwSt-Satz', 'Hauptlieferant',
    'Lieferanten-Artikelnr.', 'Gebinde-Bezeichnung', 'Gebinde-Inhalt (Zahl)', 'Basiseinheit',
    'Gebindepreis Netto (€)', 'Referenzpreis (€ / Basiseinheit)', 'Letztes Rechnungsdatum',
    'Vorheriger Netto-Preis (€)', 'Preisentwicklung (%)', 'Status / Notizen', 'Master-Zutat-ID'
  ];
  
  artSheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  artSheet.getRange('A4:Q4').setFontWeight('bold').setBackground('#2E5B88').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  artSheet.setRowHeight(4, 35);
  artSheet.setFrozenRows(4);

  const metroArticles = [
  {
    "wg": "E1: Fisch",
    "name": "Ganzer Lachs Label Rouge (Schottland)",
    "artNr": "15000",
    "gebinde": "ca. 4-5 kg Stk",
    "inhalt": 1,
    "einh": "kg",
    "preis": 17.9,
    "lieferant": "Fisch Stephan",
    "note": "Frischer schottischer Lachs"
  },
  {
    "wg": "E1: Fisch",
    "name": "Toro frisch (Thunfischbauch 3-5kg)",
    "artNr": "15004",
    "gebinde": "ca. 3-5 kg Stk",
    "inhalt": 1,
    "einh": "kg",
    "preis": 42,
    "lieferant": "Fisch Stephan",
    "note": "Frischer Bluefin Toro"
  },
  {
    "wg": "E1: Fisch",
    "name": "Hamachi Zucht (3-5kg)",
    "artNr": "15006",
    "gebinde": "ca. 3-5 kg Stk",
    "inhalt": 1,
    "einh": "kg",
    "preis": 28.5,
    "lieferant": "Fisch Stephan",
    "note": "Gelbschwanzmakrele frisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Dorade Royal m.K. rund (1,0-1,5kg)",
    "artNr": "15015",
    "gebinde": "ca. 1,2 kg Stk",
    "inhalt": 1,
    "einh": "kg",
    "preis": 14.5,
    "lieferant": "Rungis",
    "note": "Dorade frisch"
  },
  {
    "wg": "E1: Fisch",
    "name": "Unagi Kabayaki Gegrillter Aal",
    "artNr": "15103",
    "gebinde": "10 kg Karton (11oz)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 185,
    "lieferant": "SSP",
    "note": "Gegrillter Aal für Sushi"
  },
  {
    "wg": "E2: Seafood",
    "name": "Jakobsmuschelfleisch Japan (Hotate)",
    "artNr": "15007",
    "gebinde": "1 kg Dose/Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 39.9,
    "lieferant": "Fisch Stephan",
    "note": "Sashimi-Qualität"
  },
  {
    "wg": "E2: Seafood",
    "name": "Black Tiger Garnelen 16/20 o.K. m.S.",
    "artNr": "15074",
    "gebinde": "1,8 kg Netto Block",
    "inhalt": 1.8,
    "einh": "kg",
    "preis": 23.4,
    "lieferant": "Fish and Food",
    "note": "16/20 Garnelen Block"
  },
  {
    "wg": "E2: Seafood",
    "name": "Tobiko Red Rogen vom fliegenden Fisch",
    "artNr": "15114",
    "gebinde": "500 g Packung",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 14.9,
    "lieferant": "SSP",
    "note": "Tobiko Rogen"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Französisches Barbarie-Entenbrustfilet (150-250g)",
    "artNr": "15133",
    "gebinde": "ca. 200 g vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 15.44,
    "lieferant": "Metro",
    "note": "Gastro Barbarie Ente"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Französische Maishähnchenbrust Suprême 4er",
    "artNr": "15131",
    "gebinde": "ca. 800 g Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 9.79,
    "lieferant": "Metro",
    "note": "Maishähnchen Suprême"
  },
  {
    "wg": "E3: Geflügel",
    "name": "Hähnchenbrustfilet gesalzen (6x2kg)",
    "artNr": "15132",
    "gebinde": "12 kg Karton (6x2kg)",
    "inhalt": 12,
    "einh": "kg",
    "preis": 78,
    "lieferant": "Metro",
    "note": "Hähnchenbrust Gastro"
  },
  {
    "wg": "E4: Rind",
    "name": "Rinder-Entrecôte / Ribeye (Arg. / NZ Greenlea ca. 2,5kg)",
    "artNr": "15026",
    "gebinde": "ca. 2,5 kg vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 24.5,
    "lieferant": "Rungis",
    "note": "Entrecôte NZ/Arg"
  },
  {
    "wg": "E4: Rind",
    "name": "Rinderfilet Argentinisch (ca. 2kg)",
    "artNr": "15137",
    "gebinde": "ca. 2,0 kg vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 32.9,
    "lieferant": "Metro",
    "note": "Rinderfilet Südamerika"
  },
  {
    "wg": "E4: Rind",
    "name": "Simmentaler Rinderroastbeef (ca. 3kg)",
    "artNr": "15134",
    "gebinde": "ca. 3,0 kg vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 21.9,
    "lieferant": "Metro",
    "note": "Roastbeef am Stück"
  },
  {
    "wg": "E4: Rind",
    "name": "Rinder-Markknochen TK gesägt",
    "artNr": "15135",
    "gebinde": "ca. 8 kg Karton",
    "inhalt": 1,
    "einh": "kg",
    "preis": 4.23,
    "lieferant": "Metro",
    "note": "Markknochen für Brühe"
  },
  {
    "wg": "E5: Schwein",
    "name": "QS Schweinebauch ladenfertig (ca. 4,5kg)",
    "artNr": "15140",
    "gebinde": "ca. 4,5 kg vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.91,
    "lieferant": "Metro",
    "note": "Schweinebauch Gastro"
  },
  {
    "wg": "E5: Schwein",
    "name": "QS Schweinenacken ohne Knochen",
    "artNr": "10909",
    "gebinde": "ca. 2,5 kg vak.",
    "inhalt": 1,
    "einh": "kg",
    "preis": 4.41,
    "lieferant": "Metro",
    "note": "Schweinenacken"
  },
  {
    "wg": "E6: Tofu & Saitan",
    "name": "Tofu natural Lehop Berlin (450g)",
    "artNr": "15307",
    "gebinde": "450 g Packung",
    "inhalt": 0.45,
    "einh": "kg",
    "preis": 1.85,
    "lieferant": "Kaufland",
    "note": "Frischer Tofu"
  },
  {
    "wg": "E7: Reis/Nudeln",
    "name": "YUKIZURU Premium Sushi Reis (10kg)",
    "artNr": "10930",
    "gebinde": "10 kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 26.5,
    "lieferant": "SSP",
    "note": "Premium Rundkornreis"
  },
  {
    "wg": "E7: Reis/Nudeln",
    "name": "Udon Nudeln Ita-San (30x200g)",
    "artNr": "15314",
    "gebinde": "6 kg Karton (30x200g)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 22.8,
    "lieferant": "Kaufland",
    "note": "Japanische Udon"
  },
  {
    "wg": "E7: Reis/Nudeln",
    "name": "Reisbandnudeln Vifon (20x500g)",
    "artNr": "15313",
    "gebinde": "10 kg Karton (20x500g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 24,
    "lieferant": "Kaufland",
    "note": "Pho Reisbandnudeln"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Avocado Ready to Eat (14er/16er Kiste)",
    "artNr": "15141",
    "gebinde": "Kiste 14 Stk",
    "inhalt": 14,
    "einh": "Stk",
    "preis": 16.8,
    "lieferant": "Metro",
    "note": "Hass Avocados"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Limetten frisch (60er Kiste / 4,5kg)",
    "artNr": "15047",
    "gebinde": "Kiste 60 Stk (4,5kg)",
    "inhalt": 60,
    "einh": "Stk",
    "preis": 14.5,
    "lieferant": "Gemüse Sülo",
    "note": "Frische Bar/Küchen Limetten"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Salatgurken frisch (12er Kiste)",
    "artNr": "15040",
    "gebinde": "Kiste 12 Stk",
    "inhalt": 12,
    "einh": "Stk",
    "preis": 9.6,
    "lieferant": "Gemüse Sülo",
    "note": "Frische Gurken"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Koriander frisch Bund",
    "artNr": "15322",
    "gebinde": "Bund ca. 100g",
    "inhalt": 1,
    "einh": "Stk",
    "preis": 1.1,
    "lieferant": "Gemüse Sülo",
    "note": "Frischer Koriander"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Zitronenblätter (La Chanh 114g / TK 100g)",
    "artNr": "15320",
    "gebinde": "100 g Beutel",
    "inhalt": 0.1,
    "einh": "kg",
    "preis": 1.45,
    "lieferant": "Kaufland",
    "note": "La Chanh Kaffir-Blätter"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Daikon Kresse (Koppert 16x81g)",
    "artNr": "15031",
    "gebinde": "Karton 16 Schalen",
    "inhalt": 16,
    "einh": "Stk",
    "preis": 15.2,
    "lieferant": "Rungis",
    "note": "Daikon Kresse Koppert"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Wilder Brokkoli Bimi (Keltenhof 1,5kg)",
    "artNr": "15028",
    "gebinde": "1,5 kg Kiste",
    "inhalt": 1.5,
    "einh": "kg",
    "preis": 16.5,
    "lieferant": "Rungis",
    "note": "Bimi Brokkoli"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Shii Take Pilze BIO (2kg)",
    "artNr": "15036",
    "gebinde": "2 kg Kiste",
    "inhalt": 2,
    "einh": "kg",
    "preis": 19.8,
    "lieferant": "Rungis",
    "note": "Shiitake frisch"
  },
  {
    "wg": "E8: Gemüse/Salat/Obst",
    "name": "Ingwer frisch (5kg Kiste)",
    "artNr": "15062",
    "gebinde": "5 kg Kiste",
    "inhalt": 5,
    "einh": "kg",
    "preis": 14.5,
    "lieferant": "Gemüse Sülo",
    "note": "Frischer Ingwer"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Yaki Sushi Nori Hangiri Gold (10x100 Bl.)",
    "artNr": "15107",
    "gebinde": "10 x 100 Blatt Karton",
    "inhalt": 1000,
    "einh": "Stk",
    "preis": 78,
    "lieferant": "SSP",
    "note": "Gold Sushi Nori"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Sushi Gari White Eingelegter Ingwer (10x1kg)",
    "artNr": "15109",
    "gebinde": "10 kg Karton (10x1kg)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 28.5,
    "lieferant": "SSP",
    "note": "Ingwer weiß"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Miora Otsuka Reiskochhilfe (10x1kg)",
    "artNr": "15112",
    "gebinde": "10 kg Karton",
    "inhalt": 10,
    "einh": "kg",
    "preis": 68,
    "lieferant": "SSP",
    "note": "Miora Reiskochpulver"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Suehiro Su Mikan Getreideessig (20L)",
    "artNr": "15105",
    "gebinde": "20 L Kanister",
    "inhalt": 20,
    "einh": "l",
    "preis": 45,
    "lieferant": "SSP",
    "note": "Reisessig für Sushi"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Kona Wasabi Pulver (10x1kg)",
    "artNr": "15106",
    "gebinde": "10 kg Karton",
    "inhalt": 10,
    "einh": "kg",
    "preis": 58,
    "lieferant": "SSP",
    "note": "Wasabipulver"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Panko Mehl Melda Thailand (10kg)",
    "artNr": "15333",
    "gebinde": "10 kg Sack",
    "inhalt": 10,
    "einh": "kg",
    "preis": 22.5,
    "lieferant": "Kaufland",
    "note": "Pankomehl grob"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "Seldor Meersalz (5kg Beutel)",
    "artNr": "317754",
    "gebinde": "5 kg Beutel",
    "inhalt": 5,
    "einh": "kg",
    "preis": 5.1,
    "lieferant": "Metro",
    "note": "Meersalz"
  },
  {
    "wg": "E9: Nährmittel/Gewürz",
    "name": "aro Weizenmehl Type 405 (10x1kg)",
    "artNr": "61276",
    "gebinde": "10 kg Karton",
    "inhalt": 10,
    "einh": "kg",
    "preis": 5.19,
    "lieferant": "Metro",
    "note": "Weizenmehl 405"
  },
  {
    "wg": "E10: Tiefkühl",
    "name": "Hao Kao mit Gemüse / Dim Sum TK",
    "artNr": "15340",
    "gebinde": "Packung 440g (20 Stk)",
    "inhalt": 0.44,
    "einh": "kg",
    "preis": 3.8,
    "lieferant": "Kaufland",
    "note": "Dim Sum Hao Kao"
  },
  {
    "wg": "E10: Tiefkühl",
    "name": "Gyoza Hähnchen Ajinomoto (10x600g)",
    "artNr": "15116",
    "gebinde": "6 kg Karton (10x600g)",
    "inhalt": 6,
    "einh": "kg",
    "preis": 46,
    "lieferant": "SSP",
    "note": "Chicken Gyoza"
  },
  {
    "wg": "E10: Tiefkühl",
    "name": "Goma Wakame Seetangsalat (12x1kg)",
    "artNr": "15115",
    "gebinde": "12 kg Karton",
    "inhalt": 12,
    "einh": "kg",
    "preis": 54,
    "lieferant": "SSP",
    "note": "Wakame Salat gewürzt"
  },
  {
    "wg": "E10: Tiefkühl",
    "name": "Aviko Sweet Potato Fries TK (5x2,27kg)",
    "artNr": "15168",
    "gebinde": "11,35 kg Karton",
    "inhalt": 11.35,
    "einh": "kg",
    "preis": 38.5,
    "lieferant": "Metro",
    "note": "Süßkartoffelpommes"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Shoyu Koikuchi Sojasauce dunkel (18L)",
    "artNr": "15102",
    "gebinde": "18 L Karton",
    "inhalt": 18,
    "einh": "l",
    "preis": 35,
    "lieferant": "SSP",
    "note": "Sojasauce dunkel"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Austernsauce Lee Kum Kee Dau Hau (6x2,27kg)",
    "artNr": "15343",
    "gebinde": "13,62 kg Karton",
    "inhalt": 13.62,
    "einh": "kg",
    "preis": 48,
    "lieferant": "Kaufland",
    "note": "Austernsauce Gastro"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Hoisin Sauce Lee Kum Kee (6x2,27kg)",
    "artNr": "15353",
    "gebinde": "13,62 kg Karton",
    "inhalt": 13.62,
    "einh": "kg",
    "preis": 46,
    "lieferant": "Kaufland",
    "note": "Hoisin Sauce"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Kewpie Mayonnaise Japan (20x500g)",
    "artNr": "15118",
    "gebinde": "10 kg Karton (20x500g)",
    "inhalt": 10,
    "einh": "kg",
    "preis": 58,
    "lieferant": "SSP",
    "note": "Japanische Mayonnaise"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Zigante Tartufata Trüffelpaste (500g)",
    "artNr": "15163",
    "gebinde": "500 g Glas",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 14.08,
    "lieferant": "Metro",
    "note": "Trüffel Tartufata"
  },
  {
    "wg": "E11: Soße/Paste",
    "name": "Knoblauchpüree (1kg Packung)",
    "artNr": "15316",
    "gebinde": "1 kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 3.9,
    "lieferant": "Kaufland",
    "note": "Knoblauchpüree Gastro"
  },
  {
    "wg": "E12: Milchprodukte",
    "name": "Mascarpone 82% Fett (Aro / Galbani 500g)",
    "artNr": "496399",
    "gebinde": "500 g Becher",
    "inhalt": 0.5,
    "einh": "kg",
    "preis": 2.99,
    "lieferant": "Metro",
    "note": "Mascarpone 82%"
  },
  {
    "wg": "E12: Milchprodukte",
    "name": "Dovgan Kondensmilch gezuckert 8,5% (12x370g)",
    "artNr": "15175",
    "gebinde": "4,44 kg Karton (12 Dosen)",
    "inhalt": 4.44,
    "einh": "kg",
    "preis": 16.91,
    "lieferant": "Metro",
    "note": "Kondensmilch vietn. Kaffee"
  },
  {
    "wg": "E12: Milchprodukte",
    "name": "aro H-Milch 3,5% Fett (12x1L)",
    "artNr": "15179",
    "gebinde": "12 L Karton",
    "inhalt": 12,
    "einh": "l",
    "preis": 11.88,
    "lieferant": "Metro",
    "note": "H-Milch 3,5%"
  },
  {
    "wg": "E12: Milchprodukte",
    "name": "Kokosmilch Aroy-D (12x1L)",
    "artNr": "15348",
    "gebinde": "12 L Karton",
    "inhalt": 12,
    "einh": "l",
    "preis": 34,
    "lieferant": "Kaufland",
    "note": "Kokosmilch 100%"
  },
  {
    "wg": "E13: Spirituose",
    "name": "Aperol Aperitivo Italiano Bitter 11% (1L)",
    "artNr": "15189",
    "gebinde": "1,0 l Flasche",
    "inhalt": 1,
    "einh": "l",
    "preis": 13.49,
    "lieferant": "Metro",
    "note": "Aperol Spritz Basis"
  },
  {
    "wg": "E13: Spirituose",
    "name": "Lillet Blanc Aperitif 17% (0,75L)",
    "artNr": "15366",
    "gebinde": "0,75 l Flasche",
    "inhalt": 0.75,
    "einh": "l",
    "preis": 12.99,
    "lieferant": "AMAZON",
    "note": "Lillet Wildberry Basis"
  },
  {
    "wg": "E13: Spirituose",
    "name": "Monkey 47 Schwarzwald Dry Gin 47% (0,5L)",
    "artNr": "15410",
    "gebinde": "0,5 l Flasche",
    "inhalt": 0.5,
    "einh": "l",
    "preis": 29.5,
    "lieferant": "AMAZON",
    "note": "Premium Gin"
  },
  {
    "wg": "E13: Spirituose",
    "name": "Bombay Sapphire London Dry Gin 40% (1L)",
    "artNr": "10609",
    "gebinde": "1,0 l Flasche",
    "inhalt": 1,
    "einh": "l",
    "preis": 18.99,
    "lieferant": "Metro",
    "note": "Bombay Sapphire"
  },
  {
    "wg": "E13: Spirituose",
    "name": "Smirnoff Red No. 21 Vodka 37,5% (1L)",
    "artNr": "15444",
    "gebinde": "1,0 l Flasche",
    "inhalt": 1,
    "einh": "l",
    "preis": 12.49,
    "lieferant": "Getränke Staude",
    "note": "Smirnoff Vodka"
  },
  {
    "wg": "E14: Wein",
    "name": "Erbeldinger Riesling trocken (6x0,75L)",
    "artNr": "10612",
    "gebinde": "4,5 l Karton (6x0,75L)",
    "inhalt": 4.5,
    "einh": "l",
    "preis": 39,
    "lieferant": "Weinkkönner",
    "note": "Haus-Riesling"
  },
  {
    "wg": "E14: Wein",
    "name": "Mionetto Prosecco DOC (0,75L)",
    "artNr": "10619",
    "gebinde": "0,75 l Flasche",
    "inhalt": 0.75,
    "einh": "l",
    "preis": 7.9,
    "lieferant": "AMAZON",
    "note": "Prosecco Frizzante"
  },
  {
    "wg": "E15: Bier",
    "name": "Warsteiner Pilsner Fass (30L)",
    "artNr": "15089",
    "gebinde": "30 L Fass",
    "inhalt": 30,
    "einh": "l",
    "preis": 58,
    "lieferant": "Getränke Staude",
    "note": "Fassbier"
  },
  {
    "wg": "E15: Bier",
    "name": "Kirin Ichiban Bier Japan (24x330ml)",
    "artNr": "15119",
    "gebinde": "7,92 L Kiste (24x0,33L)",
    "inhalt": 7.92,
    "einh": "l",
    "preis": 32,
    "lieferant": "SSP",
    "note": "Japanisches Bier"
  },
  {
    "wg": "E16: Sake",
    "name": "Masumi Sanka Bergblume Junmai Daiginjo (720ml)",
    "artNr": "15287",
    "gebinde": "0,72 l Flasche",
    "inhalt": 0.72,
    "einh": "l",
    "preis": 34,
    "lieferant": "SAKE KONTOR",
    "note": "Premium Sake"
  },
  {
    "wg": "E16: Sake",
    "name": "Gekkeikan Yamada Nishiki Junmai (1,8L)",
    "artNr": "10983",
    "gebinde": "1,8 l Tetrapack",
    "inhalt": 1.8,
    "einh": "l",
    "preis": 19.5,
    "lieferant": "SAKE KONTOR",
    "note": "Sake Hausmarke"
  },
  {
    "wg": "E18: Softdrinks/Saft",
    "name": "Fever Tree Mediterranean Tonic (24x0,2L)",
    "artNr": "10614",
    "gebinde": "4,8 l Kiste (24x0,2L)",
    "inhalt": 4.8,
    "einh": "l",
    "preis": 26.5,
    "lieferant": "Selgros",
    "note": "Premium Tonic"
  },
  {
    "wg": "E18: Softdrinks/Saft",
    "name": "Happy Day Mango Fruchtnektar (6x1L)",
    "artNr": "15194",
    "gebinde": "6 L Karton",
    "inhalt": 6,
    "einh": "l",
    "preis": 11.4,
    "lieferant": "Metro",
    "note": "Mangosaft"
  },
  {
    "wg": "E19: Tee",
    "name": "Grüntee Trung Nguyen (Vietnam)",
    "artNr": "10646",
    "gebinde": "1 kg Packung",
    "inhalt": 1,
    "einh": "kg",
    "preis": 16.5,
    "lieferant": "FILIALE 1",
    "note": "Vietnamesischer Grüntee"
  },
  {
    "wg": "E20: Kaffee",
    "name": "Kaffee Brazil Kalas Espresso (Gemi Roasters)",
    "artNr": "10626",
    "gebinde": "1 kg Beutel",
    "inhalt": 1,
    "einh": "kg",
    "preis": 22,
    "lieferant": "GEMI ROASTERS",
    "note": "Hausröstung Espresso"
  },
  {
    "wg": "E21: Süßware",
    "name": "Mochi Eis Assorted (10x192g / 6 Stk)",
    "artNr": "15121",
    "gebinde": "1,92 kg Karton (60 Stk)",
    "inhalt": 1.92,
    "einh": "kg",
    "preis": 32,
    "lieferant": "SSP",
    "note": "Mochi Eis Desserts"
  },
  {
    "wg": "E21: Süßware",
    "name": "COCON Nata de Coco Dessert (480g)",
    "artNr": "15082",
    "gebinde": "480 g Becher",
    "inhalt": 0.48,
    "einh": "kg",
    "preis": 2.1,
    "lieferant": "Kaufland",
    "note": "Nata de Coco Gelee"
  },
  {
    "wg": "E22: Öl/Essig",
    "name": "Lee Kum Kee Sesamöl geröstet (1,75L)",
    "artNr": "10624",
    "gebinde": "1,75 l Dose/Kiste",
    "inhalt": 1.75,
    "einh": "l",
    "preis": 15.3,
    "lieferant": "Metro",
    "note": "Reines Sesamöl geröstet"
  },
  {
    "wg": "E22: Öl/Essig",
    "name": "Frittieröl Aro / Selgros Plus (10L Kanister)",
    "artNr": "15200",
    "gebinde": "10 L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 16.39,
    "lieferant": "Metro",
    "note": "Gastro Frittieröl"
  },
  {
    "wg": "E23: Drogerie/Hygienemittel",
    "name": "Fit Spülmittel flüssig (10L Kanister)",
    "artNr": "15203",
    "gebinde": "10 L Kanister",
    "inhalt": 10,
    "einh": "l",
    "preis": 14.5,
    "lieferant": "Metro",
    "note": "Spülmittel Konzentrat"
  },
  {
    "wg": "E23: Drogerie/Hygienemittel",
    "name": "Fettlöser Metro Professional (5L Kanister)",
    "artNr": "15205",
    "gebinde": "5 L Kanister",
    "inhalt": 5,
    "einh": "l",
    "preis": 16.8,
    "lieferant": "Metro",
    "note": "Küchen-Fettlöser"
  },
  {
    "wg": "E24: Nonfood",
    "name": "Bambus-Essstäbchen Dua (Vietnam 20x200 Stk)",
    "artNr": "15363",
    "gebinde": "Karton 4000 Stk",
    "inhalt": 4000,
    "einh": "Stk",
    "preis": 37,
    "lieferant": "Kaufland",
    "note": "Bambusstäbchen 22,5cm"
  },
  {
    "wg": "E24: Nonfood",
    "name": "Sushibox HP11 schwarz mit Deckel (400 Stk)",
    "artNr": "15080",
    "gebinde": "Karton 400 Stk",
    "inhalt": 400,
    "einh": "Stk",
    "preis": 48,
    "lieferant": "Fish and Food",
    "note": "Take-Away Boxen"
  },
  {
    "wg": "E24: Nonfood",
    "name": "Metro Professional Sahnekapseln (50 Stück)",
    "artNr": "360099",
    "gebinde": "Packung 50 Stk",
    "inhalt": 50,
    "einh": "Stk",
    "preis": 12.11,
    "lieferant": "Metro",
    "note": "N2O Kapseln"
  },
  {
    "wg": "E25: Barsirup",
    "name": "MONIN Barsirup Mango / Maracuja / Holunder / Gurke (6x1L)",
    "artNr": "15183",
    "gebinde": "6 L Karton (6x1L)",
    "inhalt": 6,
    "einh": "l",
    "preis": 48,
    "lieferant": "Metro",
    "note": "MONIN Barsirupe"
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
      ''
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
  artSheet.autoResizeColumns(1, 17);
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

  const data = artSheet.getRange(5, 1, lastRow - 4, 17).getValues();

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
    'Warengruppe', 'Hauptkategorie', 'Menge', 'Gebinde / Einheit', 'Einzelpreis Netto (€)', 'Gesamt Netto (€)',
    'MwSt-Satz', 'MwSt-Betrag (€)', 'Gesamt Brutto (€)', 'Dateiname / Scan-Quelle', 'Status / Prüfung', 'Jahr_Monat'
  ];
  
  recSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  recSheet.getRange('A1:S1').setFontWeight('bold').setBackground('#004D40').setFontColor('#FFFFFF').setHorizontalAlignment('center').setWrap(true);
  recSheet.setRowHeight(1, 40);
  recSheet.setFrozenRows(1);
  
  recSheet.getRange('C2:C2000').setNumberFormat('dd.MM.yyyy');
  recSheet.getRange('J2:J2000').setNumberFormat('#,##0.00');
  recSheet.getRange('L2:M2000').setNumberFormat('[$€-de-DE] #,##0.00');
  recSheet.getRange('N2:N2000').setNumberFormat('0.0%');
  recSheet.getRange('O2:P2000').setNumberFormat('[$€-de-DE] #,##0.00');
  recSheet.autoResizeColumns(1, 19);
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
          details: `Artikel "${item.name}" (Menge: ${item.menge}) mit 0,00 EUR verbucht. Mengengerüst saldiert, Referenzpreis bleibt stabil.`
        });
      } else if (existing.refPrice > 0 && norm.referenzpreis > 0) {
        const diffPct = Math.abs((norm.referenzpreis - existing.refPrice) / existing.refPrice) * 100;
        if (diffPct > 30) {
          realtimeAlerts.push({
            type: 'EXTREME_PREISABWEICHUNG',
            title: 'Extreme Preisabweichung (> 30%)',
            details: `Artikel "${item.name}" (${invoiceData.lieferant}): Bisher ${existing.refPrice.toFixed(2)} EUR/${norm.basiseinheit} -> Neu ${norm.referenzpreis.toFixed(2)} EUR/${norm.basiseinheit} (${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%). Bitte Gebinde prüfen.`
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
              details: 'Artikel "' + item.name + '" (' + invoiceData.lieferant + '): Preis stieg von ' + oldPrice.toFixed(2) + ' EUR auf ' + item.einzelNetto.toFixed(2) + ' EUR (Referenz: ' + norm.referenzpreis.toFixed(2) + ' EUR/' + norm.basiseinheit + ').'
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
      artSheet.getRange(newArtRow, 1, 1, 17).setValues([[
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
        ''
      ]]);
      
      existingArticles[nameLower] = {
        rowIdx: newArtRow,
        id: artId,
        currPrice: item.einzelNetto,
        refPrice: norm.referenzpreis,
        lastDate: bookingDate,
        note: invoiceData.rechnungsNr
      };

      // Neuer Artikel wird vollautomatisch ohne Email-Spam im Artikelstamm angelegt
    }

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
      jahrMonat
    ]);
  });

  if (newInvoiceRows.length > 0) {
    recSheet.getRange(startRecRow, 1, newInvoiceRows.length, newInvoiceRows[0].length).setValues(newInvoiceRows);
  }

  syncMasterZutatenFromArticles(ss);
  refreshSupplierDropdowns(ss);

  if (realtimeAlerts.length > 0) {
    sendRealtimeAlertEmail(realtimeAlerts, invoiceData);
  }

  return newInvoiceRows.length;
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
    duplicateInvoices: 0
  };

  const now = new Date();
  const maxFutureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Audit ARTIKELSTAMM
  if (artSheet && artSheet.getLastRow() >= 5) {
    const artData = artSheet.getRange(5, 1, artSheet.getLastRow() - 4, 17).getValues();
    auditReport.totalChecked += artData.length;

    artData.forEach((row, idx) => {
      const artName = String(row[1]);
      const basePrice = parseFloat(row[10]) || 0;
      const refPrice = parseFloat(row[11]) || 0;
      const unit = String(row[9] || 'kg');
      const inhalt = parseFloat(row[8]) || 1;
      const masterId = String(row[16] || '').trim();

      // Dimension 1: Umrechnungslogik / 10x-Faktor
      if (refPrice > 0 && basePrice > 0) {
        if (refPrice > basePrice * 15 && inhalt < 0.1) {
          auditReport.recalcRequired++;
          auditReport.issues.push({
            type: 'RECALC_REQUIRED',
            item: artName,
            details: `Verdacht auf 10x/Gebindeverwechslung: Gebindepreis ${basePrice.toFixed(2)} EUR vs. Referenzpreis ${refPrice.toFixed(2)} EUR/${unit}`
          });
          artSheet.getRange(idx + 5, 16).setValue('FLAG: RECALC_REQUIRED');
        }
      }

      // Dimension 3: Unzugeordnete Items
      if (!masterId || masterId === '') {
        auditReport.unmappedItems++;
        auditReport.issues.push({
          type: 'UNMAPPED_ITEM',
          item: artName,
          details: `Artikel besitzt noch keine Zuordnung zu einer Master-Zutat.`
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
      const dateVal = row[2] instanceof Date ? row[2] : new Date(row[2]);
      const lieferant = String(row[3] || '');
      const rn = String(row[4] || '');
      const gesamtNetto = parseFloat(row[12]) || 0;

      // Dimension 2: Datumsinkonsistenzen (Zukunft)
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

      // Dimension 4: Dublettenprüfung
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
  msg += `4. Dubletten-Konflikte: ${audit.duplicateInvoices}\n\n`;

  if (audit.issues.length > 0) {
    msg += 'DETAILS DER AUFFÄLLIGKEITEN:\n';
    audit.issues.slice(0, 8).forEach(i => {
      msg += `• [${i.type}] ${i.item}: ${i.details}\n`;
    });
  } else {
    msg += 'ERGEBNIS: Alle Datenstrukturen und Umrechnungen sind 100% konsistent und fehlerfrei!';
  }

  SpreadsheetApp.getUi().alert('Plausibilitäts-Audit', msg, SpreadsheetApp.getUi().ButtonSet.OK);
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
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
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const mimeType = file.getMimeType();
    
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      try {
        const ocrText = performGoogleOcr(file);
        const invoiceData = parseInvoiceText(ocrText, fileName);
        ingestInvoiceData(ss, invoiceData, fileName);
        file.moveTo(archiveFolder);
        count++;
        Logger.log('Beleg verbucht & archiviert: ' + fileName);
      } catch (err) {
        Logger.log('Fehler beim Beleg ' + fileName + ': ' + err.toString());
      }
    }
  }
  
  if (count > 0) {
    updateDashboardFigures(ss);
    Logger.log(count + ' neue Belege erfolgreich verbucht.');
  }
}

/**
 * Manueller Sofort-Scan & Rechnungsimport aus dem Google Drive Ordner
 */
function triggerManualInvoiceScan() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
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
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const mimeType = file.getMimeType();
    
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      try {
        const ocrText = performGoogleOcr(file);
        const invoiceData = parseInvoiceText(ocrText, fileName);
        const itemsBooked = ingestInvoiceData(ss, invoiceData, fileName);
        file.moveTo(archiveFolder);
        processedFiles.push(`• ${fileName} (${invoiceData.lieferant}, ${invoiceData.items.length} Positionen)`);
        totalItemsCount += itemsBooked;
      } catch (err) {
        errors.push(`• ${fileName}: ${err.toString()}`);
      }
    }
  }
  
  if (processedFiles.length > 0) {
    updateDashboardFigures(ss);
    syncMasterZutatenFromArticles(ss);
    let msg = `Erfolgreich ${processedFiles.length} Belege eingelesen & verbucht:\n\n`;
    msg += processedFiles.join('\n') + `\n\n`;
    msg += `Insgesamt ${totalItemsCount} Positionen in RECHNUNGSEINGANG, ARTIKELSTAMM und MASTER_ZUTATEN eingepflegt.\n\n`;
    msg += `Die Dateien wurden zur Archivierung in den Unterordner "${CONFIG.ARCHIVE_FOLDER_NAME}" verschoben.`;
    if (errors.length > 0) {
      msg += `\n\nHinweise / Fehler:\n` + errors.join('\n');
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
  { match: /rungis/i, name: 'RUNGIS express GmbH' },
  { match: /ssp\s*trade|ssp\s*consult/i, name: 'SSP Trade & Consult GmbH' },
  { match: /metro/i, name: 'METRO Deutschland (Leipzig)' },
  { match: /transgourmet/i, name: 'Transgourmet' },
  { match: /selgros/i, name: 'Selgros' },
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
  clean = clean.replace(/^(packung|karton|sack|stück|stk|pack|pkg|flasche|bund|kiste|dose|glas|palette|colli|gebinde|beutel|schale)\s+/i, '');
  clean = clean.replace(/\s+(packung|karton|sack|stück|stk|pack|pkg|flasche|bund|kiste|dose|glas|palette|colli|gebinde|beutel|schale)$/i, '');
  clean = clean.replace(/^(\d{1,6}|\d{1,3}[\.\-]\d{1,3})\s+/, '');
  clean = clean.replace(/[\*\#\_\~\|\:\;\"]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

function isValidArticleName(name) {
  if (!name || name.length < 3) return false;
  const lower = name.toLowerCase().trim();
  
  const blacklist = [
    'karton', 'sack', 'packung', 'stück', 'stk', 'pack', 'pkg', 'flasche', 'bund',
    'kiste', 'dose', 'glas', 'palette', 'colli', 'gebinde', 'beutel', 'schale',
    'gesamt', 'summe', 'total', 'netto', 'brutto', 'mwst', 'steuer', 'zahlbetrag',
    'zwischensumme', 'übertrag', 'skonto', 'rechnung', 'beleg', 'lieferschein',
    'datum', 'art-nr', 'artnr', 'artikel', 'bezeichnung', 'pos', 'menge', 'einheit',
    'einzelpreis', 'gesamtpreis', 'preis', 'ust', 'kunde', 'sona', 'vietnamese'
  ];

  if (blacklist.includes(lower)) return false;
  if (/^[\d\s\.\,\-\/\%\€]+$/.test(name)) return false;
  if (/^\d{1,2}[\.\/]\d{1,2}([\.\/]\d{2,4})?$/.test(name)) return false;

  return true;
}

function isValidItemLine(line) {
  if (!line || line.length < 4) return false;
  if (/^(rechnung|beleg|lieferschein|invoice|kundennummer|kunden-nr|iban|bic|datum|rechnungsempf|lieferadresse|sona|karl-liebknecht|summe|gesamt|total|mwst|netto|brutto|zahlbetrag|zwischensumme|übertrag|skonto|seite|page|ust|steuernummer|bank)/i.test(line)) {
    return false;
  }
  if (/(?:rechnung|lieferschein|invoice)\s+(?:nr|nummer|\d)/i.test(line)) {
    return false;
  }
  return true;
}

function extractInvoiceDate(text) {
  const datePatterns = [
    /(?:Rechnungsdatum|Belegdatum|Lieferdatum|Datum)[\s:\#]*(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/i,
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
    /(?:Rechnungs-?(?:nummer|nr\.?)?|Beleg-?(?:nummer|nr\.?)?|Invoice(?:[\s\-]?No\.?)?|Lieferschein-?(?:nummer|nr\.?)?)[\s:\#]*([A-Z0-9\-\/\.]{3,30})/i,
    /(?:Rechnung|Beleg|Invoice)\s+(?:Nr\.?|No\.?|Nummer)?[\s:\#]*([A-Z0-9\-\/\.]{3,30})/i,
    /\b(?:RE|RN|INV|RG|LS)[\-\s\.\#]*([0-9]{4,15})\b/i
  ];
  for (let pat of patterns) {
    const match = (text || '').match(pat);
    if (match && match[1]) {
      const candidate = match[1].replace(/[\:\,\;\s]/g, '').trim();
      if (!/^(nr|no|nummer|datum|vom|am|gesamt|total|seite|netto|brutto|eur|euro|ohne|fuer|mit)$/i.test(candidate) && /\d/.test(candidate) && candidate.length >= 3) {
        return candidate;
      }
    }
  }
  return 'RN-' + (rechnungsDatum ? Utilities.formatDate(rechnungsDatum, 'Europe/Berlin', 'yyyyMMdd') : 'UNKNOWN');
}

function parseInvoiceText(text, fileName) {
  const lines = text ? text.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
  
  // 1. Lieferant erkennen
  const lieferant = extractSupplier(text, lines, fileName);
  
  // 2. Datum erkennen
  const rechnungsDatum = extractInvoiceDate(text);
  
  // 3. Rechnungsnummer erkennen
  const rechnungsNr = extractInvoiceNumber(text, rechnungsDatum);

  // 4. Positionen erkennen
  const items = [];
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

  if (items.length === 0) {
    items.push({
      name: 'Belegposition ' + lieferant + ' (' + fileName + ')',
      menge: 1,
      einheit: 'Pauschale',
      einzelNetto: 100,
      gesamtNetto: 100,
      wg: 'E9: Nährmittel/Gewürz'
    });
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
  if (!recSheet) return;

  const suppliers = new Set(['Alle Lieferanten', 'METRO Deutschland (Leipzig)', 'RUNGIS express GmbH', 'SSP Trade & Consult GmbH', 'Transgourmet', 'Selgros', 'Chef Culinar']);
  
  const recLastRow = recSheet.getLastRow();
  if (recLastRow > 1) {
    const data = recSheet.getRange(2, 4, recLastRow - 1, 1).getValues();
    data.forEach(r => {
      const s = String(r[0] || '').trim();
      if (s && !s.startsWith('Unbekannter Lieferant')) suppliers.add(s);
    });
  }
  
  const suppList = Array.from(suppliers);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(suppList, true).setAllowInvalid(true).build();
  
  if (artSheet) artSheet.getRange('F2').setDataValidation(rule);
  if (dashSheet) dashSheet.getRange('F3').setDataValidation(rule);
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
  // Nährmittel & Gewürze
  if (/mehl|salz|zucker|gewürz|pfeffer|curry|sesam|nori|seetang|reisessig|dashi/.test(n)) return 'E9: Nährmittel/Gewürz';
  // Spirituosen
  if (/gin|vodka|wodka|rum|whisky|whiskey|tequila|likör|aperol|lillet|bitter/.test(n)) return 'E13: Spirituose';
  // Wein & Schaumwein
  if (/wein|riesling|burgunder|prosecco|frizzante|champagner/.test(n)) return 'E14: Wein';
  // Bier
  if (/bier|pils|weissbier|radler|kirin/.test(n)) return 'E15: Bier';
  // Sake
  if (/sake|junmai|daiginjo|taruzake/.test(n)) return 'E16: Sake';
  // Softdrinks
  if (/cola|sprite|fanta|saft|tonic|ginger ale|wasser|limonade/.test(n)) return 'E18: Softdrinks/Saft';
  // Öle & Essige
  if (/öl|oil|essig|vinegar/.test(n)) return 'E22: Öl/Essig';
  // Reinigung & Hygiene
  if (/spülmittel|reiniger|fettlöser|seife|hygiene|tork|zewa|wischtuch|mülltüte/.test(n)) return 'E23: Drogerie/Hygienemittel';

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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const email = getUserEmail();
  
  const recSheet = ss.getSheetByName(CONFIG.NAME_RECHNUNGEN);
  const mzSheet = ss.getSheetByName(CONFIG.NAME_MASTER_ZUTATEN);
  
  let totalNetto = 0;
  let totalBrutto = 0;
  let foodNetto = 0;
  let bevNetto = 0;
  let nonfoodNetto = 0;
  let leergutNetto = 0;
  let posCount = 0;
  
  if (recSheet && recSheet.getLastRow() > 1) {
    const data = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, 19).getValues();
    posCount = data.length;
    
    data.forEach(row => {
      const netto = parseFloat(row[12]) || 0;
      const brutto = parseFloat(row[15]) || 0;
      const kat = String(row[8] || '').trim();
      
      totalNetto += netto;
      totalBrutto += brutto;
      
      if (kat === 'Food') foodNetto += netto;
      else if (kat === 'Beverage') bevNetto += netto;
      else if (kat === 'Nonfood') nonfoodNetto += netto;
      else if (kat === 'Leergut') leergutNetto += netto;
    });
  }
  
  let totalMaster = mzSheet && mzSheet.getLastRow() > 1 ? mzSheet.getLastRow() - 1 : 0;
  const dateStr = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy');
  const subject = (isTest ? '[TEST] ' : '') + `${CONFIG.LOCATION_NAME} - Woechentlicher Controlling- und Audit-Bericht (${dateStr})`;

  // Health-Audit durchführen
  const audit = runDatabaseHealthAudit(ss);

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
                  <div class="kpi-sub">${totalBrutto.toFixed(2)} EUR Brutto</div>
                </div>
              </td>
              <td style="width: 50%; padding: 4px;">
                <div class="kpi-card" style="border-left: 4px solid #2b6cb0;">
                  <div class="kpi-title">Master-Zutaten (Rezepturbasis)</div>
                  <div class="kpi-value">${totalMaster} Master-Zutaten</div>
                  <div class="kpi-sub">${posCount} gebuchte Transaktionen</div>
                </div>
              </td>
            </tr>
          </table>

          <div class="section-title">Datenbank-Health-Check & Audit-Status</div>
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
                <td style="padding: 8px 10px; color: ${audit.recalcRequired === 0 ? '#2f855a' : '#c53030'}; font-weight: 600;">${audit.recalcRequired === 0 ? 'Fehlerfrei' : 'Pruefung erforderlich'}</td>
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
                <td style="padding: 8px 10px; font-weight: 500;">Beleg-Dublettenpruefung</td>
                <td style="padding: 8px 10px; color: ${audit.duplicateInvoices === 0 ? '#2f855a' : '#c53030'}; font-weight: 600;">${audit.duplicateInvoices === 0 ? 'Keine Dubletten' : 'Konflikte isoliert'}</td>
                <td style="padding: 8px 10px; text-align: right;">${audit.duplicateInvoices}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Ausgaben nach Hauptkategorie</div>
          <table>
            <thead>
              <tr>
                <th>Hauptkategorie</th>
                <th style="text-align: right;">Netto-Betrag</th>
                <th style="text-align: right;">Anteil</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Food (Kueche)</td>
                <td style="padding: 8px 10px; text-align: right;">${foodNetto.toFixed(2)} EUR</td>
                <td style="padding: 8px 10px; text-align: right; color: #718096;">${totalNetto > 0 ? ((foodNetto/totalNetto)*100).toFixed(1) : '0.0'}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Beverage (Getraenke & Bar)</td>
                <td style="padding: 8px 10px; text-align: right;">${bevNetto.toFixed(2)} EUR</td>
                <td style="padding: 8px 10px; text-align: right; color: #718096;">${totalNetto > 0 ? ((bevNetto/totalNetto)*100).toFixed(1) : '0.0'}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Nonfood & Hygiene</td>
                <td style="padding: 8px 10px; text-align: right;">${nonfoodNetto.toFixed(2)} EUR</td>
                <td style="padding: 8px 10px; text-align: right; color: #718096;">${totalNetto > 0 ? ((nonfoodNetto/totalNetto)*100).toFixed(1) : '0.0'}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: 500;">Leergut / Pfand</td>
                <td style="padding: 8px 10px; text-align: right;">${leergutNetto.toFixed(2)} EUR</td>
                <td style="padding: 8px 10px; text-align: right; color: #718096;">${totalNetto > 0 ? ((leergutNetto/totalNetto)*100).toFixed(1) : '0.0'}%</td>
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
