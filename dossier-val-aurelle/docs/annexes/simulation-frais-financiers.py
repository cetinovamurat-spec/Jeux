"""Simulation J0 : frais financiers 2024/2025 et erreur d'ICNE (A08).

Modèle simplifié : prêts à échéance annuelle le 1er d'un mois, taux révisé à
chaque échéance = Livret A en vigueur à cette date + marge ; base exact/365 ;
encours constant sur l'année. L'erreur A08 = ICNE au taux unique de 3,0 %
moins ICNE au taux propre de chaque prêt (positive = ICNE surévalués).

Usage : python3 simulation-frais-financiers.py
"""
import random
from datetime import date

LIVRET_A = [(date(2022, 2, 1), 1.0), (date(2022, 8, 1), 2.0), (date(2023, 2, 1), 3.0),
            (date(2025, 2, 1), 2.4), (date(2025, 8, 1), 1.7)]


def livret_a(d):
    rate = 0.5
    for start, value in LIVRET_A:
        if d >= start:
            rate = value
    return rate


def interest_pct(month, margin, year):
    """Intérêts courus sur l'année civile, en % de l'encours."""
    prev_due, due = date(year - 1, month, 1), date(year, month, 1)
    before = (due - date(year, 1, 1)).days
    after = (date(year + 1, 1, 1) - due).days
    return ((livret_a(prev_due) + margin) * before + (livret_a(due) + margin) * after) / 365


def icne_error_pct(month, margin, flat=3.0):
    due = date(2025, month, 1)
    accrued = (date(2026, 1, 1) - due).days / 365
    return (flat - livret_a(due) - margin) * accrued


def portfolio(la_indexed, margin, other, other_rate, months=range(1, 13), other_ff=0.10):
    """Montants en M€. Échéances réparties uniformément sur `months`."""
    w = 1 / len(months)
    ff24 = sum(la_indexed * w * interest_pct(m, margin, 2024) / 100 for m in months)
    ff25 = sum(la_indexed * w * interest_pct(m, margin, 2025) / 100 for m in months)
    err = sum(la_indexed * w * icne_error_pct(m, margin) / 100 for m in months)
    ff24 += other * other_rate / 100 + other_ff
    ff25 += other * 0.965 * other_rate / 100 + other_ff
    return ff24, ff25, ff25 + err, err


def show(label, *args):
    ff24, ff25, ff25p, err = portfolio(*args)
    print(f"{label:<58} FF 2024 {ff24:5.2f} | FF 2025 réels {ff25:5.2f}"
          f" présentés {ff25p:5.2f} ({100 * (ff25p / ff24 - 1):+.1f} %) | A08 {-err * 1000:+5.0f} k€")


if __name__ == "__main__":
    print("Cibles du cahier des charges : FF 2024 9,6 ± 3 % | FF 2025 présentés 8,6 ± 3 % | A08 −236 ± 10 %\n")
    for m in (-0.2, 0.0, 0.3, 0.5, 0.6):
        show(f"84 % LA (302,5 M€), marge moyenne {m:+.2f}, autres 1 %", 302.5, m, 60.0, 1.0)
    print()
    show("Option 1 : 84 % LA, marge +0,50, autres 1 %", 302.5, 0.50, 60.0, 1.0)
    show("Option 2 : 64 % LA (233,6 M€), marge +0,46, autres 1 %", 233.6, 0.46, 128.9, 1.0)
    show("Option 3 : 84 % LA, marge −0,10, autres 0,5 %", 302.5, -0.10, 60.0, 0.5)

    # Recherche aléatoire : mix de produits réaliste, échéances quelconques (≤ 30 % par mois).
    random.seed(1)
    products = [0.6, -0.2, -0.45, 1.11]  # PLUS/PAM, PLAI, éco-prêt, PLS (marges indicatives à valider)
    hits = 0
    for _ in range(200_000):
        shares = [random.uniform(.40, .65), random.uniform(.15, .35), random.uniform(.03, .15), random.uniform(0, .08)]
        total = sum(shares)
        ff24 = ff25p = err = 0.0
        feasible = True
        for margin, share in zip(products, shares):
            raw = [random.random() ** 2 for _ in range(12)]
            weights = [x / sum(raw) for x in raw]
            if max(weights) > .30:
                feasible = False
                break
            for month, wgt in enumerate(weights, start=1):
                crd = 302.5 * share / total * wgt
                ff24 += crd * interest_pct(month, margin, 2024) / 100
                e = crd * icne_error_pct(month, margin) / 100
                ff25p += crd * interest_pct(month, margin, 2025) / 100 + e
                err += e
        if not feasible:
            continue
        r_o = random.uniform(.3, 2.5)
        ff24 += 60 * r_o / 100 + .1
        ff25p += 60 * .965 * r_o / 100 + .1
        if 9.312 <= ff24 <= 9.888 and 8.342 <= ff25p <= 8.858 and .2124 <= err <= .2596:
            hits += 1
    print(f"\nRecherche aléatoire (200 000 portefeuilles réalistes) : {hits} solution(s) satisfaisant les trois cibles.")
