/**
 * Document Parser Service
 * Parses various document formats (PDF, Word, Excel, CSV, Text, Markdown)
 * and extracts structured data for drill creation
 */

// Dynamic imports for server-side only packages
// These packages are only available in Node.js environment (server-side)
let pdfParse: any;
let mammoth: any;
let XLSX: any;

// Lazy load these modules only when needed (server-side)
async function loadPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import("pdf-parse");
      // pdf-parse exports the function directly
      pdfParse = (pdfParseModule as any).default || pdfParseModule;
    } catch (error) {
      throw new Error(
        "pdf-parse package is not available. This function can only run on the server."
      );
    }
  }
  return pdfParse;
}

async function loadMammoth() {
  if (!mammoth) {
    try {
      mammoth = await import("mammoth");
    } catch (error) {
      throw new Error(
        "mammoth package is not available. This function can only run on the server."
      );
    }
  }
  return mammoth;
}

async function loadXLSX() {
  if (!XLSX) {
    try {
      XLSX = await import("xlsx");
    } catch (error) {
      throw new Error(
        "xlsx package is not available. This function can only run on the server."
      );
    }
  }
  return XLSX;
}

export interface ParsedContent {
  type:
    | "vocabulary"
    | "roleplay"
    | "matching"
    | "definition"
    | "grammar"
    | "sentence_writing"
    | "summary"
    | "listening"
    | "sentence"
    | "fill_blank"
    | "unknown";
  confidence: number;
  extractedData: {
    title?: string;
    items: any[];
    metadata?: {
      difficulty?: string;
      context?: string;
    };
  };
}

export interface TargetSentence {
  word?: string;
  wordTranslation?: string;
  text: string;
  translation?: string;
}

export interface MatchingPair {
  left: string;
  right: string;
  leftTranslation?: string;
  rightTranslation?: string;
}

export interface DialogueTurn {
  speaker: "student" | "ai_0" | "ai_1" | "ai_2" | "ai_3";
  text: string;
  translation?: string;
}

export interface RoleplayScene {
  scene_name: string;
  context?: string;
  dialogue: DialogueTurn[];
}

export interface DefinitionItem {
  word: string;
  hint?: string;
}

export interface GrammarItem {
  pattern: string;
  hint?: string;
  example: string;
}

export interface SentenceWritingItem {
  word: string;
  hint?: string;
}

