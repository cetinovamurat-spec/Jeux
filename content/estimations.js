// 🔢 ÉPREUVE 2 — ESTIMATION IMPOSSIBLE
// Format : { q, reponse: nombre (> 0), unite, cat, info }
//  • cat: 'Cabinet' = questions métier (au moins la moitié des questions de l'épreuve).
//  • Les réponses « officielles du Comité » sont des estimations assumées pour le fun :
//    elles sont signalées comme telles dans « info ».

const COMITE = 'Chiffre officiel du Comité des Olympiades (méthode : un stagiaire, un week-end, un surligneur). Contestations à adresser au service réclamations, fermé.';

module.exports = [
  // ───── Monde réel ─────
  { q: 'Combien d’habitants compte la France (outre-mer inclus) ?', reponse: 68600000, unite: 'habitants', cat: 'France', info: 'Environ 68,6 millions selon l’Insee (début 2025).' },
  { q: 'Combien de communes compte la France ?', reponse: 34900, unite: 'communes', cat: 'France', info: 'Un peu moins de 35 000, record mondial (ou presque) de clochers.' },
  { q: 'Quelle est la hauteur de la tour Eiffel, antennes comprises ?', reponse: 330, unite: 'mètres', cat: 'France', info: '330 m depuis l’installation d’une nouvelle antenne en 2022.' },
  { q: 'Combien de marches pour monter au sommet de la tour Eiffel ?', reponse: 1665, unite: 'marches', cat: 'France', info: '1 665 marches jusqu’au sommet (seules 674 sont accessibles au public).' },
  { q: 'Quelle est la distance moyenne entre la Terre et la Lune ?', reponse: 384400, unite: 'km', cat: 'Sciences' },
  { q: 'Combien de pays sont membres de l’ONU ?', reponse: 193, unite: 'pays', cat: 'Monde' },
  { q: 'Combien de neurones compte un cerveau humain ?', reponse: 86000000000, unite: 'neurones', cat: 'Sciences', info: 'Environ 86 milliards. Même un lundi matin.' },
  { q: 'Combien de cafés sont bus chaque jour en France ?', reponse: 100000000, unite: 'tasses', cat: 'France', info: 'Les estimations tournent autour de 100 millions de tasses par jour (selon les études, de 80 à 130 millions).' },
  { q: 'Quelle est la hauteur officielle du mont Blanc ?', reponse: 4805, unite: 'mètres', cat: 'France', info: '4 805,59 m lors de la dernière mesure : il rétrécit légèrement selon l’épaisseur de neige.' },
  { q: 'Combien de secondes y a-t-il dans une journée ?', reponse: 86400, unite: 'secondes', cat: 'Sciences' },
  { q: 'Combien d’années faudrait-il pour compter jusqu’à un milliard, à raison d’un nombre par seconde, sans pause ?', reponse: 31.7, unite: 'ans', cat: 'Absurde', info: 'Environ 31,7 ans. Sans pause café. Inhumain.' },
  { q: 'Combien de cellules contient une seule feuille Excel ?', reponse: 17179869184, unite: 'cellules', cat: 'Cabinet', info: '1 048 576 lignes × 16 384 colonnes = plus de 17 milliards. Et pourtant il en manque toujours une.' },
  { q: 'Combien de lignes au maximum dans une feuille Excel ?', reponse: 1048576, unite: 'lignes', cat: 'Cabinet', info: '2^20 = 1 048 576. Le FEC de certains clients en exige davantage.' },
  { q: 'Combien de mails sont envoyés dans le monde chaque jour ?', reponse: 350000000000, unite: 'mails', cat: 'Monde', info: 'Environ 350 milliards par jour. Dont une bonne part de « petites relances ».' },
  { q: 'Combien pèse un nuage cumulus de taille moyenne ?', reponse: 500, unite: 'tonnes', cat: 'Sciences', info: 'Environ 500 tonnes d’eau en suspension. Légèreté apparente, comme une provision pour risques.' },
  { q: 'Combien de bouteilles de champagne sont vendues chaque année dans le monde ?', reponse: 280000000, unite: 'bouteilles', cat: 'France', info: 'Entre 270 et 300 millions selon les années.' },
  { q: 'Combien de visiteurs le Louvre a-t-il accueillis en 2024 ?', reponse: 8700000, unite: 'visiteurs', cat: 'France', info: 'Environ 8,7 millions : le musée le plus visité au monde.' },
  { q: 'Combien de kilomètres parcourt en moyenne un footballeur professionnel pendant un match ?', reponse: 11, unite: 'km', cat: 'Sport', info: 'Entre 10 et 13 km pour un milieu de terrain.' },
  { q: 'Combien d’heures compte une année non bissextile ?', reponse: 8760, unite: 'heures', cat: 'Cabinet', info: '8 760 heures. Facturables ? Le manager aimerait.' },
  { q: 'Combien de mots contient le Petit Robert ?', reponse: 60000, unite: 'mots', cat: 'Culture', info: 'Environ 60 000 mots pour 300 000 sens. « Immatériel » y figure.' },
  { q: 'Quelle est la vitesse de pointe d’un guépard ?', reponse: 110, unite: 'km/h', cat: 'Nature' },

  // ───── Cabinet ─────
  { q: 'Pendant combien d’années faut-il conserver les pièces comptables (Code de commerce) ?', reponse: 10, unite: 'ans', cat: 'Cabinet' },
  { q: 'Combien d’heures de formation continue un commissaire aux comptes doit-il suivre sur 3 ans ?', reponse: 120, unite: 'heures', cat: 'Cabinet', info: '120 heures sur trois ans, avec un minimum de 20 heures par an.' },
  { q: 'Quel est le taux normal de l’impôt sur les sociétés en France ?', reponse: 25, unite: '%', cat: 'Cabinet' },
  { q: 'Combien d’experts-comptables sont inscrits à l’Ordre en France ?', reponse: 22000, unite: 'experts-comptables', cat: 'Cabinet', info: 'Un peu plus de 21 000 à 22 000 selon les années.' },
  { q: 'Combien de fois le mot « cependant » apparaît-il dans 1 000 rapports d’audit ?', reponse: 4200, unite: 'occurrences', cat: 'Cabinet', info: COMITE },
  { q: 'Combien de feuilles A4 les cabinets d’audit français impriment-ils chaque année ?', reponse: 250000000, unite: 'feuilles', cat: 'Cabinet', info: COMITE + ' (≈ 50 000 professionnels × 5 000 pages).' },
  { q: 'Combien de relances faut-il en moyenne pour obtenir une réponse de circularisation bancaire ?', reponse: 2.7, unite: 'relances', cat: 'Cabinet', info: COMITE },
  { q: 'Combien de lignes contient en moyenne le FEC d’une PME de 10 M€ de chiffre d’affaires ?', reponse: 80000, unite: 'lignes', cat: 'Cabinet', info: COMITE + ' Ça dépend énormément du secteur… et du nombre de tickets de caisse.' },
  { q: 'Combien d’heures travaille un auditeur pendant une busy season (janvier → avril) ?', reponse: 900, unite: 'heures', cat: 'Cabinet', info: COMITE + ' Les feuilles de temps, elles, en déclarent 610.' },
  { q: 'Combien de cafés un auditeur boit-il pendant une busy season ?', reponse: 340, unite: 'cafés', cat: 'Cabinet', info: COMITE + ' 4 par jour × 85 jours ouvrés. Hors thé (les traîtres).' },
  { q: 'Combien de mails « Petite relance » un auditeur envoie-t-il par an ?', reponse: 400, unite: 'mails', cat: 'Cabinet', info: COMITE },
  { q: 'Combien de coches (tickmarks) contient un dossier d’audit moyen ?', reponse: 3000, unite: 'coches', cat: 'Cabinet', info: COMITE },
  { q: 'Combien de versions « VF_def_FINAL » d’un même fichier existent en moyenne sur un serveur de cabinet ?', reponse: 7, unite: 'versions', cat: 'Cabinet', info: COMITE + ' Record connu : « VF_def_FINAL_v12_OK_ok_vraimentfinal.xlsx ».' },
  { q: 'Combien de minutes dure en moyenne un « point rapide » avec le manager ?', reponse: 47, unite: 'minutes', cat: 'Cabinet', info: COMITE },
];
