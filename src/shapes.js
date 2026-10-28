// Pure SVG geometry for the coin faces (viewBox 0 0 100 100, y points down).

const f = (n) => n.toFixed(2);

export function polygonPoints(sides, radius) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push(`${f(50 + radius * Math.cos(angle))},${f(50 + radius * Math.sin(angle))}`);
  }
  return pts.join(" ");
}

// Reuleaux polygon (odd number of sides): every side is an arc of radius `width`
// centred on the opposite vertex, so the shape has constant width `width`.
export function reuleauxPath(sides, width, cx = 50, cy = 50) {
  const radius = width / 2 / Math.cos(Math.PI / (2 * sides));
  const vertex = (k) => {
    const angle = (2 * Math.PI * k) / sides - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };
  const [x0, y0] = vertex(0);
  let d = `M${f(x0)},${f(y0)}`;
  for (let k = 1; k <= sides; k++) {
    const [x, y] = vertex(k % sides);
    d += ` A${width},${width} 0 0 1 ${f(x)},${f(y)}`;
  }
  return `${d} Z`;
}

// Angles (degrees clockwise from the top) for each non-space character of a string
// laid along a circle, centred on the top. Spaces take up room but get no entry.
export function arcLetters(text, radius, fontSize) {
  const step = ((fontSize * 0.7) / radius) * (180 / Math.PI);
  const chars = [...text];
  const mid = (chars.length - 1) / 2;
  const out = [];
  chars.forEach((char, i) => {
    if (char !== " ") out.push({ char, angle: (i - mid) * step });
  });
  return out;
}

const KIND_SIDES = { heptagon: 7, dodecagon: 12 };

// Distance from the centre to the outline of a coin of the given width, at an angle
// (degrees clockwise from the top). `shape` is "round", "heptagon" (Reuleaux, 7 sides),
// "dodecagon" (width measured corner to corner), or the number of sides, 7 or 12.
export function shapeRadiusAt(shape, width, angleDeg) {
  const sides = typeof shape === "number" ? shape : (shape === "round" ? 0 : KIND_SIDES[shape]);
  if (sides === undefined || (sides !== 0 && sides !== 7 && sides !== 12)) throw new Error(`Unknown shape: ${shape}`);
  if (sides === 0) return width / 2;
  const turn = ((angleDeg % 360) + 360) % 360;
  if (sides === 12) {
    const apothem = (width / 2) * Math.cos(Math.PI / 12);
    return apothem / Math.cos(((turn % 30) - 15) * (Math.PI / 180));
  }
  // Reuleaux: each side is an arc of radius `width` centred on the vertex opposite it
  const R = width / 2 / Math.cos(Math.PI / 14);
  const step = 360 / 7;
  const k = Math.floor(turn / step);
  const centre = ((k + 4) % 7) * step * (Math.PI / 180); // from the top, clockwise
  const cx = R * Math.sin(centre), cy = -R * Math.cos(centre);
  const t = turn * (Math.PI / 180);
  const ux = Math.sin(t), uy = -Math.cos(t);
  const dot = ux * cx + uy * cy;
  return dot + Math.sqrt(dot * dot - R * R + width * width);
}
