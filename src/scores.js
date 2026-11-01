export const SCORES_KEY = "coin-counting-game-scores";
export const TOP_N = 10;
export const BOARD_MODES = ["endless", "cashier", "give-change"];
export const BOARD_PRESETS = ["normal", "hard", "veryHard"];

export function boardId(mode, preset) {
  return `${mode}:${preset}`;
}

export function rankText(rank, size) {
  if (rank === null) return `Not in the top ${TOP_N}`;
  if (rank === 1) return "New best score!";
  return `Rank ${rank} of ${size}`;
}

function validEntry(e) {
  return !!e && typeof e === "object"
    && Number.isFinite(e.score) && Number.isFinite(e.served)
    && typeof e.at === "string";
}

function readAll(storage) {
  try {
    const raw = storage?.getItem(SCORES_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  } catch { return {}; }
}

function boardOf(all, id) {
  const board = all[id];
  if (!Array.isArray(board)) return [];
  return board.filter(validEntry).map(({ score, served, at }) => ({ score, served, at }));
}

export function createScoreStore(storage) {
  return {
    list(id) {
      return boardOf(readAll(storage), id).sort((a, b) => b.score - a.score).slice(0, TOP_N);
    },
    add(id, entry) {
      const all = readAll(storage);
      const board = boardOf(all, id).sort((a, b) => b.score - a.score);
      const mine = { score: entry.score, served: entry.served, at: entry.at };
      // a tie goes after every earlier equal score
      let index = board.findIndex((e) => e.score < mine.score);
      if (index === -1) index = board.length;
      if (index >= TOP_N) return null;
      board.splice(index, 0, mine);
      all[id] = board.slice(0, TOP_N);
      try { storage?.setItem(SCORES_KEY, JSON.stringify(all)); } catch { /* not remembered */ }
      return index + 1;
    },
    clear() {
      try { storage?.removeItem(SCORES_KEY); } catch { /* ignore */ }
    },
  };
}
