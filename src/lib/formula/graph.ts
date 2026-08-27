/**
 * Dependency extraction and cycle detection. GHG_TOOL_ARCHITECTURE.md §10:
 * "Dependencies stored as edges. Saving a formula runs cycle detection and
 * rejects a cycle at save time, not discovered mid-calculation... with the
 * cycle path in the error."
 *
 * PURE MODULE.
 */
import type { FormulaNode } from './parse';

/** Every position/indicator code an AST reads — SUM/AVG/MIN/MAX/PRIOR_PERIOD args, plain identifiers. SITE_ATTRIBUTE names aren't positions. */
export function extractDependencies(node: FormulaNode): string[] {
  const out = new Set<string>();
  walk(node, out);
  return [...out];
}

function walk(node: FormulaNode, out: Set<string>): void {
  switch (node.type) {
    case 'identifier':
      out.add(node.code);
      return;
    case 'number':
    case 'string':
      return;
    case 'unaryMinus':
      walk(node.operand, out);
      return;
    case 'binary':
      walk(node.left, out);
      walk(node.right, out);
      return;
    case 'conditional':
      walk(node.test, out);
      walk(node.whenTrue, out);
      walk(node.whenFalse, out);
      return;
    case 'call':
      if (node.name === 'SITE_ATTRIBUTE') return; // reads a site attribute, not a position
      for (const arg of node.args) walk(arg, out);
      return;
  }
}

export class CycleError extends Error {
  constructor(readonly cycle: readonly string[]) {
    super(`Formula dependency cycle: ${cycle.join(' -> ')}`);
    this.name = 'CycleError';
  }
}

/**
 * Given every indicator's own code and the codes it depends on, throws
 * CycleError (with the actual cycle path) if adding this edge set would
 * create one. Call BEFORE persisting a new/edited formula — never rely on
 * discovering a cycle mid-evaluation.
 */
export function checkForCycle(edges: ReadonlyMap<string, readonly string[]>): void {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const state = new Map<string, number>();
  const path: string[] = [];

  function visit(node: string): void {
    const s = state.get(node) ?? WHITE;
    if (s === BLACK) return;
    if (s === GRAY) {
      const cycleStart = path.indexOf(node);
      throw new CycleError([...path.slice(cycleStart), node]);
    }
    state.set(node, GRAY);
    path.push(node);
    for (const dep of edges.get(node) ?? []) {
      visit(dep);
    }
    path.pop();
    state.set(node, BLACK);
  }

  for (const node of edges.keys()) visit(node);
}

/**
 * Topological order for evaluation — dependencies before dependents.
 * Throws CycleError if the graph isn't a DAG (same detection as
 * checkForCycle, but returns the order when it succeeds).
 */
export function topologicalOrder(edges: ReadonlyMap<string, readonly string[]>): string[] {
  checkForCycle(edges);
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(node: string): void {
    if (visited.has(node)) return;
    visited.add(node);
    for (const dep of edges.get(node) ?? []) visit(dep);
    order.push(node);
  }

  for (const node of edges.keys()) visit(node);
  return order;
}
