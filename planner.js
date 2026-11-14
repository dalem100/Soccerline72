/* Moteur pur de planification Soccer à 7 — sans dépendance externe. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Soccer7Planner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const POSITIONS = ["DG", "DD", "MG", "MC", "MD", "AP"];
  const POSITION_LABELS = {
    GK: "Gardienne", DG: "Défense gauche", DD: "Défense droite",
    MG: "Milieu gauche", MC: "Milieu centre", MD: "Milieu droit", AP: "Attaquante"
  };
  const POSITION_LINES = { DG: "DEF", DD: "DEF", MG: "MIL", MC: "MIL", MD: "MIL", AP: "ATT", GK: "GK", ALL: "ALL" };

  function normalizeText(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function normalizePosition(value) {
    const text = normalizeText(value);
    const aliases = {
      gardienne: "GK", gardien: "GK", goal: "GK", goaler: "GK", gk: "GK",
      "defense gauche": "DG", "def gauche": "DG", dg: "DG",
      "defense droite": "DD", "def droite": "DD", dd: "DD",
      "demie gauche": "MG", "demi gauche": "MG", "milieu gauche": "MG", mg: "MG",
      "demie centre": "MC", "demi centre": "MC", "milieu centre": "MC", centre: "MC", mc: "MC",
      "demie droite": "MD", "demi droite": "MD", "milieu droite": "MD", md: "MD",
      attaquante: "AP", attaquant: "AP", "avant pointe": "AP", "avant-centre": "AP", "avant centre": "AP",
      pointe: "AP", buteuse: "AP", bu: "AP", ac: "AP", ap: "AP", "attaque gauche": "AP", "avant gauche": "AP",
      ag: "AP", "attaque droite": "AP", "avant droite": "AP", ad: "AP",
      toutes: "ALL", tout: "ALL", all: "ALL", any: "ALL", polyvalente: "ALL"
    };
    const upper = text.toUpperCase();
    if (["GK", ...POSITIONS, "ALL"].includes(upper)) return upper;
    return aliases[text] || null;
  }

  function parsePositions(value) {
    if (Array.isArray(value)) return [...new Set(value.map(normalizePosition).filter(Boolean))];
    if (!String(value ?? "").trim()) return [];
    return [...new Set(String(value).split(/[;,/|]/).map(normalizePosition).filter(Boolean))];
  }

  function parseCsv(value) {
    const text = String(value ?? "").replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/)[0] || "";
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let firstLineQuoted = false;
    for (const char of firstLine) {
      if (char === '"') firstLineQuoted = !firstLineQuoted;
      else if (!firstLineQuoted && char in counts) counts[char] += 1;
    }
    const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some(item => item.trim())) rows.push(row);
        row = []; cell = "";
      } else cell += char;
    }
    row.push(cell);
    if (row.some(item => item.trim())) rows.push(row);
    return rows;
  }

  function csvEscape(value, delimiter = ",") {
    const text = String(value ?? "");
    return (text.includes(delimiter) || /["\r\n]/.test(text)) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function clampRating(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3;
  }

  function sanitizePlayer(raw, index = 0) {
    return {
      id: String(raw.id || `j_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`),
      name: String(raw.name ?? raw.nom ?? "").trim(),
      positions: parsePositions(raw.positions ?? raw.positions_preferees),
      speed: clampRating(raw.speed ?? raw.rapidite),
      technique: clampRating(raw.technique),
      present: raw.present ?? raw.presente ?? true,
      goalkeeper: raw.goalkeeper ?? raw.gardienne ?? false,
      unavailableFrom: Math.max(1, Math.min(7, Number(raw.unavailableFrom ?? 7)))
    };
  }

  function strength(player) {
    return clampRating(player.speed) + clampRating(player.technique);
  }

  function isAvailable(player, blockNumber) {
    return Boolean(player.present) && Number(player.unavailableFrom ?? 7) > blockNumber;
  }

  function canPlay(player, position, strict = true) {
    const prefs = player.positions || [];
    if (prefs.includes("ALL") || prefs.includes(position)) return true;
    return !strict;
  }

  function positionCost(player, position) {
    const prefs = player.positions || [];
    if (prefs.includes("ALL")) return 1;
    const index = prefs.indexOf(position);
    if (index >= 0) return index * 2;
    if (prefs.some(p => POSITION_LINES[p] === POSITION_LINES[position])) return 6;
    return 10;
  }

  function makeRng(seed) {
    let state = (Number(seed) || Date.now()) >>> 0;
    return function () {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function validateRoster(players) {
    const errors = [];
    const names = new Set();
    players.forEach((p, i) => {
      if (!p.name) errors.push(`La joueuse ${i + 1} n’a pas de nom.`);
      const key = normalizeText(p.name);
      if (key && names.has(key)) errors.push(`Le nom « ${p.name} » est en double.`);
      names.add(key);
      if (p.present && (!p.positions || !p.positions.length)) errors.push(`${p.name || `Joueuse ${i + 1}`} n’a aucune position autorisée.`);
      const invalid = (p.positions || []).filter(pos => !["GK", ...POSITIONS, "ALL"].includes(pos));
      if (invalid.length) errors.push(`${p.name}: position(s) invalide(s) ${invalid.join(", ")}.`);
    });
    const present = players.filter(p => p.present);
    if (present.length < 1) errors.push("Aucune joueuse n’est présente.");
    if (present.length > 20) errors.push("La version mobile est limitée à 20 joueuses pour garder une génération rapide.");
    return errors;
  }

  function pickGoalkeepers(players, periodGoalkeepers, startBlock, preservedBlocks, rng) {
    const keepers = {};
    for (let block = 1; block <= 6; block += 1) {
      if (block < startBlock && preservedBlocks[block - 1]) {
        keepers[block] = preservedBlocks[block - 1].goalkeeperId;
        continue;
      }
      const available = players.filter(p => isAvailable(p, block));
      if (!available.length) {
        keepers[block] = null;
        continue;
      }
      const preferredId = periodGoalkeepers?.[Math.ceil(block / 2) - 1] || null;
      const preferred = available.find(p => p.id === preferredId);
      if (preferred) {
        keepers[block] = preferred.id;
        continue;
      }
      const candidates = available.filter(p => p.goalkeeper || p.positions.includes("GK") || p.positions.includes("ALL"));
      const pool = candidates.length ? candidates : available;
      pool.sort((a, b) => {
        const previousA = Object.values(keepers).filter(id => id === a.id).length;
        const previousB = Object.values(keepers).filter(id => id === b.id).length;
        return previousA - previousB || strength(b) - strength(a) || rng() - 0.5;
      });
      keepers[block] = pool[0].id;
    }
    return keepers;
  }

  function allocateTargets(players, startBlock, keepers, preservedBlocks) {
    const counts = Object.fromEntries(players.map(p => [p.id, 0]));
    for (let block = 1; block < startBlock; block += 1) {
      const saved = preservedBlocks[block - 1];
      if (!saved) continue;
      Object.values(saved.assignments || {}).filter(Boolean).forEach(id => { if (id in counts) counts[id] += 1; });
    }
    const capacity = Object.fromEntries(players.map(p => [p.id, 0]));
    let slots = 0;
    for (let block = startBlock; block <= 6; block += 1) {
      const fieldPool = players.filter(p => isAvailable(p, block) && p.id !== keepers[block]);
      const blockSlots = Math.min(6, fieldPool.length);
      slots += blockSlots;
      fieldPool.forEach(p => { capacity[p.id] += 1; });
    }
    const targets = { ...counts };
    for (let slot = 0; slot < slots; slot += 1) {
      const possible = players.filter(p => (targets[p.id] - counts[p.id]) < capacity[p.id]);
      if (!possible.length) break;
      possible.sort((a, b) => {
        const ra = (targets[a.id] + 1) / Math.max(1, counts[a.id] + capacity[a.id]);
        const rb = (targets[b.id] + 1) / Math.max(1, counts[b.id] + capacity[b.id]);
        return ra - rb || targets[a.id] - targets[b.id] || a.name.localeCompare(b.name, "fr");
      });
      targets[possible[0].id] += 1;
    }
    return { counts, targets, capacity, slots };
  }

  function assignBlock({ players, block, goalkeeperId, counts, targets, previousBench, strict, rng }) {
    const available = players.filter(p => isAvailable(p, block));
    const fieldPool = available.filter(p => p.id !== goalkeeperId);
    const slotsWanted = Math.min(6, fieldPool.length);
    const indexed = new Map(fieldPool.map((p, i) => [p.id, i]));
    let dp = new Map([["0|0", { score: 0, assignments: {}, filled: 0, mask: 0n }]]);

    for (const position of POSITIONS) {
      const next = new Map();
      for (const state of dp.values()) {
        const mask = state.mask;
        if (slotsWanted < 6) {
          const skipped = { score: state.score - 100000, assignments: { ...state.assignments, [position]: null }, filled: state.filled };
          const key = `${mask}|${skipped.filled}`;
          const old = next.get(key);
          if (!old || skipped.score > old.score) next.set(key, { ...skipped, mask });
        }
        for (const player of fieldPool) {
          const i = indexed.get(player.id);
          const bit = 1n << BigInt(i);
          if ((mask & bit) !== 0n || !canPlay(player, position, strict)) continue;
          const need = (targets[player.id] || 0) - (counts[player.id] || 0);
          const priorityBench = previousBench.has(player.id) ? 10000 : 0;
          const pref = positionCost(player, position);
          const outOfPosition = player.positions.includes("ALL") || player.positions.includes(position) ? 0 : 450;
          const score = state.score + need * 1000 + priorityBench - pref * 25 - outOfPosition + strength(player) * 2 + rng() * 25;
          const newMask = mask | bit;
          const candidate = {
            score,
            assignments: { ...state.assignments, [position]: player.id },
            filled: state.filled + 1,
            mask: newMask
          };
          const key = `${newMask}|${candidate.filled}`;
          const old = next.get(key);
          if (!old || candidate.score > old.score) next.set(key, candidate);
        }
      }
      dp = new Map([...next.values()].map(v => [`${v.mask}|${v.filled}`, v]));
    }

    const solutions = [...dp.values()].filter(s => s.filled === slotsWanted);
    if (!solutions.length) {
      const missing = POSITIONS.filter(pos => !fieldPool.some(p => canPlay(p, pos, strict)));
      const suffix = missing.length ? ` Poste(s) sans candidate: ${missing.join(", ")}.` : " Les préférences strictes ne permettent pas une combinaison complète.";
      throw new Error(`Impossible de former le bloc ${block}.${suffix}`);
    }
    solutions.sort((a, b) => b.score - a.score);
    const assignments = solutions[0].assignments;
    const fieldIds = new Set(Object.values(assignments).filter(Boolean));
    const bench = available.filter(p => p.id !== goalkeeperId && !fieldIds.has(p.id)).map(p => p.id);
    const repeatBench = bench.filter(id => previousBench.has(id));
    return { assignments, bench, repeatBench, availableIds: available.map(p => p.id) };
  }

  function generatePlan(input) {
    const players = (input.players || []).map(sanitizePlayer);
    const errors = validateRoster(players);
    if (errors.length) throw new Error(errors.join("\n"));
    const strict = input.strict !== false;
    const startBlock = Math.max(1, Math.min(6, Number(input.startBlock) || 1));
    const preservedBlocks = Array.isArray(input.preservedBlocks) ? input.preservedBlocks : [];
    const rng = makeRng(input.seed);
    const keepers = pickGoalkeepers(players, input.periodGoalkeepers || [], startBlock, preservedBlocks, rng);
    const { counts, targets, capacity, slots } = allocateTargets(players, startBlock, keepers, preservedBlocks);
    const blocks = [];
    let previousBench = new Set();

    for (let block = 1; block <= 6; block += 1) {
      if (block < startBlock && preservedBlocks[block - 1]) {
        const saved = JSON.parse(JSON.stringify(preservedBlocks[block - 1]));
        blocks.push(saved);
        previousBench = new Set(saved.bench || []);
        continue;
      }
      const goalkeeperId = keepers[block];
      if (!goalkeeperId) {
        blocks.push({ number: block, period: Math.ceil(block / 2), goalkeeperId: null, assignments: Object.fromEntries(POSITIONS.map(p => [p, null])), bench: [], repeatBench: [], availableIds: [] });
        previousBench = new Set();
        continue;
      }
      const result = assignBlock({ players, block, goalkeeperId, counts, targets, previousBench, strict, rng });
      Object.values(result.assignments).filter(Boolean).forEach(id => { counts[id] += 1; });
      blocks.push({ number: block, period: Math.ceil(block / 2), goalkeeperId, ...result });
      previousBench = new Set(result.bench);
    }

    const warnings = [];
    blocks.forEach(b => {
      const vacancies = Object.values(b.assignments).filter(id => !id).length + (b.goalkeeperId ? 0 : 1);
      if (vacancies) warnings.push(`Bloc ${b.number}: ${vacancies} poste(s) vacant(s), faute de joueuses disponibles.`);
      if (b.repeatBench.length) warnings.push(`Bloc ${b.number}: banc consécutif inévitable pour ${b.repeatBench.length} joueuse(s).`);
      const preferred = input.periodGoalkeepers?.[b.period - 1];
      if (preferred && b.goalkeeperId !== preferred) warnings.push(`Bloc ${b.number}: remplacement automatique de la gardienne prévue, indisponible.`);
    });
    const fairnessGap = players.filter(p => (counts[p.id] || 0) !== (targets[p.id] || 0));
    if (fairnessGap.length) warnings.push(`Équité: ${fairnessGap.length} joueuse(s) s’écartent de la cible théorique en raison des contraintes de postes ou de disponibilité.`);
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      startBlock,
      strict,
      blocks,
      fieldCounts: counts,
      fieldTargets: targets,
      futureCapacity: capacity,
      futureSlots: slots,
      warnings: [...new Set(warnings)]
    };
  }

  function roleFor(planBlock, playerId) {
    if (!planBlock || !playerId) return "";
    if (planBlock.goalkeeperId === playerId) return "GK";
    for (const pos of POSITIONS) if (planBlock.assignments?.[pos] === playerId) return pos;
    if ((planBlock.bench || []).includes(playerId)) return "Banc";
    return "Indisponible";
  }

  function changesBetween(before, after, playersById) {
    const ids = new Set([...(before?.availableIds || []), ...(after?.availableIds || [])]);
    const changes = [];
    for (const id of ids) {
      const from = roleFor(before, id);
      const to = roleFor(after, id);
      if (from !== to) changes.push({ id, name: playersById[id]?.name || id, from, to });
    }
    return changes.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  function planSignature(plan, startBlock = 1) {
    if (!plan?.blocks) return "";
    return plan.blocks
      .filter(block => block.number >= startBlock)
      .map(block => [
        block.number,
        block.goalkeeperId || "-",
        ...POSITIONS.map(position => block.assignments?.[position] || "-")
      ].join(":"))
      .join("|");
  }

  function generateAlternativePlan(input, currentPlan, options = {}) {
    const startBlock = Math.max(1, Math.min(6, Number(input.startBlock) || 1));
    const currentSignature = planSignature(currentPlan, startBlock);
    const maxAttempts = Math.max(1, Number(options.maxAttempts) || 60);
    const seedBase = (Number(options.seedBase) || Date.now()) >>> 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidate = generatePlan({ ...input, seed: (seedBase + attempt * 7919) >>> 0 });
      if (planSignature(candidate, startBlock) !== currentSignature) return candidate;
    }
    return null;
  }

  return {
    POSITIONS, POSITION_LABELS, normalizeText, normalizePosition, parsePositions, parseCsv, csvEscape,
    sanitizePlayer, validateRoster, isAvailable, positionCost, generatePlan,
    generateAlternativePlan, planSignature, roleFor, changesBetween
  };
});
