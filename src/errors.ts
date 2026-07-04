export class BuildError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }

  toJSON() {
    return { ok: false as const, error: { code: this.code, message: this.message } };
  }
}

export function requireField(cond: boolean, code: string, message: string): asserts cond {
  if (!cond) {
    throw new BuildError(code, message);
  }
}
