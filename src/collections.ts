/**
 * Collection utilities for sparse array processing.
 *
 * @module
 */

/** Build a position-preserving map for batch-processing non-empty items from a sparse array.
 * Returns the valid items, their original indices, and a `reconstruct()` function
 * that maps processed results back to the original positions (empty slots get the default value). */
export function sparseMap<T, D = T>(
  inputs: T[],
  isEmpty: (item: T) => boolean,
  defaultValue: D,
): {
  items: T[];
  indices: number[];
  reconstruct: (results: D[]) => D[];
} {
  const items: T[] = [];
  const indices: number[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (!isEmpty(inputs[i])) {
      items.push(inputs[i]);
      indices.push(i);
    }
  }
  return {
    items,
    indices,
    reconstruct(results: D[]): D[] {
      const out: D[] = Array(inputs.length).fill(defaultValue);
      for (let i = 0; i < indices.length; i++) {
        out[indices[i]] = results[i];
      }
      return out;
    },
  };
}
