import ts from 'typescript';
import type { SourceFile } from '../scanner/index.js';
import { Language, detectLanguageFromFile } from './language.js';
import type { ParserDiagnostic, ParserError } from './parser-error.js';
import type {
  AstPosition,
  NormalizedAstDocument,
  NormalizedAstNode,
  ParserResult,
} from './parser-result.js';

interface ParsedTypeScriptSourceFile extends ts.SourceFile {
  readonly parseDiagnostics: readonly ts.DiagnosticWithLocation[];
}

/**
 * Generic parser contract for converting source files into normalized AST documents.
 */
export interface Parser<TAst extends NormalizedAstDocument = NormalizedAstDocument> {
  /** Language handled by this parser implementation. */
  readonly language: Language;
  /** Parses a scanned source file into a normalized AST result. */
  parse(file: SourceFile): Promise<ParserResult<TAst>>;
}

/**
 * Options accepted by parse orchestration helpers.
 */
export interface ParseOptions {
  /** Parser factory used to select parser implementations. */
  readonly factory?: {
    getParser(file: SourceFile): Parser | undefined;
  };
}

/**
 * Default parser implementation backed by the TypeScript compiler parser.
 */
export class TypeScriptSyntaxParser implements Parser {
  readonly language: Language;
  private readonly scriptKind: ts.ScriptKind;
  private readonly scriptTarget: ts.ScriptTarget;

  constructor(language: Language, scriptKind: ts.ScriptKind) {
    this.language = language;
    this.scriptKind = scriptKind;
    this.scriptTarget = ts.ScriptTarget.Latest;
  }

  async parse(file: SourceFile): Promise<ParserResult> {
    const startTime = performance.now();

    try {
      const sourceFile = ts.createSourceFile(
        file.path,
        file.contents,
        this.scriptTarget,
        true,
        this.scriptKind,
      ) as ParsedTypeScriptSourceFile;
      const diagnostics = sourceFile.parseDiagnostics.map((diagnostic: ts.DiagnosticWithLocation) =>
        toParserDiagnostic(file, sourceFile, diagnostic),
      );
      const syntaxErrors = diagnostics.map((diagnostic: ParserDiagnostic) =>
        toSyntaxError(file.path, this.language, diagnostic),
      );
      const ast = normalizeAstDocument(file, this.language, sourceFile);

      return {
        success: syntaxErrors.length === 0,
        language: this.language,
        path: file.path,
        ast,
        durationMs: elapsedSince(startTime),
        syntaxErrors,
        errors: syntaxErrors,
        diagnostics,
      };
    } catch (error) {
      return createParserExceptionResult(file, this.language, startTime, error);
    }
  }
}

/**
 * Parses a single scanned source file with the selected parser.
 */
export const parseFile = async (
  file: SourceFile,
  options: ParseOptions = {},
): Promise<ParserResult> => {
  const language = detectLanguageFromFile(file);
  const factory = options.factory ?? createDefaultFactory();
  const parser = factory.getParser(file);

  if (!parser) {
    return createUnsupportedLanguageResult(file, language);
  }

  try {
    return await parser.parse(file);
  } catch (error) {
    return createParserExceptionResult(file, language, performance.now(), error);
  }
};

/**
 * Parses multiple scanned source files while preserving input order.
 */
export const parseFiles = async (
  files: readonly SourceFile[],
  options: ParseOptions = {},
): Promise<readonly ParserResult[]> => {
  const results: ParserResult[] = [];

  for (const file of files) {
    results.push(await parseFile(file, options));
  }

  return results;
};

const createDefaultFactory = (): { getParser(file: SourceFile): Parser | undefined } => {
  return {
    getParser(file: SourceFile): Parser | undefined {
      const language = detectLanguageFromFile(file);
      return DEFAULT_PARSERS.get(language);
    },
  };
};

const DEFAULT_PARSERS = new Map<Language, Parser>([
  [Language.TypeScript, new TypeScriptSyntaxParser(Language.TypeScript, ts.ScriptKind.TS)],
  [Language.TSX, new TypeScriptSyntaxParser(Language.TSX, ts.ScriptKind.TSX)],
  [Language.JavaScript, new TypeScriptSyntaxParser(Language.JavaScript, ts.ScriptKind.JS)],
  [Language.JSX, new TypeScriptSyntaxParser(Language.JSX, ts.ScriptKind.JSX)],
]);

const normalizeAstDocument = (
  file: SourceFile,
  language: Language,
  sourceFile: ts.SourceFile,
): NormalizedAstDocument => {
  return {
    path: file.path,
    relativePath: file.relativePath,
    language,
    root: normalizeNode(sourceFile, sourceFile),
  };
};

const normalizeNode = (node: ts.Node, sourceFile: ts.SourceFile): NormalizedAstNode => {
  const start = node.getStart(sourceFile, false);
  const end = node.getEnd();

  return {
    kind: ts.SyntaxKind[node.kind] ?? 'Unknown',
    rawKind: node.kind,
    start: toAstPosition(sourceFile, start),
    end: toAstPosition(sourceFile, end),
    children: node.getChildren(sourceFile).map((child) => normalizeNode(child, sourceFile)),
  };
};

const toAstPosition = (sourceFile: ts.SourceFile, offset: number): AstPosition => {
  const position = sourceFile.getLineAndCharacterOfPosition(offset);

  return {
    offset,
    line: position.line + 1,
    column: position.character + 1,
  };
};

const toParserDiagnostic = (
  file: SourceFile,
  sourceFile: ts.SourceFile,
  diagnostic: ts.DiagnosticWithLocation,
): ParserDiagnostic => {
  const location = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);

  return {
    severity: 'error',
    path: file.path,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    code: diagnostic.code,
    start: diagnostic.start,
    length: diagnostic.length,
    line: location.line + 1,
    column: location.character + 1,
  };
};

const toSyntaxError = (
  path: string,
  language: Language,
  diagnostic: ParserDiagnostic,
): ParserError => {
  return {
    kind: 'syntax-error',
    path,
    language,
    message: diagnostic.message,
    code: diagnostic.code,
    start: diagnostic.start,
    length: diagnostic.length,
    line: diagnostic.line,
    column: diagnostic.column,
  };
};

const createUnsupportedLanguageResult = (file: SourceFile, language: Language): ParserResult => {
  const startTime = performance.now();
  const error: ParserError = {
    kind: 'unsupported-language',
    path: file.path,
    language,
    message: `Unsupported source language for file "${file.relativePath}".`,
  };

  return {
    success: false,
    language,
    path: file.path,
    ast: null,
    durationMs: elapsedSince(startTime),
    syntaxErrors: [],
    errors: [error],
    diagnostics: [
      {
        severity: 'error',
        path: file.path,
        message: error.message,
      },
    ],
  };
};

const createParserExceptionResult = (
  file: SourceFile,
  language: Language,
  startTime: number,
  error: unknown,
): ParserResult => {
  const message = error instanceof Error ? error.message : 'Unknown parser exception.';
  const parserError: ParserError = {
    kind: 'parser-exception',
    path: file.path,
    language,
    message,
  };

  return {
    success: false,
    language,
    path: file.path,
    ast: null,
    durationMs: elapsedSince(startTime),
    syntaxErrors: [],
    errors: [parserError],
    diagnostics: [
      {
        severity: 'error',
        path: file.path,
        message: parserError.message,
      },
    ],
  };
};

const elapsedSince = (startTime: number): number => {
  return Math.max(0, performance.now() - startTime);
};
