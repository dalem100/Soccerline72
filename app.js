(() => {
  "use strict";
  const P = window.Soccer7Planner;
  const STORAGE_KEY = "soccer7-mobile-v1";
  const ALL_POSITIONS = ["GK", ...P.POSITIONS, "ALL"];
  const state = loadState();
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function defaultState() {
    return { players: [], periodGoalkeepers: [null, null, null], strict: true, plan: null, proposalNumber: 0 };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.players)) return defaultState();
      return { ...defaultState(), ...saved, players: saved.players.map(P.sanitizePlayer) };
    } catch (_) { return defaultState(); }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return `j_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function playerById(id) {
    return state.players.find(p => p.id === id);
  }

  function nameOf(id) {
    return playerById(id)?.name || "Poste vacant";
  }

  function showStatus(message, error = false) {
    const box = $("#status");
    box.textContent = message;
    box.className = `status show${error ? " error" : ""}`;
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => box.classList.remove("show"), error ? 8000 : 3500);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchTab(id) {
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    $$(".panel").forEach(p => p.classList.toggle("active", p.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAll() {
    renderRoster();
    renderKeeperSelects();
    renderPlan();
    renderSummary();
    saveState();
  }

  function renderRoster() {
    const list = $("#rosterList");
    list.textContent = "";
    const template = $("#playerCardTemplate");
    state.players.forEach(player => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.id = player.id;
      card.classList.toggle("absent", !player.present);
      card.querySelector(".player-card-name").textContent = player.name || "Sans nom";
      const positions = player.positions.map(p => p === "ALL" ? "Toutes" : p).join(" · ") || "Aucune position";
      const flags = [player.present ? "Présente" : "Absente", player.goalkeeper ? "Gardienne" : null].filter(Boolean).join(" · ");
      card.querySelector(".player-card-meta").textContent = `${positions} — ${flags} — Rap. ${player.speed} / Tech. ${player.technique}`;
      card.querySelector(".edit-player").addEventListener("click", () => openPlayerDialog(player.id));
      card.querySelector(".remove-player").addEventListener("click", () => removePlayer(player.id));
      list.appendChild(card);
    });
    if (!state.players.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<h3>Effectif vide</h3><p>Ajoutez les joueuses une à une ou importez un CSV.</p>";
      list.appendChild(empty);
    }
    const count = state.players.filter(p => p.present).length;
    $("#rosterCount").textContent = `${count} présente${count > 1 ? "s" : ""}`;
    $("#strictPositions").checked = state.strict;
  }

  function renderKeeperSelects() {
    const eligible = state.players.filter(p => p.present && (p.goalkeeper || p.positions.includes("GK") || p.positions.includes("ALL")));
    for (let i = 0; i < 3; i += 1) {
      const select = $(`#keeper${i + 1}`);
      const current = state.periodGoalkeepers[i];
      select.textContent = "";
      const auto = new Option("Choix automatique", "");
      select.add(auto);
      eligible.forEach(p => select.add(new Option(p.name, p.id)));
      select.value = eligible.some(p => p.id === current) ? current : "";
    }
  }

  function openPlayerDialog(id = null) {
    const player = id ? playerById(id) : P.sanitizePlayer({ id: uid(), name: "", positions: [], speed: 3, technique: 3, present: true, goalkeeper: false });
    $("#playerDialogTitle").textContent = id ? "Modifier la joueuse" : "Ajouter une joueuse";
    $("#playerId").value = id || "";
    $("#playerName").value = player.name;
    $("#playerSpeed").value = player.speed;
    $("#playerTechnique").value = player.technique;
    $("#playerPresent").checked = player.present;
    $("#playerGoalkeeper").checked = player.goalkeeper;
    const checks = $("#positionChecks");
    checks.textContent = "";
    ALL_POSITIONS.forEach(pos => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = pos;
      input.checked = player.positions.includes(pos);
      input.addEventListener("change", () => {
        if (pos === "ALL" && input.checked) checks.querySelectorAll("input:not([value='ALL'])").forEach(c => { c.checked = false; });
        if (pos !== "ALL" && input.checked) checks.querySelector("input[value='ALL']").checked = false;
      });
      label.append(input, document.createTextNode(pos === "ALL" ? "Toutes" : `${pos} — ${P.POSITION_LABELS[pos]}`));
      checks.appendChild(label);
    });
    $("#playerDialog").showModal();
    setTimeout(() => $("#playerName").focus(), 50);
  }

  function savePlayerFromDialog(event) {
    event.preventDefault();
    const existingId = $("#playerId").value;
    const positions = $$("#positionChecks input:checked").map(i => i.value);
    const player = P.sanitizePlayer({
      id: existingId || uid(),
      name: $("#playerName").value,
      positions,
      speed: $("#playerSpeed").value,
      technique: $("#playerTechnique").value,
      present: $("#playerPresent").checked,
      goalkeeper: $("#playerGoalkeeper").checked,
      unavailableFrom: existingId ? playerById(existingId)?.unavailableFrom : 7
    });
    if (!player.name) return showStatus("Le nom est obligatoire.", true);
    if (player.present && !player.positions.length) return showStatus("Choisissez au moins une position.", true);
    const duplicate = state.players.some(p => p.id !== existingId && P.normalizeText(p.name) === P.normalizeText(player.name));
    if (duplicate) return showStatus("Ce nom existe déjà dans l’effectif.", true);
    const index = state.players.findIndex(p => p.id === existingId);
    if (index >= 0) state.players[index] = player; else state.players.push(player);
    state.plan = null;
    state.proposalNumber = 0;
    $("#playerDialog").close();
    renderAll();
  }

  function removePlayer(id) {
    const player = playerById(id);
    if (!player || !confirm(`Retirer ${player.name} de l’effectif?`)) return;
    state.players = state.players.filter(p => p.id !== id);
    state.periodGoalkeepers = state.periodGoalkeepers.map(g => g === id ? null : g);
    state.plan = null;
    state.proposalNumber = 0;
    renderAll();
  }

  function loadExample() {
    if (state.players.length && !confirm("Remplacer l’effectif actuel par l’exemple?")) return;
    const rows = [
      ["Ana", ["GK", "DG"], 4, 3.5, true], ["Béa", ["GK", "DD"], 3.5, 4, true],
      ["Chloé", ["GK", "MC"], 3, 4, true], ["Dalia", ["DG", "MG"], 4, 3, false],
      ["Emma", ["DD", "MD"], 4, 3.5, false], ["Fatou", ["MG", "MC"], 3.5, 4, false],
      ["Gabrielle", ["MC", "MD"], 3, 4.5, false], ["Hana", ["AP", "MG"], 4.5, 3.5, false],
      ["Inès", ["AP", "MD"], 4, 4, false], ["Jade", ["ALL"], 3.5, 3.5, false]
    ];
    state.players = rows.map((r, i) => P.sanitizePlayer({ id: `ex_${i + 1}`, name: r[0], positions: r[1], speed: r[2], technique: r[3], goalkeeper: r[4], present: true }));
    state.periodGoalkeepers = ["ex_1", "ex_2", "ex_3"];
    state.plan = null;
    state.proposalNumber = 0;
    renderAll();
    showStatus("Effectif d’exemple chargé.");
  }

  function generate(startBlock = 1, preservedBlocks = []) {
    state.strict = $("#strictPositions").checked;
    state.periodGoalkeepers = [1, 2, 3].map(i => $(`#keeper${i}`).value || null);
    try {
      state.plan = P.generatePlan({
        players: state.players,
        periodGoalkeepers: state.periodGoalkeepers,
        strict: state.strict,
        startBlock,
        preservedBlocks,
        seed: Date.now()
      });
      state.proposalNumber = (state.proposalNumber || 0) + 1;
      renderAll();
      switchTab("match");
      showStatus(startBlock > 1 ? `Proposition ${state.proposalNumber} recalculée à partir du bloc ${startBlock}.` : `Proposition ${state.proposalNumber} générée.`);
      return true;
    } catch (error) {
      showStatus(`${error.message}\nConseil : vérifiez la couverture de chaque poste ou désactivez « Positions strictes ».`, true);
      return false;
    }
  }

  function regenerateAlternative() {
    if (!state.plan) return;
    const startBlock = Number($("#regenerateFromBlock").value) || 1;
    const currentPlan = state.plan;
    try {
      const candidate = P.generateAlternativePlan({
        players: state.players,
        periodGoalkeepers: state.periodGoalkeepers,
        strict: state.strict,
        startBlock,
        preservedBlocks: currentPlan.blocks
      }, currentPlan, { maxAttempts: 80, seedBase: Date.now() });
      if (!candidate) {
        showStatus("Aucune autre proposition distincte n’a été trouvée avec ces disponibilités et ces positions. Essayez le mode souple ou modifiez les préférences.", true);
        return;
      }
      state.plan = candidate;
      state.proposalNumber = (state.proposalNumber || 1) + 1;
      renderAll();
      switchTab("match");
      showStatus(`Proposition ${state.proposalNumber} générée; elle diffère à partir du bloc ${startBlock}.`);
    } catch (error) {
      showStatus(`${error.message}\nImpossible de produire une autre proposition avec les contraintes actuelles.`, true);
    }
  }

  function renderPlan() {
    const hasPlan = Boolean(state.plan?.blocks?.length);
    $("#noPlan").hidden = hasPlan;
    $("#planArea").hidden = !hasPlan;
    if (!hasPlan) return;
    $("#proposalNumber").textContent = `Proposition ${state.proposalNumber || 1}`;
    const blocks = $("#blocks");
    const jumps = $("#blockJump");
    blocks.textContent = "";
    jumps.textContent = "";
    state.plan.blocks.forEach(block => {
      const jump = document.createElement("button");
      jump.textContent = `Bloc ${block.number}`;
      jump.addEventListener("click", () => document.querySelector(`#block-${block.number}`).scrollIntoView({ behavior: "smooth" }));
      jumps.appendChild(jump);

      const card = document.createElement("article");
      card.className = "block-card";
      card.id = `block-${block.number}`;
      const head = document.createElement("div");
      head.className = "block-head";
      const title = document.createElement("div");
      title.innerHTML = `<p>Période ${block.period}</p><h3>Bloc ${block.number}</h3>`;
      const available = document.createElement("span");
      available.textContent = `${block.availableIds.length} dispo.`;
      head.append(title, available);
      const field = document.createElement("div");
      field.className = "field";
      [...P.POSITIONS, "GK"].forEach(pos => {
        const id = pos === "GK" ? block.goalkeeperId : block.assignments[pos];
        const box = document.createElement("div");
        box.className = `position pos-${pos}${id ? "" : " vacant"}`;
        const label = document.createElement("strong");
        label.textContent = pos;
        const name = document.createElement("span");
        name.textContent = id ? nameOf(id) : "Poste vacant";
        box.append(label, name);
        field.appendChild(box);
      });
      const bench = document.createElement("div");
      bench.className = "bench";
      const benchNames = block.bench.map(nameOf);
      bench.innerHTML = "<h4>Banc</h4>";
      const benchList = document.createElement("div");
      benchList.className = "bench-list";
      if (!benchNames.length) benchList.textContent = "Aucune remplaçante";
      benchNames.forEach(name => { const chip = document.createElement("span"); chip.textContent = name; benchList.appendChild(chip); });
      bench.appendChild(benchList);
      card.append(head, field, bench);
      blocks.appendChild(card);
    });
    const warningBox = $("#warnings");
    warningBox.textContent = "";
    state.plan.warnings.forEach(text => { const item = document.createElement("div"); item.className = "warning"; item.textContent = text; warningBox.appendChild(item); });
    renderInjuryControls();
    renderRegenerationControls();
  }

  function fillBlockSelect(select, fallback = 1) {
    const current = Number(select.value) || fallback;
    select.textContent = "";
    for (let i = 1; i <= 6; i += 1) select.add(new Option(`Bloc ${i}`, String(i)));
    select.value = String(Math.max(1, Math.min(6, current)));
  }

  function renderRegenerationControls() {
    fillBlockSelect($("#regenerateFromBlock"), 1);
  }

  function renderInjuryControls() {
    const select = $("#injuredPlayer");
    const previous = select.value;
    select.textContent = "";
    state.players.filter(p => p.present && p.unavailableFrom > 1).forEach(p => select.add(new Option(p.name, p.id)));
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
    const blockSelect = $("#injuryBlock");
    fillBlockSelect(blockSelect, 1);
    const list = $("#unavailableList");
    list.textContent = "";
    state.players.filter(p => p.present && p.unavailableFrom <= 6).forEach(p => {
      const chip = document.createElement("span");
      chip.className = "unavailable-chip";
      chip.append(document.createTextNode(`${p.name} — dès B${p.unavailableFrom}`));
      const restore = document.createElement("button");
      restore.textContent = "Réintégrer";
      restore.addEventListener("click", () => restorePlayer(p.id));
      chip.appendChild(restore);
      list.appendChild(chip);
    });
  }

  function applyInjury() {
    if (!state.plan) return;
    const id = $("#injuredPlayer").value;
    const block = Number($("#injuryBlock").value);
    const player = playerById(id);
    if (!player) return showStatus("Sélectionnez une joueuse.", true);
    const old = player.unavailableFrom;
    player.unavailableFrom = Math.min(old, block);
    const oldPlan = state.plan;
    if (!generate(block, oldPlan.blocks)) {
      player.unavailableFrom = old;
      state.plan = oldPlan;
      saveState();
    }
  }

  function restorePlayer(id) {
    const player = playerById(id);
    if (!player || !state.plan) return;
    const startBlock = Number($("#injuryBlock").value) || 1;
    const old = player.unavailableFrom;
    const oldPlan = state.plan;
    player.unavailableFrom = 7;
    if (!generate(startBlock, oldPlan.blocks)) {
      player.unavailableFrom = old;
      state.plan = oldPlan;
      saveState();
    }
  }

  function renderSummary() {
    const hasPlan = Boolean(state.plan?.blocks?.length);
    $("#summaryEmpty").hidden = hasPlan;
    $("#summaryArea").hidden = !hasPlan;
    if (!hasPlan) return;
    const table = $("#summaryTable");
    table.textContent = "";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    ["Joueuse", "Champ", "Cible", "Écart", "B1", "B2", "B3", "B4", "B5", "B6"].forEach(h => { const th = document.createElement("th"); th.textContent = h; hr.appendChild(th); });
    thead.appendChild(hr);
    const tbody = document.createElement("tbody");
    state.players.filter(p => p.present).forEach(player => {
      const tr = document.createElement("tr");
      const values = [
        player.name,
        state.plan.fieldCounts[player.id] || 0,
        state.plan.fieldTargets[player.id] || 0,
        (state.plan.fieldCounts[player.id] || 0) - (state.plan.fieldTargets[player.id] || 0),
        ...state.plan.blocks.map(b => P.roleFor(b, player.id))
      ];
      values.forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);

    const changes = $("#changesList");
    changes.textContent = "";
    const byId = Object.fromEntries(state.players.map(p => [p.id, p]));
    for (let i = 0; i < state.plan.blocks.length - 1; i += 1) {
      const rows = P.changesBetween(state.plan.blocks[i], state.plan.blocks[i + 1], byId);
      const card = document.createElement("article");
      card.className = "change-card";
      const title = document.createElement("h4");
      title.textContent = `Bloc ${i + 1} → Bloc ${i + 2}`;
      const ul = document.createElement("ul");
      if (!rows.length) { const li = document.createElement("li"); li.textContent = "Aucun changement"; ul.appendChild(li); }
      rows.forEach(row => {
        const li = document.createElement("li");
        li.textContent = `${row.name}: ${row.from || "hors feuille"} → ${row.to || "hors feuille"}`;
        ul.appendChild(li);
      });
      card.append(title, ul);
      changes.appendChild(card);
    }
  }

  function parseCsv(text) {
    return P.parseCsv(text);
  }

  function truthy(value, defaultValue = false) {
    const s = P.normalizeText(value);
    if (!s) return defaultValue;
    return ["oui", "o", "yes", "y", "true", "vrai", "1", "x"].includes(s);
  }

  async function importCsv(file) {
    try {
      const text = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Impossible de lire ce fichier sur l’iPhone."));
        reader.readAsText(file);
      });
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("Le CSV ne contient aucune joueuse.");
      const headers = rows[0].map(h => P.normalizeText(String(h).replace(/^\uFEFF/, "")).replace(/\s+/g, "_"));
      const find = (...names) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
      const columns = {
        name: find("nom", "name"), positions: find("positions", "positions_preferees", "position"),
        speed: find("rapidite", "speed"), technique: find("technique"),
        present: find("presente", "present"), goalkeeper: find("gardienne", "goalkeeper", "gk")
      };
      if (columns.name < 0 || columns.positions < 0) throw new Error("Colonnes obligatoires manquantes : Nom et Positions.");
      const players = rows.slice(1).map((r, i) => P.sanitizePlayer({
        id: uid() + i, name: r[columns.name], positions: r[columns.positions],
        speed: columns.speed >= 0 ? r[columns.speed] : 3,
        technique: columns.technique >= 0 ? r[columns.technique] : 3,
        present: columns.present >= 0 ? truthy(r[columns.present], true) : true,
        goalkeeper: columns.goalkeeper >= 0 ? truthy(r[columns.goalkeeper]) : false
      })).filter(p => p.name);
      const errors = P.validateRoster(players);
      if (errors.length) throw new Error(errors.join("\n"));
      if (state.players.length && !confirm("Remplacer l’effectif actuel par le CSV?")) return;
      state.players = players;
      state.periodGoalkeepers = [null, null, null];
      state.plan = null;
      state.proposalNumber = 0;
      renderAll();
      showStatus(`${players.length} joueuse(s) importée(s).`);
    } catch (error) { showStatus(error.message, true); }
  }

  function csvEscape(value) {
    return P.csvEscape(value);
  }

  function downloadFallback(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareOrDownload(filename, content, type) {
    try {
      const file = new File([content], filename, { type, lastModified: Date.now() });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        showStatus(`${filename} prêt dans la feuille de partage de l’iPhone.`);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
    downloadFallback(filename, content, type);
    showStatus(`${filename} a été téléchargé. Ouvrez Téléchargements ou l’app Fichiers.`);
  }

  async function exportCsv() {
    const lines = [["Nom", "Positions", "Rapidite", "Technique", "Presente", "Gardienne"]];
    state.players.forEach(p => lines.push([p.name, p.positions.join(";"), p.speed, p.technique, p.present ? "Oui" : "Non", p.goalkeeper ? "Oui" : "Non"]));
    await shareOrDownload("effectif_soccer7.csv", "\ufeff" + lines.map(r => r.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  async function exportLineupCsv() {
    if (!state.plan) return showStatus("Générez d’abord un alignement.", true);
    const lines = [["Nom", "Champ", "Cible", "Ecart", "Bloc 1", "Bloc 2", "Bloc 3", "Bloc 4", "Bloc 5", "Bloc 6"]];
    state.players.filter(p => p.present).forEach(player => {
      const field = state.plan.fieldCounts[player.id] || 0;
      const target = state.plan.fieldTargets[player.id] || 0;
      lines.push([player.name, field, target, field - target, ...state.plan.blocks.map(block => P.roleFor(block, player.id))]);
    });
    const date = new Date().toISOString().slice(0, 10);
    await shareOrDownload(`alignement_soccer7_${date}.csv`, "\ufeff" + lines.map(r => r.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  async function exportJson() {
    await shareOrDownload(`sauvegarde_soccer7_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
  }

  function bindEvents() {
    $$(".tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $$(".go-roster").forEach(b => b.addEventListener("click", () => switchTab("effectif")));
    $("#addPlayer").addEventListener("click", () => openPlayerDialog());
    $("#playerForm").addEventListener("submit", savePlayerFromDialog);
    $("#closePlayer").addEventListener("click", () => $("#playerDialog").close());
    $("#cancelPlayer").addEventListener("click", () => $("#playerDialog").close());
    $("#loadExample").addEventListener("click", loadExample);
    $("#clearRoster").addEventListener("click", () => {
      if (!state.players.length || confirm("Effacer tout l’effectif et l’alignement?")) { Object.assign(state, defaultState()); renderAll(); }
    });
    $("#strictPositions").addEventListener("change", e => { state.strict = e.target.checked; state.plan = null; state.proposalNumber = 0; renderAll(); });
    [1, 2, 3].forEach(i => $(`#keeper${i}`).addEventListener("change", e => { state.periodGoalkeepers[i - 1] = e.target.value || null; state.plan = null; state.proposalNumber = 0; renderAll(); }));
    $("#generatePlan").addEventListener("click", () => generate());
    $("#regeneratePlan").addEventListener("click", regenerateAlternative);
    $("#applyInjury").addEventListener("click", applyInjury);
    $("#printPlan").addEventListener("click", () => window.print());
    $("#exportCsv").addEventListener("click", exportCsv);
    $("#exportLineupCsv").addEventListener("click", exportLineupCsv);
    $("#exportJson").addEventListener("click", exportJson);
    $("#csvInput").addEventListener("change", e => { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ""; });
    $("#installHelp").addEventListener("click", () => $("#installDialog").showModal());
    $("#closeInstall").addEventListener("click", () => $("#installDialog").close());
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  bindEvents();
  renderAll();
  registerServiceWorker();
})();
