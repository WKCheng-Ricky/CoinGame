import { rankText } from "../services/scores.js";
import { MODES } from "../constants/modes.js";
import { PRESETS } from "../constants/options.js";

const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;

// Draws the Session over screen for an endSession result and the rank it earned (null: outside the top 10).
export function mountSummary(els, { onAgain, onLeaderboard, onHome }) {
  els.again.addEventListener("click", () => onAgain());
  els.leaderboard.addEventListener("click", () => onLeaderboard());
  els.home.addEventListener("click", () => onHome());

  return {
    show(result, rank, size) {
      const mode = label(MODES, result.mode);
      els.line.textContent = result.preset === null ? `${mode} (custom settings)` : `${mode}, ${label(PRESETS, result.preset)}`;
      els.score.textContent = String(result.score);
      els.served.textContent = `Customers served: ${result.served}`;
      if (result.preset === null) els.rank.textContent = "Custom settings are not ranked.";
      else if (result.score === 0) els.rank.textContent = "No points scored, so nothing was saved.";
      else els.rank.textContent = rankText(rank, size);
      els.leaderboard.hidden = result.preset === null;
    },
  };
}
