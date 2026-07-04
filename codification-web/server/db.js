const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

function emptyData() {
  return { clients: [], chronos: {}, history: [] };
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    save(emptyData());
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    parsed.clients = parsed.clients || [];
    parsed.chronos = parsed.chronos || {};
    parsed.history = parsed.history || [];
    return parsed;
  } catch (e) {
    return emptyData();
  }
}

function save(data) {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

// NOTE: every exported function below reads, mutates, and writes the file
// synchronously within a single call, with no `await` in between. Since
// Node runs JS on a single thread, this guarantees no other request can
// interleave mid-mutation — this is what keeps concurrent colleagues from
// ever getting the same chrono/installation number.

module.exports = { load, save, DATA_FILE };
