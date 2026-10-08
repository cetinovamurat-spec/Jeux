// 📊 ÉPREUVE 6 — ANALYSE DE GRAPHIQUE
// Format : { q, choix: [BONNE, fausse, fausse, fausse], d, cat, info, graphique: {...} }
// graphique : {
//   type: 'barres' | 'courbes',
//   titre, unite,
//   labels: [...],                         // axe horizontal
//   series: [{ nom, valeurs: [...] }],     // 1 à 3 séries, MÊME unité (un seul axe)
//   anomalie: [index, ...],                // points mis en évidence à la révélation
//   min: nombre (optionnel, courbes uniquement) // pour les pièges d'échelle
// }
// Données fictives mais crédibles.

const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const ANS = ['2021', '2022', '2023', '2024', '2025'];

module.exports = [
  // ───── Évident ─────
  {
    q: 'Clôture au 31/12. Quel mois est le plus suspect ?',
    choix: ['Décembre', 'Août', 'Janvier', 'Novembre'], d: 1, cat: 'Chiffre d’affaires',
    info: 'Un pic juste avant la clôture : risque de cut-off (ventes de janvier anticipées) voire de CA fictif. Août bas = vacances, rien d’anormal.',
    graphique: { type: 'barres', titre: 'Chiffre d’affaires mensuel', unite: 'k€', labels: MOIS, series: [{ nom: 'CA', valeurs: [410, 395, 430, 420, 445, 400, 380, 300, 435, 450, 470, 890] }], anomalie: [11] },
  },
  {
    q: 'Quelle est l’explication la plus probable du pic de consommation de café du cabinet ?',
    choix: ['La busy season (clôtures au 31/12)', 'Une nouvelle machine à café', 'Une canicule', 'Une erreur de comptage du stagiaire'], d: 1, cat: 'Vie du cabinet',
    info: 'Mars–avril : les comptes au 31/12 doivent être certifiés. La machine à café, elle, ne certifie rien.',
    graphique: { type: 'barres', titre: 'Consommation de café du cabinet', unite: 'litres', labels: MOIS, series: [{ nom: 'Café', valeurs: [62, 70, 118, 125, 64, 58, 40, 22, 55, 60, 63, 72] }], anomalie: [2, 3] },
  },
  {
    q: 'Quelle mission a explosé son budget d’heures ?',
    choix: ['Mission D', 'Mission C', 'Mission B', 'Mission A'], d: 1, cat: 'Budget',
    info: 'Mission C est la plus grosse… mais elle tient son budget. La D a plus que doublé : le client « n’avait pas encore préparé les pièces ».',
    graphique: { type: 'barres', titre: 'Heures budgétées vs réalisées', unite: 'heures', labels: ['Mission A', 'Mission B', 'Mission C', 'Mission D', 'Mission E'], series: [{ nom: 'Budget', valeurs: [120, 80, 200, 90, 150] }, { nom: 'Réalisé', valeurs: [118, 85, 205, 210, 140] }], anomalie: [3] },
  },
  {
    q: 'À partir de quand le recouvrement clients se dégrade-t-il nettement ?',
    choix: ['T3 2025', 'T2 2024', 'T1 2025', 'T4 2024'], d: 1, cat: 'Créances',
    info: 'Le DSO passe de ~60 à 95 jours : clients en difficulté, litiges, ou relances abandonnées ?',
    graphique: { type: 'courbes', titre: 'Délai moyen de paiement clients (DSO)', unite: 'jours', labels: ['T1 24', 'T2 24', 'T3 24', 'T4 24', 'T1 25', 'T2 25', 'T3 25', 'T4 25'], series: [{ nom: 'DSO', valeurs: [58, 61, 59, 62, 60, 63, 95, 98] }], anomalie: [6] },
  },

  // ───── Intermédiaire ─────
  {
    q: 'Le taux de marge brute est historiquement stable. Quelle année mérite une investigation ?',
    choix: ['2023', '2021', '2025', '2019'], d: 2, cat: 'Marge',
    info: '+8 points sans changement d’activité : cut-off sur les achats, stock surévalué ou CA fictif ?',
    graphique: { type: 'courbes', titre: 'Taux de marge brute', unite: '%', labels: ['2019', '2020', '2021', '2022', '2023', '2024', '2025'], series: [{ nom: 'Marge brute', valeurs: [33.1, 32.8, 33.5, 32.9, 41.2, 33.4, 33.0] }], anomalie: [4], min: 0 },
  },
  {
    q: 'Quelle est la conclusion la plus pertinente ?',
    choix: ['Risque de recouvrement : des créances douteuses à provisionner ?', 'Le CA explose', 'La trésorerie s’améliore', 'Rien à signaler'], d: 2, cat: 'Créances',
    info: 'CA stable, créances multipliées par 2,4 : soit les clients ne paient plus, soit certaines ventes n’existent pas…',
    graphique: { type: 'courbes', titre: 'Chiffre d’affaires vs créances clients', unite: 'M€', labels: ANS, series: [{ nom: 'Chiffre d’affaires', valeurs: [12.0, 12.4, 12.1, 12.6, 12.3] }, { nom: 'Créances clients', valeurs: [2.1, 2.2, 2.3, 3.6, 5.1] }], anomalie: [3, 4] },
  },
  {
    q: 'Que faut-il investiguer en 2024 ?',
    choix: ['La masse salariale bondit sans hausse d’effectif', 'L’effectif explose', 'La masse salariale baisse', 'Rien, tout est cohérent'], d: 2, cat: 'Masse salariale',
    info: 'Primes exceptionnelles ? Erreur sur les congés payés ? Salariés fantômes ? En tout cas, ça mérite un rapprochement avec les DSN.',
    graphique: { type: 'courbes', titre: 'Effectif et masse salariale (indice base 100 en 2021)', unite: 'indice', labels: ANS, series: [{ nom: 'Effectif', valeurs: [100, 102, 101, 103, 102] }, { nom: 'Masse salariale', valeurs: [100, 104, 106, 135, 138] }], anomalie: [3] },
  },
  {
    q: 'Quel est le risque principal ?',
    choix: ['Dépréciation des stocks (stock dormant ou obsolète)', 'Rupture de stock', 'Hausse des marges', 'Aucun risque'], d: 2, cat: 'Stocks',
    info: 'Les ventes baissent, le stock gonfle : le stock ne se vend plus. Test de rotation et provision en vue.',
    graphique: { type: 'courbes', titre: 'Chiffre d’affaires vs stocks', unite: 'M€', labels: ANS, series: [{ nom: 'Chiffre d’affaires', valeurs: [20, 21, 19.5, 17, 15] }, { nom: 'Stocks', valeurs: [3.0, 3.1, 3.6, 4.8, 6.2] }], anomalie: [3, 4] },
  },
  {
    q: 'Notes de frais par jour de la semaine : quel jour est le plus suspect ?',
    choix: ['Samedi', 'Vendredi', 'Lundi', 'Dimanche'], d: 2, cat: 'Notes de frais',
    info: 'Des frais « professionnels » record un samedi, quand personne ne travaille officiellement…',
    graphique: { type: 'barres', titre: 'Notes de frais par jour de la semaine', unite: 'k€', labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], series: [{ nom: 'Notes de frais', valeurs: [14, 15, 13, 16, 18, 21, 2] }], anomalie: [5] },
  },
  {
    q: '« Conseil & Co » a été créé il y a 6 mois et partage l’adresse d’un administrateur. Que faites-vous ?',
    choix: ['J’investigue Conseil & Co (fournisseur fictif ou partie liée ?)', 'J’investigue Bureau Pro', 'Rien, c’est un fournisseur comme les autres', 'J’investigue Métal+, c’est le plus gros'], d: 2, cat: 'Achats',
    info: 'Jeune fournisseur, montants importants, lien avec un dirigeant : le combo classique des parties liées et des fournisseurs fictifs.',
    graphique: { type: 'barres', titre: 'Achats par fournisseur', unite: 'k€', labels: ['Métal+', 'Logistix', 'Conseil & Co', 'Bureau Pro', 'ÉnergieSud'], series: [{ nom: 'Achats', valeurs: [820, 610, 540, 95, 310] }], anomalie: [2] },
  },
  {
    q: 'Le dirigeant affirme : « Notre CA a presque doublé en deux ans ! » Votre avis ?',
    choix: ['Faux : +9 % seulement en deux ans', 'Vrai : environ +90 %', 'Vrai : il a doublé', 'Impossible à dire'], d: 2, cat: 'Piège d’échelle',
    info: 'L’axe démarre à 10 M€ : l’illusion est parfaite. 10,2 → 11,1 M€ = +8,8 %. Toujours regarder l’échelle !',
    graphique: { type: 'courbes', titre: 'Chiffre d’affaires (présentation du dirigeant)', unite: 'M€', labels: ['2023', '2024', '2025'], series: [{ nom: 'CA', valeurs: [10.2, 10.6, 11.1] }], anomalie: [2], min: 10 },
  },
  {
    q: 'Un nouveau dirigeant est arrivé en 2024. Quelle question posez-vous en priorité ?',
    choix: ['À quoi correspondent les 310 k€ d’honoraires de 2024 ?', 'Pourquoi les honoraires baissent en 2025 ?', 'Pourquoi 2022 est supérieur à 2021 ?', 'Aucune, c’est un montant normal'], d: 2, cat: 'Charges externes',
    info: 'Un pic isolé d’honoraires l’année d’un changement de direction : prestations réelles ? contrat avec une partie liée ? indemnités déguisées ?',
    graphique: { type: 'barres', titre: 'Honoraires de conseil', unite: 'k€', labels: ANS, series: [{ nom: 'Honoraires', valeurs: [45, 50, 48, 310, 55] }], anomalie: [3] },
  },

  // ───── Subtil ─────
  {
    q: 'Que suggère le pic de trésorerie au 31 décembre ?',
    choix: ['Un possible habillage de bilan (window dressing)', 'Une saisonnalité normale', 'Une erreur sur l’axe', 'Une baisse d’activité'], d: 3, cat: 'Trésorerie',
    info: 'Encaissements accélérés, fournisseurs payés en retard ou crédit court terme juste avant la clôture : regardez janvier !',
    graphique: { type: 'courbes', titre: 'Trésorerie de fin de mois', unite: 'k€', labels: MOIS, series: [{ nom: 'Trésorerie', valeurs: [220, 180, 150, 170, 140, 160, 130, 110, 150, 140, 120, 690] }], anomalie: [11] },
  },
  {
    q: 'L’EBITDA progresse, le résultat net s’effondre. Explication la plus probable ?',
    choix: ['Hausse des amortissements et/ou des frais financiers', 'Baisse du chiffre d’affaires', 'Baisse des achats', 'Hausse de la marge brute'], d: 3, cat: 'EBITDA',
    info: 'L’EBITDA ignore amortissements, intérêts et impôts. Gros investissements financés par la dette : EBITDA radieux, résultat net en berne.',
    graphique: { type: 'courbes', titre: 'EBITDA vs résultat net', unite: 'M€', labels: ANS, series: [{ nom: 'EBITDA', valeurs: [3.0, 3.4, 3.9, 4.3, 4.8] }, { nom: 'Résultat net', valeurs: [1.2, 1.3, 1.1, 0.4, -0.3] }], anomalie: [3, 4] },
  },
  {
    q: 'Clôture au 31/12. Que suggère le pic d’avoirs en janvier ?',
    choix: ['Des ventes de décembre annulées : CA N surévalué ?', 'Une campagne commerciale réussie', 'Les soldes d’hiver', 'Un nouveau logiciel de facturation'], d: 3, cat: 'Cut-off',
    info: 'Facturer en décembre, annuler par avoir en janvier : le grand classique pour atteindre l’objectif annuel.',
    graphique: { type: 'barres', titre: 'Avoirs émis par mois', unite: 'k€', labels: ['Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr'], series: [{ nom: 'Avoirs', valeurs: [12, 9, 13, 11, 14, 12, 96, 15] }], anomalie: [6] },
  },
  {
    q: 'Quelle année présente une incohérence ?',
    choix: ['2024', '2023', '2025', '2022'], d: 3, cat: 'TVA',
    info: 'La TVA collectée suit normalement le CA (~20 %). En 2024 : 1,3 M€ pour 9,4 M€ de CA. Déclarations incomplètes ?',
    graphique: { type: 'courbes', titre: 'CA HT vs TVA collectée', unite: 'M€', labels: ANS, series: [{ nom: 'CA HT', valeurs: [8.0, 8.5, 9.0, 9.4, 9.9] }, { nom: 'TVA collectée', valeurs: [1.6, 1.7, 1.8, 1.3, 1.98] }], anomalie: [3] },
  },
  {
    q: 'Ventes hebdomadaires d’un commercial sur le trimestre. Que suggère la semaine 13 ?',
    choix: ['Des ventes gonflées pour atteindre l’objectif trimestriel', 'Une saisonnalité normale', 'Des congés en semaine 12', 'Une erreur d’axe'], d: 3, cat: 'Chiffre d’affaires',
    info: 'Cinq fois la moyenne la dernière semaine du trimestre, pile avant le calcul des primes : contrôle des retours et avoirs du trimestre suivant.',
    graphique: { type: 'barres', titre: 'Ventes hebdomadaires — Commercial n°7', unite: 'k€', labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13'], series: [{ nom: 'Ventes', valeurs: [40, 42, 38, 41, 39, 43, 40, 37, 42, 41, 44, 45, 210] }], anomalie: [12] },
  },
  {
    q: 'Pour un glacier de bord de mer, quelle affirmation est FAUSSE ?',
    choix: ['Le pic de juillet est une anomalie à investiguer', 'L’activité est très saisonnière', 'Le BFR varie fortement dans l’année', 'L’hiver pèse peu dans le CA'], d: 3, cat: 'Saisonnalité',
    info: 'Le pic estival est parfaitement normal pour un glacier. Ne pas confondre saisonnalité et anomalie !',
    graphique: { type: 'barres', titre: 'CA mensuel — Glacier « Le Cornet d’Or »', unite: 'k€', labels: MOIS, series: [{ nom: 'CA', valeurs: [12, 14, 20, 35, 60, 110, 160, 150, 70, 30, 15, 13] }], anomalie: [] },
  },
  {
    q: 'Le seuil de double validation des factures est de 5 000 €. Que remarquez-vous ?',
    choix: ['Une concentration juste sous le seuil : fractionnement de factures ?', 'Trop de petites factures', 'Rien d’anormal', 'Les factures au-dessus de 5 000 € sont suspectes'], d: 3, cat: 'Contrôle interne',
    info: 'Découper une facture pour rester sous le seuil d’approbation : contournement du contrôle interne.',
    graphique: { type: 'barres', titre: 'Nombre de factures par tranche de montant', unite: 'factures', labels: ['0–1 k€', '1–2 k€', '2–3 k€', '3–4 k€', '4–5 k€', '5–6 k€', '6–7 k€'], series: [{ nom: 'Factures', valeurs: [120, 95, 80, 70, 260, 15, 12] }], anomalie: [4] },
  },

  // ───── Expert ─────
  {
    q: 'Premiers chiffres des paiements fournisseurs vs loi de Benford. Quel chiffre est anormal ?',
    choix: ['4', '1', '2', '9'], d: 4, cat: 'Benford',
    info: 'Trop de montants commençant par 4 : beaucoup de paiements entre 4 000 et 4 999 €, juste sous un seuil d’autorisation à 5 000 € ?',
    graphique: { type: 'barres', titre: 'Fréquence du premier chiffre', unite: '%', labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], series: [{ nom: 'Paiements observés', valeurs: [29.8, 17.2, 12.1, 21.9, 7.4, 4.1, 3.2, 2.4, 1.9] }, { nom: 'Loi de Benford', valeurs: [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6] }], anomalie: [3] },
  },
  {
    q: 'Résultat net en hausse continue, flux de trésorerie opérationnels en chute. Que suggère cet écart ?',
    choix: ['Une qualité de résultat douteuse : les bénéfices ne se transforment pas en cash', 'Une gestion de trésorerie exemplaire', 'Une baisse du chiffre d’affaires', 'Une hausse des dividendes'], d: 4, cat: 'Qualité du résultat',
    info: 'Bénéfices qui montent, cash qui fond : créances, stocks, produits comptabilisés trop tôt… C’est le profil de nombreuses fraudes célèbres.',
    graphique: { type: 'courbes', titre: 'Résultat net vs flux de trésorerie opérationnels', unite: 'M€', labels: ANS, series: [{ nom: 'Résultat net', valeurs: [1.0, 1.4, 1.9, 2.5, 3.2] }, { nom: 'Flux opérationnels', valeurs: [1.1, 1.2, 0.8, 0.2, -0.6] }], anomalie: [3, 4] },
  },
];
