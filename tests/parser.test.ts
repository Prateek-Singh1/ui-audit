import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Language,
  ParserFactory,
  detectLanguageFromExtension,
  parseFile,
  parseFiles,
  type Parser,
} from '../src/parser/index.js';
import type { SourceFile } from '../src/scanner/index.js';

describe('parser language detection', () => {
  it('detects language from supported extensions', () => {
    expect(detectLanguageFromExtension('.ts')).toBe(Language.TypeScript);
    expect(detectLanguageFromExtension('tsx')).toBe(Language.TSX);
    expect(detectLanguageFromExtension('.js')).toBe(Language.JavaScript);
    expect(detectLanguageFromExtension('.jsx')).toBe(Language.JSX);
    expect(detectLanguageFromExtension('.mjs')).toBe(Language.JavaScript);
    expect(detectLanguageFromExtension('.cjs')).toBe(Language.JavaScript);
  });

  it('returns Unknown for unsupported extensions', () => {
    expect(detectLanguageFromExtension('.vue')).toBe(Language.Unknown);
    expect(detectLanguageFromExtension('')).toBe(Language.Unknown);
  });
});

describe('ParserFactory', () => {
  it('selects the correct default parser for a source file', () => {
    const factory = ParserFactory.createDefault();
    const parser = factory.getParser(sourceFile('component.tsx', 'export const App = () => null;'));

    expect(parser?.language).toBe(Language.TSX);
    expect(factory.supportedLanguages()).toEqual([
      Language.TypeScript,
      Language.TSX,
      Language.JavaScript,
      Language.JSX,
    ]);
  });

  it('supports custom parser registration', () => {
    const parser: Parser = {
      language: Language.TypeScript,
      async parse(file) {
        return {
          success: true,
          language: Language.TypeScript,
          path: file.path,
          ast: null,
          durationMs: 0,
          syntaxErrors: [],
          errors: [],
          diagnostics: [],
        };
      },
    };
    const factory = new ParserFactory({ parsers: [parser] });

    expect(factory.getParserForLanguage(Language.TypeScript)).toBe(parser);
    expect(factory.getParserForLanguage(Language.JavaScript)).toBeUndefined();
  });
});

describe('parser', () => {
  it('successfully parses TypeScript into a normalized AST document', async () => {
    const file = sourceFile('src/component.ts', 'export const answer: number = 42;\n');

    const result = await parseFile(file);

    expect(result.success).toBe(true);
    expect(result.language).toBe(Language.TypeScript);
    expect(result.path).toBe(file.path);
    expect(result.syntaxErrors).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.ast).toMatchObject({
      path: file.path,
      relativePath: 'src/component.ts',
      language: Language.TypeScript,
      root: {
        kind: 'SourceFile',
      },
    });
    expect(result.ast?.root.children.length).toBeGreaterThan(0);
  });

  it('successfully parses JSX and TSX files', async () => {
    const jsx = await parseFile(sourceFile('src/view.jsx', 'export const View = <div />;\n'));
    const tsx = await parseFile(
      sourceFile('src/view.tsx', 'export const View = (): JSX.Element => <div />;\n'),
    );

    expect(jsx.success).toBe(true);
    expect(jsx.language).toBe(Language.JSX);
    expect(tsx.success).toBe(true);
    expect(tsx.language).toBe(Language.TSX);
  });

  it('returns an unsupported language result for unsupported files', async () => {
    const file = sourceFile('src/component.vue', '<template><div /></template>');

    const result = await parseFile(file);

    expect(result).toMatchObject({
      success: false,
      language: Language.Unknown,
      path: file.path,
      ast: null,
      syntaxErrors: [],
      errors: [
        {
          kind: 'unsupported-language',
          path: file.path,
          language: Language.Unknown,
          message: 'Unsupported source language for file "src/component.vue".',
        },
      ],
      diagnostics: [
        {
          severity: 'error',
          path: file.path,
          message: 'Unsupported source language for file "src/component.vue".',
        },
      ],
    });
  });

  it('returns structured syntax errors', async () => {
    const file = sourceFile('src/broken.ts', 'const value = ;\n');

    const result = await parseFile(file);

    expect(result.success).toBe(false);
    expect(result.ast?.root.kind).toBe('SourceFile');
    expect(result.syntaxErrors).toHaveLength(1);
    expect(result.errors).toEqual(result.syntaxErrors);
    expect(result.syntaxErrors[0]).toMatchObject({
      kind: 'syntax-error',
      path: file.path,
      language: Language.TypeScript,
    });
    expect(result.syntaxErrors[0]?.message).toContain('Expression expected');
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      path: file.path,
    });
  });

  it('returns parser exception errors without throwing', async () => {
    const file = sourceFile('src/app.ts', 'export const app = true;');
    const parser: Parser = {
      language: Language.TypeScript,
      async parse() {
        throw new Error('parser exploded');
      },
    };
    const factory = new ParserFactory({ parsers: [parser] });

    const result = await parseFile(file, { factory });

    expect(result).toMatchObject({
      success: false,
      language: Language.TypeScript,
      path: file.path,
      ast: null,
      syntaxErrors: [],
      errors: [
        {
          kind: 'parser-exception',
          path: file.path,
          language: Language.TypeScript,
          message: 'parser exploded',
        },
      ],
      diagnostics: [
        {
          severity: 'error',
          path: file.path,
          message: 'parser exploded',
        },
      ],
    });
  });

  it('parses multiple files while preserving order', async () => {
    const files = [
      sourceFile('third.jsx', 'export const Third = <span />;'),
      sourceFile('first.ts', 'export const first = 1;'),
      sourceFile('second.css', '.button {}'),
    ];

    const results = await parseFiles(files);

    expect(results.map((result) => result.path)).toEqual(files.map((file) => file.path));
    expect(results.map((result) => result.language)).toEqual([
      Language.JSX,
      Language.TypeScript,
      Language.Unknown,
    ]);
    expect(results.map((result) => result.success)).toEqual([true, true, false]);
  });
});

const sourceFile = (relativePath: string, contents: string): SourceFile => {
  const absolutePath = path.join('/project', relativePath);
  const extension = path.extname(relativePath).replace(/^\./, '').toLowerCase();

  return {
    path: absolutePath,
    relativePath,
    extension,
    language: 'Unknown',
    contents,
    size: Buffer.byteLength(contents),
    lastModified: new Date('2026-01-01T00:00:00.000Z'),
  };
};