class DocumentParserService {
  /**
   * Parse a document file
   */
  async parseDocument(file: File | Blob): Promise<ParsedContent> {
    const fileName = file instanceof File ? file.name : "document";
    const extension = fileName.split(".").pop()?.toLowerCase() || "";

    try {
      switch (extension) {
        case "pdf":
          return await this.parsePDF(file);
        case "docx":
        case "doc":
          return await this.parseWord(file);
        case "xlsx":
        case "xls":
        case "csv":
          return await this.parseExcel(file);
        case "txt":
          return await this.parseText(file as File);
        case "md":
        case "markdown":
          return await this.parseMarkdown(file as File);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(file: File | Blob): Promise<ParsedContent> {
    const pdfParseModule = await loadPdfParse();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdfParseModule(buffer);
    const text = data.text;

    const fileName = file instanceof File ? file.name : "document.pdf";
    return this.parseTextContent(text, fileName);
  }

  /**
   * Parse Word document
   */
  private async parseWord(file: File | Blob): Promise<ParsedContent> {
    const mammothModule = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await mammothModule.extractRawText({ buffer });
    const text = result.value;

    const fileName = file instanceof File ? file.name : "document.docx";
    return this.parseTextContent(text, fileName);
  }

  /**
   * Parse Excel/CSV file
   */
  private async parseExcel(file: File | Blob): Promise<ParsedContent> {
    const XLSXModule = await loadXLSX();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSXModule.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON
    const jsonData = XLSXModule.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    const fileName = file instanceof File ? file.name : "document.xlsx";
    // Detect structure and parse
    return this.parseExcelData(jsonData, fileName);
  }

  /**
   * Parse plain text file
   */
  private async parseText(file: File): Promise<ParsedContent> {
    const text = await file.text();
    return this.parseTextContent(text, file.name);
  }

  /**
   * Parse Markdown file
   */
  private async parseMarkdown(file: File): Promise<ParsedContent> {
    const text = await file.text();
    return this.parseTextContent(text, file.name);
  }

  /**
   * Parse text content and detect structure
   */
  private parseTextContent(text: string, filename: string): ParsedContent {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Try to detect drill type
    const detectedType = this.detectDrillType(text);

    let items: any[] = [];

    switch (detectedType.type) {
      case "vocabulary":
        items = this.parseVocabulary(text, lines);
        break;
      case "matching":
        items = this.parseMatching(text, lines);
        break;
      case "roleplay":
        items = this.parseRoleplay(text, lines);
        break;
      case "definition":
        items = this.parseDefinition(text, lines);
        break;
      case "grammar":
        items = this.parseGrammar(text, lines);
        break;
      case "sentence_writing":
        items = this.parseSentenceWriting(text, lines);
        break;
      case "summary":
        items = [{ content: text }];
        break;
      default:
        // Try to extract as vocabulary by default
        items = this.parseVocabulary(text, lines);
    }

    // Extract title from filename or first line
    const title = this.extractTitle(text, filename);

    return {
      type: detectedType.type === "unknown" ? "vocabulary" : detectedType.type,
      confidence: detectedType.confidence,
      extractedData: {
        title,
        items,
        metadata: {
          difficulty: this.detectDifficulty(text),
          context: this.extractContext(text),
        },
      },
    };
  }

  /**
   * Parse Excel/CSV data
   */
  private parseExcelData(data: any[][], filename: string): ParsedContent {
    if (data.length === 0) {
      throw new Error("Empty file");
    }

    // First row might be headers
    const firstRow = data[0];
    const hasHeaders = this.looksLikeHeader(firstRow);
    const startRow = hasHeaders ? 1 : 0;

    // Detect structure based on column count and content
    const columnCount = firstRow.length;
    const detectedType = this.detectExcelStructure(data, columnCount);

    let items: any[] = [];

    switch (detectedType.type) {
      case "vocabulary":
        items = this.parseExcelVocabulary(data, startRow, columnCount);
        break;
      case "matching":
        items = this.parseExcelMatching(data, startRow, columnCount);
        break;
      case "roleplay":
        items = this.parseExcelRoleplay(data, startRow);
        break;
      default:
        items = this.parseExcelVocabulary(data, startRow, columnCount);
    }

    return {
      type: detectedType.type,
      confidence: detectedType.confidence,
      extractedData: {
        title: this.extractTitle("", filename),
        items,
      },
    };
  }

  /**
   * Detect drill type from text content (pattern-based, no AI)
   */
  private detectDrillType(text: string): {
    type: ParsedContent["type"];
    confidence: number;
  } {
    const lowerText = text.toLowerCase();

    // Roleplay detection - look for dialogue markers
    const dialogueMarkers = [
      "speaker:",
      "student:",
      "ai:",
      "waiter:",
      "customer:",
      "teacher:",
      "student says",
      "ai says",
    ];
    const hasDialogue = dialogueMarkers.some((marker) =>
      lowerText.includes(marker)
    );
    if (hasDialogue) {
      return { type: "roleplay", confidence: 0.8 };
    }

    // Matching detection - look for two-column patterns
    const twoColumnPattern = /(\w+)\s*[|\t\/-]\s*(\w+)/g;
    const twoColumnMatches = (text.match(twoColumnPattern) || []).length;
    if (twoColumnMatches > 3) {
      return { type: "matching", confidence: 0.7 };
    }

    // Definition detection - look for word-definition patterns
    const definitionPattern = /^(\w+):\s*(.+)$/gm;
    const definitionMatches = (text.match(definitionPattern) || []).length;
    if (definitionMatches > 2) {
      return { type: "definition", confidence: 0.7 };
    }

    // Grammar detection - look for pattern/rule indicators
    const grammarPattern = /(pattern|rule|grammar|structure|example)/i;
    if (grammarPattern.test(text)) {
      return { type: "grammar", confidence: 0.6 };
    }

    // Summary detection - long text without structure
    if (text.length > 1000 && !hasDialogue && twoColumnMatches < 3) {
      return { type: "summary", confidence: 0.6 };
    }

    // Default to vocabulary
    return { type: "vocabulary", confidence: 0.5 };
  }

  /**
   * Detect Excel structure
   */
  private detectExcelStructure(
    data: any[][],
    columnCount: number
  ): { type: ParsedContent["type"]; confidence: number } {
    // 2 columns = likely matching
    if (columnCount === 2) {
      return { type: "matching", confidence: 0.8 };
    }

    // 3-4 columns = likely vocabulary (word, translation, sentence, sentence translation)
    if (columnCount >= 3 && columnCount <= 4) {
      return { type: "vocabulary", confidence: 0.7 };
    }

    // More columns might be roleplay or complex structure
    if (columnCount > 4) {
      return { type: "roleplay", confidence: 0.5 };
    }

    return { type: "vocabulary", confidence: 0.5 };
  }

  /**
   * Parse vocabulary from text
   */
  private parseVocabulary(text: string, lines: string[]): TargetSentence[] {
    const items: TargetSentence[] = [];

    for (const line of lines) {
      // Pattern: word / translation | sentence / sentence translation
      const pipePattern =
        /^(.+?)\s*[|\/]\s*(.+?)(?:\s*[|\/]\s*(.+?)(?:\s*[|\/]\s*(.+?))?)?$/;
      const match = line.match(pipePattern);

      if (match) {
        items.push({
          word: match[1]?.trim(),
          wordTranslation: match[2]?.trim(),
          text: match[3]?.trim() || match[2]?.trim() || "",
          translation: match[4]?.trim() || match[3]?.trim() || "",
        });
      } else if (line.includes(":")) {
        // Pattern: word: translation
        const [word, ...rest] = line.split(":");
        const translation = rest.join(":").trim();
        items.push({
          word: word.trim(),
          wordTranslation: translation,
          text: translation,
          translation: translation,
        });
      } else if (line.length > 0) {
        // Just text, use as sentence
        items.push({
          text: line,
        });
      }
    }

    return items;
  }

  /**
   * Parse matching pairs from text
   */
  private parseMatching(text: string, lines: string[]): MatchingPair[] {
    const items: MatchingPair[] = [];

    for (const line of lines) {
      // Pattern: left | right or left / right or left - right
      const separators = [/\s*[|\/]\s*/, /\s*-\s*/, /\s*:\s*/];

      for (const sep of separators) {
        const parts = line.split(sep);
        if (parts.length >= 2) {
          items.push({
            left: parts[0].trim(),
            right: parts[1].trim(),
            leftTranslation: parts[2]?.trim(),
            rightTranslation: parts[3]?.trim(),
          });
          break;
        }
      }
    }

    return items;
  }

  /**
   * Parse roleplay from text
   */
  private parseRoleplay(text: string, lines: string[]): RoleplayScene[] {
    const scenes: RoleplayScene[] = [];
    let currentScene: RoleplayScene | null = null;
    let currentDialogue: DialogueTurn[] = [];

    for (const line of lines) {
      // Scene marker
      if (line.match(/^(scene|part|section)\s*\d+/i) || line.startsWith("#")) {
        if (currentScene) {
          currentScene.dialogue = currentDialogue;
          scenes.push(currentScene);
        }
        currentScene = {
          scene_name: line.replace(/^#+\s*/, "").trim(),
          dialogue: [],
        };
        currentDialogue = [];
        continue;
      }

      // Dialogue line
      const speakerMatch = line.match(
        /^(student|ai|ai_0|ai_1|ai_2|ai_3|waiter|customer|teacher):\s*(.+)/i
      );
      if (speakerMatch) {
        const speaker = speakerMatch[1].toLowerCase();
        const text = speakerMatch[2].trim();

        let speakerEnum: DialogueTurn["speaker"] = "student";
        if (speaker.startsWith("ai")) {
          if (speaker === "ai" || speaker === "ai_0") speakerEnum = "ai_0";
          else if (speaker === "ai_1") speakerEnum = "ai_1";
          else if (speaker === "ai_2") speakerEnum = "ai_2";
          else if (speaker === "ai_3") speakerEnum = "ai_3";
        }

        currentDialogue.push({
          speaker: speakerEnum,
          text,
        });
      } else if (line.trim().length > 0 && currentScene) {
        // Assume student line if no speaker specified
        currentDialogue.push({
          speaker: "student",
          text: line,
        });
      }
    }

    if (currentScene) {
      currentScene.dialogue = currentDialogue;
      scenes.push(currentScene);
    }

    return scenes.length > 0
      ? scenes
      : [
          {
            scene_name: "Scene 1",
            dialogue:
              currentDialogue.length > 0
                ? currentDialogue
                : [
                    { speaker: "ai_0", text: "" },
                    { speaker: "student", text: "" },
                  ],
          },
        ];
  }

  /**
   * Parse definition items
   */
  private parseDefinition(text: string, lines: string[]): DefinitionItem[] {
    const items: DefinitionItem[] = [];

    for (const line of lines) {
      // Pattern: word: definition or word - definition
      const match = line.match(/^(.+?)[:\-]\s*(.+)$/);
      if (match) {
        items.push({
          word: match[1].trim(),
          hint: match[2].trim(),
        });
      } else if (line.trim().length > 0) {
        items.push({
          word: line.trim(),
        });
      }
    }

    return items;
  }

  /**
   * Parse grammar items
   */
  private parseGrammar(text: string, lines: string[]): GrammarItem[] {
    const items: GrammarItem[] = [];

    for (const line of lines) {
      // Pattern: pattern | example or pattern: example
      const match = line.match(/^(.+?)[:\|]\s*(.+)$/);
      if (match) {
        items.push({
          pattern: match[1].trim(),
          example: match[2].trim(),
        });
      } else if (line.trim().length > 0) {
        items.push({
          pattern: line.trim(),
          example: "",
        });
      }
    }

    return items;
  }

  /**
   * Parse sentence writing items
   */
  private parseSentenceWriting(
    text: string,
    lines: string[]
  ): SentenceWritingItem[] {
    const items: SentenceWritingItem[] = [];

    for (const line of lines) {
      const match = line.match(/^(.+?)[:\-]\s*(.+)$/);
      if (match) {
        items.push({
          word: match[1].trim(),
          hint: match[2].trim(),
        });
      } else if (line.trim().length > 0) {
        items.push({
          word: line.trim(),
        });
      }
    }

    return items;
  }

  /**
   * Parse Excel vocabulary
   */
  private parseExcelVocabulary(
    data: any[][],
    startRow: number,
    columnCount: number
  ): TargetSentence[] {
    const items: TargetSentence[] = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((cell: any) => !cell || String(cell).trim() === ""))
        continue;

      const item: TargetSentence = {
        word: String(row[0] || "").trim(),
        wordTranslation: String(row[1] || "").trim(),
        text: String(row[2] || row[1] || row[0] || "").trim(),
        translation: String(row[3] || row[2] || "").trim(),
      };

      if (item.text) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Parse Excel matching
   */
  private parseExcelMatching(
    data: any[][],
    startRow: number,
    columnCount: number
  ): MatchingPair[] {
    const items: MatchingPair[] = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((cell: any) => !cell || String(cell).trim() === ""))
        continue;

      items.push({
        left: String(row[0] || "").trim(),
        right: String(row[1] || "").trim(),
        leftTranslation: String(row[2] || "").trim() || undefined,
        rightTranslation: String(row[3] || "").trim() || undefined,
      });
    }

    return items;
  }

  /**
   * Parse Excel roleplay
   */
  private parseExcelRoleplay(data: any[][], startRow: number): RoleplayScene[] {
    // Simple roleplay parsing - each row is a dialogue turn
    const dialogue: DialogueTurn[] = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;

      const speaker = String(row[0] || "student").toLowerCase();
      const text = String(row[1] || "").trim();

      let speakerEnum: DialogueTurn["speaker"] = "student";
      if (speaker.startsWith("ai")) {
        if (speaker === "ai" || speaker === "ai_0") speakerEnum = "ai_0";
        else if (speaker === "ai_1") speakerEnum = "ai_1";
        else if (speaker === "ai_2") speakerEnum = "ai_2";
        else if (speaker === "ai_3") speakerEnum = "ai_3";
      }

      if (text) {
        dialogue.push({
          speaker: speakerEnum,
          text,
          translation: String(row[2] || "").trim() || undefined,
        });
      }
    }

    return [
      {
        scene_name: "Scene 1",
        dialogue:
          dialogue.length > 0
            ? dialogue
            : [
                { speaker: "ai_0", text: "" },
                { speaker: "student", text: "" },
              ],
      },
    ];
  }

  /**
   * Extract title from text or filename
   */
  private extractTitle(text: string, filename: string): string {
    // Try to find title in markdown format
    const markdownTitle = text.match(/^#+\s*(.+)$/m);
    if (markdownTitle) {
      return markdownTitle[1].trim();
    }

    // Use first non-empty line if it looks like a title
    const firstLine = text.split("\n").find((l) => l.trim().length > 0);
    if (
      firstLine &&
      firstLine.length < 100 &&
      !firstLine.includes("|") &&
      !firstLine.includes(":")
    ) {
      return firstLine.trim();
    }

    // Use filename without extension
    return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  /**
   * Detect difficulty from text
   */
  private detectDifficulty(text: string): string {
    const lower = text.toLowerCase();
    if (
      lower.includes("beginner") ||
      lower.includes("basic") ||
      lower.includes("easy")
    ) {
      return "beginner";
    }
    if (
      lower.includes("advanced") ||
      lower.includes("expert") ||
      lower.includes("hard")
    ) {
      return "advanced";
    }
    return "intermediate";
  }

  /**
   * Extract context from text
   */
  private extractContext(text: string): string {
    // Look for context markers
    const contextMatch = text.match(
      /(?:context|instruction|note|description):\s*([\s\S]+?)(?:\n\n|\n#|$)/i
    );
    if (contextMatch) {
      return contextMatch[1].trim();
    }
    return "";
  }

  /**
   * Check if first row looks like headers
   */
  private looksLikeHeader(row: any[]): boolean {
    if (!row || row.length === 0) return false;

    const headerKeywords = [
      "word",
      "translation",
      "sentence",
      "left",
      "right",
      "speaker",
      "text",
      "pattern",
      "example",
    ];
    const firstCell = String(row[0] || "").toLowerCase();

    return headerKeywords.some((keyword) => firstCell.includes(keyword));
  }

  /**
   * Parse clipboard text (CSV-like format)
   */
  parseClipboard(text: string): ParsedContent {
    // Split by lines and detect delimiter
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      throw new Error("Empty clipboard data");
    }

    // Detect delimiter (tab, comma, or pipe)
    const firstLine = lines[0];
    let delimiter = "\t";
    if (firstLine.includes(",")) delimiter = ",";
    else if (firstLine.includes("|")) delimiter = "|";
    else if (firstLine.includes("\t")) delimiter = "\t";

    // Parse as CSV-like data
    const data = lines.map((line) =>
      line.split(delimiter).map((cell) => cell.trim())
    );

    // Use Excel parsing logic
    return this.parseExcelData(data, "clipboard");
  }
}

export const documentParserService = new DocumentParserService();
