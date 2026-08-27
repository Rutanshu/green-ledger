/**
 * The formula (indicator) engine. GHG_TOOL_ARCHITECTURE.md §10 / BUILD_PLAN
 * Step 2.5. Computes a new position/indicator from other positions —
 * "emissions per revenue", "total Scope 1 across all combustion sources" —
 * without ever `eval`-ing a string.
 *
 *   parseFormula(source)          -> AST, never eval/new Function
 *   checkFormulaDimension(ast, …) -> rejects kWh + L at parse time
 *   extractDependencies(ast)      -> which positions this formula reads
 *   checkForCycle(edges)          -> rejects a circular formula at save time
 *   topologicalOrder(edges)       -> evaluation order, dependencies first
 *   evaluateFormula(ast, ctx)     -> a Decimal, or a typed null with a reason
 *
 * All PURE — no Prisma, no fetch, no Date.now(), no Math.random().
 */
export { parseFormula, FormulaSyntaxError, type FormulaNode } from './parse';
export {
  DIMENSIONLESS, dimensionOfBase, addDimension, multiplyDimension, divideDimension,
  isDimensionless, formatDimension, checkFormulaDimension, DimensionMismatchError,
  type Dimension,
} from './dimension';
export { extractDependencies, checkForCycle, topologicalOrder, CycleError } from './graph';
export { evaluateFormula, type EvalContext, type EvalResult, type EvalReason } from './evaluate';
