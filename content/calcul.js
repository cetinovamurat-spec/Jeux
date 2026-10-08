// 🧮 ÉPREUVE 5 — CALCUL MENTAL (et pièges comptables)
// QCM : { q, choix: [BONNE, fausse, fausse, fausse], d, cat, info }
// Réponse chiffrée : { type: 'nombre', q, reponse, tol (tolérance absolue), unite, d, cat, info }

module.exports = [
  // ───── Facile ─────
  { type: 'nombre', q: 'TVA collectée : 50 000 €. TVA déductible : 32 000 €. Combien de TVA à décaisser ?', reponse: 18000, tol: 0, unite: '€', d: 1, cat: 'TVA' },
  { type: 'nombre', q: 'Combien font 12,5 % de 3 200 ?', reponse: 400, tol: 0, d: 1, cat: 'Pourcentages' },
  { type: 'nombre', q: '1 000 € HT de livres, TVA à 5,5 %. Montant TTC ?', reponse: 1055, tol: 0, unite: '€', d: 1, cat: 'TVA' },
  { q: 'Un fournisseur facture 1 000 € HT + 200 € de TVA récupérable. Combien passez-vous en charge ?', choix: ['1 000 €', '1 200 €', '800 €', '1 166 €'], d: 1, cat: 'Piège', info: 'La TVA récupérable va en 44566, pas en charge.' },
  { type: 'vf', q: 'Une remise de 10 % suivie d’une autre remise de 10 % équivaut à une remise de 20 %.', vrai: false, d: 1, cat: 'Piège', info: '0,9 × 0,9 = 0,81 → remise de 19 %.' },
  { q: 'Si 5 clones de {joueur} lettrent 5 comptes en 5 minutes, combien de temps faut-il à 100 clones de {joueur} pour lettrer 100 comptes ?', choix: ['5 minutes', '100 minutes', '20 minutes', '1 minute'], d: 1, cat: 'Logique', info: 'Chaque auditeur lettre un compte en 5 minutes. Le manager, lui, en demande 6.' },
  { q: '{joueur} a acheté des croissants pour l’équipe avec la carte de la société. Quelle écriture ?', choix: ['Débit 625 (réceptions) / Crédit 512', 'Débit 512 / Crédit 625', 'Débit 411 / Crédit 707', 'Débit 101 (capital) / Crédit 512'], d: 1, cat: 'Écriture absurde', info: 'Compte 6257 « Réceptions ». Le capital social n’a rien demandé.' },

  // ───── Moyen ─────
  { q: 'CA N : 8,4 M€. CA N-1 : 7,2 M€. Quel est le taux de croissance ?', choix: ['+16,7 %', '+14,3 %', '+12 %', '+1,2 %'], d: 2, cat: 'Croissance', info: '(8,4 − 7,2) / 7,2. Le piège : diviser par 8,4 (→ 14,3 %).' },
  { q: 'Une facture de 1 200 € TTC (TVA 20 %). Quel est le montant HT ?', choix: ['1 000 €', '960 €', '1 040 €', '980 €'], d: 2, cat: 'TVA', info: '1 200 / 1,2 = 1 000. Le piège : 1 200 × 0,8 = 960.' },
  { q: 'Un prix augmente de 50 %, puis baisse de 50 %. Variation totale ?', choix: ['−25 %', '0 %', '−50 %', '+25 %'], d: 2, cat: 'Piège', info: '1,5 × 0,5 = 0,75.' },
  { type: 'nombre', q: 'Prix de vente 200 €, taux de marge sur prix de vente (taux de marque) 25 %. Coût d’achat ?', reponse: 150, tol: 0, unite: '€', d: 2, cat: 'Marges' },
  { type: 'nombre', q: 'CA TTC annuel : 12 M€. Créances clients TTC : 3 M€. DSO en jours (base 360) ?', reponse: 90, tol: 0, unite: 'jours', d: 2, cat: 'Ratios' },
  { type: 'nombre', q: 'Actif circulant : 6 M€. Passif circulant : 4 M€. Ratio de liquidité générale ?', reponse: 1.5, tol: 0.01, d: 2, cat: 'Ratios' },
  { type: 'nombre', q: 'Stock initial 50 k€, achats 300 k€, stock final 70 k€. Coût d’achat des marchandises vendues (en k€) ?', reponse: 280, tol: 0, unite: 'k€', d: 2, cat: 'Stocks' },
  { type: 'nombre', q: 'Combien font 15 % de 80 % de 500 ?', reponse: 60, tol: 0, d: 2, cat: 'Pourcentages' },
  { type: 'nombre', q: '10 000 € placés à 3 % par an (intérêts simples) pendant 6 mois. Intérêts perçus ?', reponse: 150, tol: 0, unite: '€', d: 2, cat: 'Finance' },
  { type: 'nombre', q: 'CA : 2 M€. Résultat net : 150 k€. Marge nette en % ?', reponse: 7.5, tol: 0.05, unite: '%', d: 2, cat: 'Marges' },
  { q: 'Une batte et une balle coûtent 1,10 € au total. La batte coûte 1 € de plus que la balle. Prix de la balle ?', choix: ['0,05 €', '0,10 €', '0,01 €', '0,15 €'], d: 2, cat: 'Logique', info: 'Balle 0,05 + batte 1,05 = 1,10. Le cerveau répond 0,10 par réflexe.' },
  { type: 'nombre', q: '+10 % la première année, +10 % la deuxième. Croissance totale en % ?', reponse: 21, tol: 0, unite: '%', d: 2, cat: 'Croissance' },
  { q: 'Un client a encaissé 120 k€ d’acompte sur une commande livrée l’an prochain. Où va ce montant à la clôture ?', choix: ['Au passif : avances et acomptes reçus', 'En chiffre d’affaires', 'À l’actif : créances clients', 'En capitaux propres'], d: 2, cat: 'Comptabilité' },
  { type: 'nombre', q: 'Coût des ventes : 6 M€. Stock moyen : 1,5 M€. Combien de rotations du stock par an ?', reponse: 4, tol: 0, unite: 'fois', d: 2, cat: 'Stocks' },
  { q: 'CA N-1 : 5 M€. Croissance N : −20 %. Croissance N+1 : +20 %. CA N+1 ?', choix: ['4,8 M€', '5 M€', '5,2 M€', '4,6 M€'], d: 2, cat: 'Piège' },
  { type: 'nombre', q: 'Stocks 2 M€ + créances clients 3 M€ − dettes fournisseurs 2,5 M€. BFR (en M€) ?', reponse: 2.5, tol: 0.01, unite: 'M€', d: 2, cat: 'Ratios' },
  { type: 'nombre', q: 'Combien font 17 × 23 ?', reponse: 391, tol: 0, d: 2, cat: 'Calcul pur' },

  // ───── Difficile ─────
  { q: 'Le client de {joueur} annonce une marge de 12 %. Son CA augmente de 25 % et ses charges de 40 %. Quel est le problème ?', choix: ['Sa marge s’effondre à environ 1,4 %', 'Sa marge monte à 15 %', 'Aucun : le CA augmente', 'Sa marge reste à 12 %'], d: 3, cat: 'Piège', info: 'CA 100 → 125, charges 88 → 123,2 : résultat 1,8 sur 125.' },
  { q: 'Coût d’achat 80 €, taux de marque (marge / prix de vente) 20 %. Prix de vente ?', choix: ['100 €', '96 €', '104 €', '120 €'], d: 3, cat: 'Marges', info: '80 / (1 − 0,2) = 100. Le piège : appliquer 20 % sur le coût (→ 96 €).' },
  { q: 'CA 10 M€, achats consommés 4 M€, charges externes 2 M€, personnel 2,5 M€, impôts et taxes 0,3 M€, dotations aux amortissements 0,8 M€. EBITDA ?', choix: ['1,2 M€', '0,4 M€', '2,0 M€', '1,5 M€'], d: 3, cat: 'EBITDA', info: 'L’EBITDA s’arrête avant les amortissements : 10 − 4 − 2 − 2,5 − 0,3.' },
  { q: 'Immobilisation de 120 000 € amortie en linéaire sur 5 ans, acquise le 1er juillet N (exercice civil). Dotation N ?', choix: ['12 000 €', '24 000 €', '6 000 €', '20 000 €'], d: 3, cat: 'Amortissements', info: '24 000 € par an × 6/12 (prorata temporis).' },
  { q: 'Débit total 1 254 380 €, crédit total 1 254 830 €. L’écart (450 €) est divisible par 9. Que soupçonnez-vous ?', choix: ['Une inversion de chiffres à la saisie', 'Une écriture passée deux fois', 'Une fraude massive', 'Un problème d’arrondi'], d: 3, cat: 'Écarts', info: 'Un écart divisible par 9 trahit souvent une inversion (38 ↔ 83).' },
  { q: 'Charges fixes : 300 000 €. Taux de marge sur coûts variables : 40 %. Seuil de rentabilité ?', choix: ['750 000 €', '120 000 €', '420 000 €', '1 200 000 €'], d: 3, cat: 'Rentabilité', info: '300 000 / 0,4.' },
  { q: 'Capitaux propres 4 M€, dettes financières 6 M€, trésorerie 1 M€. Gearing (dette nette / capitaux propres) ?', choix: ['1,25', '1,5', '0,8', '1,75'], d: 3, cat: 'Ratios' },
  { q: 'Actif acquis 50 000 €, amorti à hauteur de 30 000 €, cédé 15 000 €. Résultat de cession ?', choix: ['Moins-value de 5 000 €', 'Plus-value de 15 000 €', 'Moins-value de 35 000 €', 'Plus-value de 5 000 €'], d: 3, cat: 'Immobilisations', info: 'VNC 20 000 € − prix 15 000 €.' },
  { q: 'Salaire brut 3 000 €/mois, charges patronales ≈ 45 %. Coût employeur annuel (12 mois) ?', choix: ['52 200 €', '36 000 €', '43 500 €', '49 800 €'], d: 3, cat: 'Masse salariale' },

  // ───── Extrême ─────
  { q: 'Budget de la mission de {joueur} : 120 h. Déjà 150 h consommées pour 80 % du travail. Dépassement final si le rythme reste le même ?', choix: ['67,5 h', '30 h', '37,5 h', '54 h'], d: 4, cat: 'Budget', info: '150 / 0,8 = 187,5 h au total. Le manager vous demandera d’en saisir 130.' },
  { type: 'nombre', q: 'Un CA passe de 4 M€ à 6,25 M€ en 2 ans. Taux de croissance annuel moyen (en %) ?', reponse: 25, tol: 0.5, unite: '%', d: 4, cat: 'Croissance', info: '√(6,25 / 4) = 1,25.' },
  { q: 'Marge brute de 40 % sur un CA de 5 M€. Le CA baisse de 10 % mais la marge brute (en €) reste identique. Nouveau taux de marge brute ?', choix: ['≈ 44,4 %', '40 %', '36 %', '50 %'], d: 4, cat: 'Marges', info: '2 M€ / 4,5 M€.' },
  { q: 'Un montant TTC de 1 000 € inclut une TVA à 20 %. Une erreur a appliqué 20 % sur le TTC pour calculer la TVA. De combien la TVA est-elle surévaluée ?', choix: ['≈ 33,33 €', '20 €', '40 €', '0 €'], d: 4, cat: 'TVA', info: 'TVA réelle : 166,67 €. Erronée : 200 €.' },
];
