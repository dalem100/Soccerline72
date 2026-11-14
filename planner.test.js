const assert = require("node:assert/strict");
const P = require("../planner.js");

function player(id, name, positions, goalkeeper = false) {
  return P.sanitizePlayer({ id, name, positions, goalkeeper, present: true, speed: 3, technique: 3 });
}

function roster() {
  return [
    player("1", "Ana", ["GK", "DG"], true), player("2", "Béa", ["GK", "DD"], true),
    player("3", "Chloé", ["GK", "MC"], true), player("4", "Dalia", ["DG", "MG"]),
    player("5", "Emma", ["DD", "MD"]), player("6", "Fatou", ["MG", "MC"]),
    player("7", "Gabrielle", ["MC", "MD"]), player("8", "Hana", ["AP", "MG"]),
    player("9", "Inès", ["AP", "MD"]), player("10", "Jade", ["ALL"])
  ];
}

function assertValidBlock(block, players, strict = true) {
  const ids = [block.goalkeeperId, ...Object.values(block.assignments).filter(Boolean)];
  assert.equal(new Set(ids).size, ids.length, `Doublon au bloc ${block.number}`);
  assert.equal(ids.length, 7, `Bloc ${block.number} incomplet`);
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  for (const [position, id] of Object.entries(block.assignments)) {
    assert.ok(P.isAvailable(byId[id], block.number));
    if (strict) assert.ok(byId[id].positions.includes(position) || byId[id].positions.includes("ALL"), `${byId[id].name} hors position ${position}`);
  }
}

(function testFullPlan() {
  const players = roster();
  const plan = P.generatePlan({ players, periodGoalkeepers: ["1", "2", "3"], strict: true, seed: 42 });
  assert.equal(plan.blocks.length, 6);
  plan.blocks.forEach(b => assertValidBlock(b, players));
  for (let i = 1; i < plan.blocks.length; i += 1) {
    const repeated = plan.blocks[i].bench.filter(id => plan.blocks[i - 1].bench.includes(id));
    assert.deepEqual(repeated, [], `Banc consécutif au bloc ${i + 1}`);
  }
})();

(function testInjuryRecalculation() {
  const players = roster();
  const initial = P.generatePlan({ players, periodGoalkeepers: ["1", "2", "3"], strict: true, seed: 42 });
  const injured = players.map(p => p.id === "2" ? { ...p, unavailableFrom: 3 } : p);
  const updated = P.generatePlan({ players: injured, periodGoalkeepers: ["1", "2", "3"], strict: true, startBlock: 3, preservedBlocks: initial.blocks, seed: 43 });
  assert.deepEqual(updated.blocks.slice(0, 2), initial.blocks.slice(0, 2), "Les blocs joués doivent être conservés");
  updated.blocks.slice(2).forEach(b => assert.equal(P.roleFor(b, "2"), "Indisponible"));
  assert.ok(updated.warnings.some(w => w.includes("gardienne prévue")));
})();

(function testShortHandedPlan() {
  const players = roster().slice(0, 6).map(p => ({ ...p, positions: ["ALL"] }));
  const plan = P.generatePlan({ players, strict: true, seed: 10 });
  plan.blocks.forEach(b => {
    assert.equal(Object.values(b.assignments).filter(Boolean).length, 5);
    assert.equal(new Set([b.goalkeeperId, ...Object.values(b.assignments).filter(Boolean)]).size, 6);
  });
  assert.ok(plan.warnings.some(w => w.includes("poste(s) vacant(s)")));
})();

(function testImpossibleStrictCoverage() {
  const players = Array.from({ length: 7 }, (_, i) => player(String(i), `J${i}`, ["DG"]));
  assert.throws(() => P.generatePlan({ players, strict: true, seed: 1 }), /Impossible de former le bloc 1/);
})();

(function testNormalization() {
  assert.equal(P.normalizePosition("Défense gauche"), "DG");
  assert.deepEqual(P.parsePositions("Gardienne; avant-centre; MD"), ["GK", "AP", "MD"]);
})();

console.log("OK — 5 scénarios de test réussis.");
