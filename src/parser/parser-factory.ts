import ts from 'typescript';
import type { SourceFile } from '../scanner/index.js';
import { Language, detectLanguageFromFile } from './language.js';
import { TypeScriptSyntaxParser, type Parser } from './parser.js';

/**
 * Options used to construct a parser factory.
 */
export interface ParserFactoryOptions {
  /** Parser implementations available for automatic selection. */
  readonly parsers?: readonly Parser[];
}

/**
 * Registry and selection mechanism for parser implementations.
 */
export class ParserFactory {
  private readonly parsersByLanguage: ReadonlyMap<Language, Parser>;

  constructor(options: ParserFactoryOptions = {}) {
    this.parsersByLanguage = new Map(
      (options.parsers ?? createDefaultParsers()).map((parser) => [parser.language, parser]),
    );
  }

  /**
   * Creates a parser factory with the built-in JavaScript and TypeScript parsers.
   */
  static createDefault(): ParserFactory {
    return new ParserFactory();
  }

  /**
   * Returns the parser matching the detected language for a source file.
   */
  getParser(file: SourceFile): Parser | undefined {
    return this.getParserForLanguage(detectLanguageFromFile(file));
  }

  /**
   * Returns the parser registered for a language.
   */
  getParserForLanguage(language: Language): Parser | undefined {
    return this.parsersByLanguage.get(language);
  }

  /**
   * Returns the languages currently supported by this factory.
   */
  supportedLanguages(): readonly Language[] {
    return [...this.parsersByLanguage.keys()];
  }
}

const createDefaultParsers = (): readonly Parser[] => {
  return [
    new TypeScriptSyntaxParser(Language.TypeScript, ts.ScriptKind.TS),
    new TypeScriptSyntaxParser(Language.TSX, ts.ScriptKind.TSX),
    new TypeScriptSyntaxParser(Language.JavaScript, ts.ScriptKind.JS),
    new TypeScriptSyntaxParser(Language.JSX, ts.ScriptKind.JSX),
  ];
};
