/**
 * Simple fuzzy matching algorithm.
 * Checks if all query characters appear in text in order (case-insensitive).
 * Scores prefer: word boundary matches, consecutive matches, shorter strings.
 */
export function fuzzyMatch(
  query: string,
  text: string,
): { match: boolean; score: number } {
  if (query.length === 0) return { match: true, score: 0 };

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveCount = 0;

  for (let ti = 0; ti < textLower.length && qi < queryLower.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      // Word boundary bonus (start of string, after / . - _ or space)
      if (
        ti === 0 ||
        "/.-_ ".includes(textLower[ti - 1])
      ) {
        score += 10;
      }

      // Consecutive match bonus
      if (lastMatchIndex === ti - 1) {
        consecutiveCount++;
        score += 5 * consecutiveCount;
      } else {
        consecutiveCount = 0;
      }

      lastMatchIndex = ti;
      qi++;
      score += 1;
    }
  }

  if (qi < queryLower.length) {
    return { match: false, score: 0 };
  }

  // Prefer shorter strings (less noise)
  score -= text.length * 0.1;

  return { match: true, score };
}

/**
 * Filter and sort items by fuzzy match score.
 * Returns items sorted by score (best first), filtering out non-matches.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (query.length === 0) return items;

  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const result = fuzzyMatch(query, getText(item));
    if (result.match) {
      scored.push({ item, score: result.score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
