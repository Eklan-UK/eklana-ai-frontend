# Test Templates for Document Parser

This directory contains sample files for testing the document parsing functionality.

## CSV Files (Excel-compatible)

1. **vocabulary-sample.csv** - Vocabulary drill with word, translation, sentence, and sentence translation
2. **matching-sample.csv** - Matching pairs drill with left/right columns
3. **roleplay-sample.csv** - Roleplay dialogue with speaker, text, and translation
4. **definition-sample.csv** - Definition drill with word and hint columns
5. **grammar-sample.csv** - Grammar patterns with pattern, hint, and example
6. **sentence-writing-sample.csv** - Sentence writing drill with word and hint

## Text Files

1. **vocabulary-text-sample.txt** - Vocabulary in pipe-separated format
2. **roleplay-text-sample.txt** - Roleplay dialogue with speaker markers
3. **matching-text-sample.txt** - Matching pairs in pipe-separated format
4. **definition-text-sample.txt** - Definitions in colon-separated format
5. **grammar-text-sample.txt** - Grammar patterns with examples
6. **summary-sample.txt** - Article text for summary drills

## How to Test

1. **Upload CSV files**: Use the FileUploadZone component to upload any of the CSV files
2. **Upload text files**: Upload the text files to test text parsing
3. **Paste clipboard data**: Copy the contents of any CSV file and paste using the ClipboardPaste component
4. **Download templates**: Use the TemplateDownload button to get Excel templates for each drill type

## Expected Results

- **CSV files**: Should be parsed and detected as the appropriate drill type
- **Text files**: Should be parsed based on content patterns (vocabulary, roleplay, matching, etc.)
- **Clipboard paste**: Should work with tab, comma, or pipe-separated data

## Notes

- All files use Spanish/English examples for language learning context
- Files are formatted to match the expected parser patterns
- You can modify these files to test edge cases or different formats

