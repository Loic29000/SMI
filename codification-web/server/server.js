const express = require("express");
const cors = require("cors");
const path = require("path");
const archiver = require("archiver");
const crypto = require("crypto");
const db = require("./db");
const rules = require("./codification");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function uid() { return crypto.randomBytes(6).toString("hex"); }

// ---------- Reference data ----------
app.get("/api/types", (req, res) => {
  res.json({ documents: rules.DOC_TYPES, programmes: rules.PRG_TYPES });
});

// ---------- Full state ----------
app.get("/api/state", (req, res) => {
  const data = db.load();
  res.json({ clients: data.clients, history: data.history });
});

// ---------- Clients ----------
app.post("/api/clients", (req, res) => {
  const { code, name } = req.body || {};
  if (!code || !/^[0-9]{3,5}$/.test(code)) {
    return res.status(400).json({ error: "Code client invalide (3 à 5 chiffres)" });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Nom de client requis" });
  }
  const data = db.load();
  if (data.clients.some(c => c.code === code)) {
    return res.status(409).json({ error: "Ce code client existe déjà" });
  }
  const client = { code, name: name.trim(), installations: [], nextInstallNumber: 1 };
  data.clients.push(client);
  db.save(data);
  res.status(201).json(client);
});

// ---------- Installations ----------
app.post("/api/clients/:code/installations", (req, res) => {
  const { code } = req.params;
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Nom d'installation requis" });
  }
  const data = db.load();
  const client = data.clients.find(c => c.code === code);
  if (!client) return res.status(404).json({ error: "Client introuvable" });

  const nextNum = client.nextInstallNumber || ((client.installations || []).length + 1);
  const installation = {
    number: rules.padNum(nextNum, 2),
    name: name.trim(),
    uniqueNumber: rules.uniqueNumberOf(code, rules.padNum(nextNum, 2)),
    createdAt: new Date().toISOString()
  };
  client.installations = client.installations || [];
  client.installations.push(installation);
  client.nextInstallNumber = nextNum + 1;
  db.save(data);
  res.status(201).json(installation);
});

// ---------- Preview (read-only, does not consume a chrono) ----------
app.get("/api/peek", (req, res) => {
  const { uniqueNumber, type } = req.query;
  if (!uniqueNumber || !type) return res.status(400).json({ error: "uniqueNumber et type requis" });
  const data = db.load();
  const key = rules.chronoKey(uniqueNumber, type);
  const nextNum = (data.chronos[key] || 0) + 1;
  res.json({ chrono: rules.padNum(nextNum, 3) });
});

// ---------- Code generation ----------
app.post("/api/generate", (req, res) => {
  const { kind, uniqueNumber, type, mode, comment, sep, sendToClient, existingId, archiveDate } = req.body || {};
  if (!kind || !uniqueNumber || !type || !mode) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }
  const data = db.load();
  let entry;

  if (mode === "new") {
    const key = rules.chronoKey(uniqueNumber, type);
    const chronoNum = (data.chronos[key] || 0) + 1;
    data.chronos[key] = chronoNum;
    const chrono = rules.padNum(chronoNum, 3);
    const cleanComment = rules.buildComment(comment, sep);
    let code = `${type}_${uniqueNumber}_${chrono}_${cleanComment}`;
    let rev = null;
    if (kind === "document" && sendToClient) {
      code += "_REV-A";
      rev = "A";
    }
    entry = {
      id: uid(), date: new Date().toISOString(), uniqueNumber, type, chrono,
      comment: cleanComment, code, kind, mode: "new", rev,
      baseCode: code.replace(/_REV-[A-Z]+$/, "")
    };
  } else if (mode === "revision") {
    const existing = data.history.find(h => h.id === existingId);
    if (!existing) return res.status(404).json({ error: "Document de référence introuvable" });
    const rev = rules.nextLetter(existing.rev);
    const code = `${existing.baseCode || existing.code}_REV-${rev}`;
    entry = {
      id: uid(), date: new Date().toISOString(), uniqueNumber, type,
      chrono: existing.chrono, comment: existing.comment, code, kind, mode: "revision", rev,
      baseCode: existing.baseCode || existing.code
    };
  } else if (mode === "archive") {
    const existing = data.history.find(h => h.id === existingId);
    if (!existing) return res.status(404).json({ error: "Programme de référence introuvable" });
    const d = archiveDate ? new Date(archiveDate + "T00:00:00") : new Date();
    const code = `${existing.baseCode || existing.code}_${rules.todayCode(d)}`;
    entry = {
      id: uid(), date: new Date().toISOString(), uniqueNumber, type,
      chrono: existing.chrono, comment: existing.comment, code, kind, mode: "archive_copy",
      baseCode: existing.baseCode || existing.code
    };
  } else {
    return res.status(400).json({ error: "Mode inconnu" });
  }

  data.history.unshift(entry);
  db.save(data);
  res.status(201).json(entry);
});

