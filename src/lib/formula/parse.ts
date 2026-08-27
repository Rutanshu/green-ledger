/**
 * Formula parser. GHG_TOOL_ARCHITECTURE.md §10: "Formulas stored as an
 * AST, never a string to eval — parsed once, validated against the
 * position registry, and dimension-checked."
 *
 * Hand-rolled tokenizer + recursive-descent parser. No eval, no
 * `new Function`, no dynamic code execution of any kind.
 *
 * Grammar (highest to lowest precedence):
 *   primary      := NUMBER | STRING | IDENTIFIER | CALL | '(' expr ')'
 *   unary        := '-' unary | primary
 *   multiplicative := unary (('*' | '/') unary)*
 *   additive     := multiplicative (('+' | '-') multiplicative)*
 *   comparison   := additive (('<' | '>' | '<=' | '>=' | '==' | '!=') additive)*
 *   conditional  := comparison ('?' expr ':' expr)?
 *   expr         := conditional
 *
 * PURE MODULE.
 */

export type FormulaNode =
  | { type: 'number'; value: string }
  | { type: 'string'; value: string }
  | { type: 'identifier'; code: string }
  | { type: 'unaryMinus'; operand: FormulaNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '==' | '!='; left: FormulaNode; right: FormulaNode }
  | { type: 'conditional'; test: FormulaNode; whenTrue: FormulaNode; whenFalse: FormulaNode }
  | { type: 'call'; name: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'PRIOR_PERIOD' | 'SITE_ATTRIBUTE'; args: FormulaNode[] };

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(`${message} (at position ${position})`);
    this.name = 'FormulaSyntaxError';
  }
}

const FUNCTION_NAMES = new Set(['SUM', 'AVG', 'MIN', 'MAX', 'PRIOR_PERIOD', 'SITE_ATTRIBUTE']);

interface Token {
  kind: 'number' | 'string' | 'identifier' | 'op' | 'eof';
  text: string;
  pos: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdentChar = (c: string) => /[A-Za-z0-9_.]/.test(c);

  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    const start = i;
    if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      let s = '';
      while (i < source.length && (isDigit(source[i]) || source[i] === '.')) s += source[i++];
      tokens.push({ kind: 'number', text: s, pos: start });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let s = '';
      while (i < source.length && source[i] !== quote) s += source[i++];
      if (source[i] !== quote) throw new FormulaSyntaxError('Unterminated string literal', start);
      i++;
      tokens.push({ kind: 'string', text: s, pos: start });
      continue;
    }
    if (isIdentStart(c)) {
      let s = '';
      while (i < source.length && isIdentChar(source[i])) s += source[i++];
      tokens.push({ kind: 'identifier', text: s, pos: start });
      continue;
    }
    if ('<>=!'.includes(c) && source[i + 1] === '=') {
      tokens.push({ kind: 'op', text: c + '=', pos: start });
      i += 2;
      continue;
    }
    if ('+-*/()?:,<>'.includes(c)) {
      tokens.push({ kind: 'op', text: c, pos: start });
      i++;
      continue;
    }
    throw new FormulaSyntaxError(`Unexpected character "${c}"`, start);
  }
  tokens.push({ kind: 'eof', text: '', pos: i });
  return tokens;
}

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.i];
  }
  private next(): Token {
    return this.tokens[this.i++];
  }
  private expectOp(text: string) {
    const t = this.next();
    if (t.kind !== 'op' || t.text !== text) throw new FormulaSyntaxError(`Expected "${text}"`, t.pos);
  }

  parseExpression(): FormulaNode {
    const node = this.parseConditional();
    if (this.peek().kind !== 'eof') throw new FormulaSyntaxError(`Unexpected token "${this.peek().text}"`, this.peek().pos);
    return node;
  }

  private parseConditional(): FormulaNode {
    const test = this.parseComparison();
    if (this.peek().kind === 'op' && this.peek().text === '?') {
      this.next();
      const whenTrue = this.parseConditional();
      this.expectOp(':');
      const whenFalse = this.parseConditional();
      return { type: 'conditional', test, whenTrue, whenFalse };
    }
    return test;
  }

  private parseComparison(): FormulaNode {
    let left = this.parseAdditive();
    while (this.peek().kind === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(this.peek().text)) {
      const op = this.next().text as '<' | '>' | '<=' | '>=' | '==' | '!=';
      const right = this.parseAdditive();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseAdditive(): FormulaNode {
    let left = this.parseMultiplicative();
    while (this.peek().kind === 'op' && (this.peek().text === '+' || this.peek().text === '-')) {
      const op = this.next().text as '+' | '-';
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): FormulaNode {
    let left = this.parseUnary();
    while (this.peek().kind === 'op' && (this.peek().text === '*' || this.peek().text === '/')) {
      const op = this.next().text as '*' | '/';
      const right = this.parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseUnary(): FormulaNode {
    if (this.peek().kind === 'op' && this.peek().text === '-') {
      this.next();
      return { type: 'unaryMinus', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaNode {
    const t = this.peek();
    if (t.kind === 'number') {
      this.next();
      return { type: 'number', value: t.text };
    }
    if (t.kind === 'string') {
      this.next();
      return { type: 'string', value: t.text };
    }
    if (t.kind === 'op' && t.text === '(') {
      this.next();
      const inner = this.parseConditional();
      this.expectOp(')');
      return inner;
    }
    if (t.kind === 'identifier') {
      this.next();
      if (this.peek().kind === 'op' && this.peek().text === '(') {
        if (!FUNCTION_NAMES.has(t.text)) {
          throw new FormulaSyntaxError(`Unknown function "${t.text}" — allowed: ${[...FUNCTION_NAMES].join(', ')}`, t.pos);
        }
        this.next(); // '('
        const args: FormulaNode[] = [];
        if (!(this.peek().kind === 'op' && this.peek().text === ')')) {
          args.push(this.parseConditional());
          while (this.peek().kind === 'op' && this.peek().text === ',') {
            this.next();
            args.push(this.parseConditional());
          }
        }
        this.expectOp(')');
        return { type: 'call', name: t.text as FormulaNode extends { type: 'call'; name: infer N } ? N : never, args };
      }
      return { type: 'identifier', code: t.text };
    }
    throw new FormulaSyntaxError(`Unexpected token "${t.text || '<end of input>'}"`, t.pos);
  }
}

/** Parses a formula string into an AST. Throws FormulaSyntaxError on anything malformed. Never eval, never new Function. */
export function parseFormula(source: string): FormulaNode {
  const tokens = tokenize(source);
  return new Parser(tokens).parseExpression();
}
