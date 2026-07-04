const DOC_TYPES = [
  ["AF", "Analyse fonctionnelle"], ["CCA", "Carnet de câble"], ["CRR", "Compte rendu de réunion"],
  ["DCO", "Dossier de conception"], ["ARCH", "Architecture réseau ou matérielle"], ["DT", "Description/Détails technique"],
  ["ELE", "Schémas électrique"], ["FAT", "Dossier de test FAT"], ["SYN", "Synoptique"],
  ["MDP", "Liste des mots de passe / accès"], ["MEC", "Plan mécanique"], ["MOP", "Manuel opérateur"],
  ["NCA", "Note de calcul"], ["PLA", "Planning"], ["PRO", "Procédure"], ["PID", "Process instrumentation diagram"],
  ["SAT", "Dossier de test SAT"]
];
const PRG_TYPES = [
  ["PRG", "Programme automate ou informatique"], ["HMI", "Programme IHM"], ["SUP", "Programme supervision"],
  ["SNCC", "Système numérique de contrôle-commande"], ["GTC", "Programme de gestion technique centralisée"]
];

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function toCommentSegments(str) {
  return stripAccents(str).split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function buildComment(str, sep) {
  return toCommentSegments(str || "Commentaire").join(sep === "-" ? "-" : "");
}
function padNum(n, len) { return String(n).padStart(len, "0"); }

function uniqueNumberOf(clientCode, installNumber) { return `${clientCode}-${installNumber}`; }
function chronoKey(uniqueNumber, type) { return `${uniqueNumber}|${type}`; }

function nextLetter(l) {
  if (!l) return "A";
  let arr = l.split(""), i = arr.length - 1;
  while (i >= 0) {
    if (arr[i] !== "Z") { arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1); return arr.join(""); }
    arr[i] = "A"; i--;
  }
  return "A" + arr.join("");
}
function todayCode(d) {
  d = d || new Date();
  return `${d.getFullYear()}${padNum(d.getMonth() + 1, 2)}${padNum(d.getDate(), 2)}`;
}

module.exports = {
  DOC_TYPES, PRG_TYPES, stripAccents, buildComment, padNum,
  uniqueNumberOf, chronoKey, nextLetter, todayCode
};