// ---------- Folder tree ZIP ----------
function treeStructure() {
  return {
    "10 - Documentation": {
      "11 - Docs client": { "Cahier des Charges": {}, "Dossier technique": {} },
      "12 - Docs SMI": { "Etude - Conception": {}, "Devis": {}, "Dossier validation": {}, "Gestion de projet": {} },
      "13 - Docs fournisseurs": { "AR commandes": {}, "Docs techniques": {}, "Offres fournisseurs": {} },
      "14 - Rapports Interventions": {}
    },
    "20 - Automatisme - Informatique": {
      "21 - Automate": { "Programmes": { "Archives": {} } },
      "22 - IHM": { "Programmes": { "Archives": {} } },
      "23 - Parametrage equipements": {},
      "24 - Securite": {},
      "25 - Licences client": {},
      "26 - Robot": {}
    },
    "30 - Electricite - Energie": {
      "31 - Etudes": { "Note de calcul": {} },
      "32 - Schemas": { "PDF": {}, "SEE": {}, "DWG": {} }
    },
    "40 - Securite": {
      "41 - Appreciation de risques": {}, "42 - Dossier de justification": {}, "43 - Organisme de controle": {}
    },
    "50 - Mecanique": {
      "51 - Client": {}, "52 - Manufacture - Fournisseur": {}, "53 - Mise en plan - 2D": {}
    },
    "60 - Photos": {},
    "70 - Echanges": { "71 - Recus": {}, "72 - Envoyes": {} },
    "80 - QSSE": {},
    "90 - Reception": {}
  };
}

function addTreeToArchive(archive, basePath, node) {
  Object.keys(node).forEach(key => {
    const folderPath = `${basePath}/${key}`;
    const children = node[key];
    if (children && Object.keys(children).length) {
      addTreeToArchive(archive, folderPath, children);
    } else {
      // archiver needs at least a placeholder to persist an empty dir in the zip
      archive.append(Buffer.alloc(0), { name: `${folderPath}/.gitkeep` });
    }
  });
}

app.get("/api/tree", (req, res) => {
  const { uniqueNumber, installName } = req.query;
  if (!uniqueNumber || !installName) {
    return res.status(400).json({ error: "uniqueNumber et installName requis" });
  }
  const rootName = `${uniqueNumber}_${installName}`.replace(/[\\/:*?"<>|]/g, "-");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${rootName}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", err => { res.status(500).end(); });
  archive.pipe(res);
  addTreeToArchive(archive, rootName, treeStructure());
  archive.finalize();
});

// ---------- CSV export ----------
app.get("/api/export.csv", (req, res) => {
  const data = db.load();
  const header = ["date", "uniqueNumber", "kind", "type", "chrono", "comment", "rev", "code"];
  const lines = [header.join(";")];
  data.history.forEach(h => {
    lines.push(header.map(k => `"${String(h[k] ?? "").replace(/"/g, '""')}"`).join(";"));
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=historique-codification.csv");
  res.send(lines.join("\n"));
});

// ---------- Reset ----------
app.post("/api/reset", (req, res) => {
  db.save({ clients: [], chronos: {}, history: [] });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Codification projets — serveur démarré sur le port ${PORT}`);
  console.log(`Accès local     : http://localhost:${PORT}`);
  console.log(`Accès réseau LAN: http://<adresse-IP-de-ce-poste>:${PORT}`);
});
