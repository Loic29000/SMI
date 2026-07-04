"""
Convertit le fichier de vérification (import_a_verifier.xlsx, ou sa version
corrigée par l'utilisateur) en data.json prêt à être déposé dans server/.

Usage :
    python3 import_from_excel.py import_a_verifier.xlsx data.json

Peut être relancé autant de fois que nécessaire après correction du fichier
Excel — écrase entièrement data.json (ne fusionne pas avec un existant).
"""
import sys
import json
import re
import pandas as pd


def pad(n, min_len=2):
    s = str(n)
    return s.zfill(min_len)


def main(xlsx_path, out_path):
    installs = pd.read_excel(xlsx_path, sheet_name="Installations", dtype=str).fillna("")
    try:
        clients_only = pd.read_excel(xlsx_path, sheet_name="Clients sans installation", dtype=str).fillna("")
    except Exception:
        clients_only = pd.DataFrame(columns=["Code client", "Client"])

    clients = {}

    def get_client(code, name):
        if code not in clients:
            clients[code] = {"code": code, "name": name or code, "installations": [], "nextInstallNumber": 1}
        return clients[code]

    for _, r in installs.iterrows():
        code = str(r["Code client"]).strip()
        if not code:
            continue
        suffix = str(r["Suffixe installation"]).strip()
        full_code = str(r["Code complet (historique)"]).strip() or f"{code}-{suffix}"
        name = str(r["Client"]).strip()
        client = get_client(code, name)

        date_val = str(r.get("Date creation", "")).strip()
        created_at = f"{date_val}T00:00:00.000Z" if re.match(r"^\d{4}-\d{2}-\d{2}$", date_val) else None

        client["installations"].append({
            "number": suffix,
            "name": str(r["Nom affaire"]).strip() or full_code,
            "uniqueNumber": full_code,
            "createdAt": created_at
        })

        if re.match(r"^\d+$", suffix):
            client["nextInstallNumber"] = max(client["nextInstallNumber"], int(suffix) + 1)

    for _, r in clients_only.iterrows():
        code = str(r["Code client"]).strip()
        name = str(r["Client"]).strip()
        if code:
            get_client(code, name)

    for c in clients.values():
        c["installations"].sort(key=lambda i: i["uniqueNumber"])

    data = {
        "clients": sorted(clients.values(), key=lambda c: c["code"]),
        "chronos": {},
        "history": []
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    n_installs = sum(len(c["installations"]) for c in clients.values())
    print(f"{len(clients)} clients, {n_installs} installations écrits dans {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 import_from_excel.py <fichier_verifie.xlsx> <data.json>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
