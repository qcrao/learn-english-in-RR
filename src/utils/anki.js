import axios from 'axios';
import { AppToaster } from "../components/toaster";
import { stripBackticks } from './utils';
import { ankiDeckName } from '../config';

/**
 * Creates Anki cards from Roam Research word entries
 * @param {string} blockContent - The content of the Roam Research block
 * @param {string} customDeckName - The name of the Anki deck (optional, uses config if not provided)
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export async function createAnkiCardFromBlock(blockContent, customDeckName) {
  const deckName = customDeckName || ankiDeckName;
  
  try {
    // Check if Anki Connect is available
    await checkAnkiConnection();
    
    // Parse the content and extract word entries
    const { contextSentence, allMatches, wordEntries } = parseBlockContent(blockContent);
    
    if (allMatches.length === 0) {
      AppToaster.show({
        message: "No highlighted words found in the selected block.",
        intent: "warning",
        timeout: 3000,
      });
      return false;
    }
    
    // Create and send cards to Anki
    const createdCards = await createAndSendCards(contextSentence, allMatches, wordEntries, deckName);
    
    // Show results notification
    if (createdCards > 0) {
      AppToaster.show({
        message: `Added ${createdCards} card${createdCards > 1 ? 's' : ''} to Anki deck "${deckName}"`,
        intent: "success",
        timeout: 3000,
      });
      return true;
    } else {
      AppToaster.show({
        message: "No cards were created. Check the format of your word entries.",
        intent: "warning",
        timeout: 3000,
      });
      return false;
    }
  } catch (error) {
    console.error("Error creating Anki card:", error);
    AppToaster.show({
      message: `Failed to create Anki card: ${error.message}`,
      intent: "danger",
      timeout: 5000,
    });
    return false;
  }
}

/**
 * Check if Anki Connect is available
 */
async function checkAnkiConnection() {
  try {
    await axios.post('http://localhost:8765', {
      action: "version",
      version: 6
    });
  } catch (error) {
    throw new Error("Could not connect to Anki. Make sure Anki is running with AnkiConnect plugin installed.");
  }
}

/**
 * Parse block content to extract context sentence and word entries
 */
function parseBlockContent(blockContent) {
  const lines = blockContent.split('\n');
  const firstLine = lines[0].trim();
  
  // Find all highlighted words in the context
  const highlightedWordsMatches = [...firstLine.matchAll(/\^\^([^^]+?)\^\^/g)];
  const speechIconMatches = [...firstLine.matchAll(/([a-zA-Z0-9 -]+)\s+🔊/g)];
  
  // Combine both match types
  const allMatches = [
    ...highlightedWordsMatches.map(match => ({ 
      word: match[1].trim(), 
      type: 'highlight',
      index: match.index
    })),
    ...speechIconMatches.map(match => ({ 
      word: match[1].trim(), 
      type: 'speech',
      index: match.index
    }))
  ].sort((a, b) => a.index - b.index);
  
  // Prepare context sentence with proper highlighting
  const contextSentence = prepareContextSentence(firstLine, [...allMatches]);
  
  // Extract word entries
  const wordEntries = extractWordEntries(lines, allMatches);
  
  return { contextSentence, allMatches, wordEntries };
}

/**
 * Prepare context sentence with proper highlighting for Anki
 */
function prepareContextSentence(firstLine, allMatches) {
  let contextSentence = firstLine;
  // Sort in reverse order to avoid index issues when replacing
  const sortedMatches = allMatches.sort((a, b) => b.index - a.index);
  
  for (const match of sortedMatches) {
    if (match.type === 'highlight') {
      const before = contextSentence.substring(0, match.index);
      const after = contextSentence.substring(match.index + match.word.length + 4); // +4 for the ^^
      contextSentence = before + 
        '<mark style="background-color: #f2c744; color: black;">' + 
        match.word + 
        '</mark>' + 
        after;
    } else if (match.type === 'speech') {
      const before = contextSentence.substring(0, match.index);
      const after = contextSentence.substring(match.index + match.word.length + 2); // +2 for the 🔊 and space
      contextSentence = before + 
        '<mark style="background-color: #f2c744; color: black;">' + 
        match.word + 
        '</mark>' + 
        after;
    }
  }
  
  // Remove markdown tags and speech icons from context
  return contextSentence
    .replace(/\^\^/g, '')
    .replace(/🔊/g, '')
    .replace(/#([a-zA-Z0-9-_]+)/g, '');
}

/**
 * Extract word entries from the content
 */
function extractWordEntries(lines, allMatches) {
  // First, identify all word entries
  const wordEntries = findWordEntryLines(lines);
  
  // Add missing words if needed
  addMissingWordEntries(wordEntries, allMatches, lines);
  
  // Deduplicate entries
  const uniqueEntries = deduplicateEntries(wordEntries);
  
  // Collect information for each word entry
  return collectWordInformation(uniqueEntries, lines);
}

/**
 * Find all word entry lines in content
 */
function findWordEntryLines(lines) {
  const wordEntries = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a word entry line
    if ((line.startsWith('•') || line.startsWith('-') || line.match(/^\s*•/) || line.match(/^\s*-/)) &&
        (line.includes('noun') || 
         line.includes('verb') || 
         line.includes('adjective') || 
         line.includes('adverb') ||
         line.includes('adj'))) {
      
      // Extract the word from the line
      let wordMatch = line.match(/\^\^([^^]+)\^\^/) || 
                      line.match(/([a-zA-Z0-9 -]+)\s+🔊/) ||
                      line.match(/[•-]\s+([a-zA-Z0-9 -]+)\s+(noun|verb|adjective|adverb|adj)/i);
      
      if (wordMatch) {
        wordEntries.push({
          word: wordMatch[1].trim(),
          lineIndex: i,
          content: {
            definition: '',
            examples: [],
            wordBlock: line
          }
        });
      }
    }
  }
  
  return wordEntries;
}

/**
 * Add entries for words that are highlighted but don't have explicit entries
 */
function addMissingWordEntries(wordEntries, allMatches, lines) {
  const highlightedWords = allMatches.map(match => match.word.toLowerCase());
  const foundWords = wordEntries.map(entry => entry.word.toLowerCase());
  const missingWords = highlightedWords.filter(word => !foundWords.includes(word));
  
  if (missingWords.length > 0) {
    // Try to find matching lines for multi-word phrases
    findEntriesForMultiWordPhrases(wordEntries, missingWords, lines);
    
    // Create fallback entries for any still missing words
    createFallbackEntries(wordEntries, missingWords, foundWords);
  }
}

/**
 * Try to find entries for multi-word phrases
 */
function findEntriesForMultiWordPhrases(wordEntries, missingWords, lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Only check lines that start with bullet points
    if (line.startsWith('•') || line.startsWith('-') || line.match(/^\s*•/) || line.match(/^\s*-/)) {
      for (const missingWord of missingWords) {
        if (isLineMatchingWord(line, missingWord)) {
          let wordMatch = line.match(/\^\^([^^]+)\^\^/) || 
                          line.match(/([a-zA-Z0-9 -]+)\s+(noun|verb|adjective|adverb|adj)/i);
          
          if (wordMatch) {
            wordEntries.push({
              word: missingWord,  // Use the original missing word for the card
              lineIndex: i,
              content: {
                definition: '',
                examples: [],
                wordBlock: line
              }
            });
            break;
          }
        }
      }
    }
  }
}

/**
 * Check if a line matches a word (especially for multi-word phrases)
 */
function isLineMatchingWord(line, word) {
  // For multi-word phrases, check if any parts of the phrase are in the line
  if (word.includes(' ')) {
    // Split the multi-word phrase into individual words
    const phraseWords = word.split(' ');
    
    // Check if all or key parts of the phrase are in the line
    const mainWords = phraseWords.filter(w => w.length > 2);  // Filter out small words
    let mainWordMatches = 0;
    
    for (const mainWord of mainWords) {
      if (line.toLowerCase().includes(mainWord.toLowerCase())) {
        mainWordMatches++;
      }
    }
    
    // If we found most of the significant words, consider it a match
    return mainWords.length > 0 && mainWordMatches / mainWords.length >= 0.5;
  } else {
    // For single words, direct match is sufficient
    return line.toLowerCase().includes(word);
  }
}

/**
 * Create fallback entries for words that couldn't be matched
 */
function createFallbackEntries(wordEntries, missingWords, foundWords) {
  const updatedFoundWords = wordEntries.map(entry => entry.word.toLowerCase());
  const stillMissingWords = missingWords.filter(word => !updatedFoundWords.includes(word));
  
  for (const missingWord of stillMissingWords) {
    wordEntries.push({
      word: missingWord,
      lineIndex: -1,  // Indicates it's a fallback entry
      content: {
        definition: `Definition for "${missingWord}" not found in notes.`,
        examples: [],
        wordBlock: `- ${missingWord} (missing entry)`
      }
    });
  }
}

/**
 * Deduplicate entries and keep only the best entry for each word
 */
function deduplicateEntries(wordEntries) {
  const uniqueWordEntries = [];
  const seenWords = new Set();
  
  // Sort entries by quality (entries with definitions and examples first)
  const sortedEntries = [...wordEntries].sort((a, b) => {
    const aScore = (a.content.definition ? 2 : 0) + (a.content.examples.length > 0 ? 1 : 0);
    const bScore = (b.content.definition ? 2 : 0) + (b.content.examples.length > 0 ? 1 : 0);
    return bScore - aScore;
  });
  
  // Keep only the best entry for each word
  for (const entry of sortedEntries) {
    const wordKey = entry.word.toLowerCase();
    if (!seenWords.has(wordKey)) {
      seenWords.add(wordKey);
      uniqueWordEntries.push(entry);
    }
  }
  
  return uniqueWordEntries;
}

/**
 * Collect definition, examples, and other information for each word entry
 */
function collectWordInformation(wordEntries, lines) {
  for (let i = 0; i < wordEntries.length; i++) {
    const entry = wordEntries[i];
    if (entry.lineIndex === -1) continue; // Skip fallback entries
    
    const nextEntryIndex = i < wordEntries.length - 1 ? wordEntries[i + 1].lineIndex : lines.length;
    
    // Skip entries with duplicate line indexes
    if (i > 0 && entry.lineIndex === wordEntries[i-1].lineIndex) {
      continue;
    }
    
    const isMultiWordPhrase = entry.word.includes(' ');
    let inExamplesSection = false;
    let inSynonymsSection = false;
    let inAntonymsSection = false;
    
    // Look through subsequent lines to find definition and examples
    for (let j = entry.lineIndex + 1; j < lines.length && j < nextEntryIndex + 10; j++) {
      const line = lines[j].trim();
      
      // Track section changes
      if (line.includes('Examples') || line.includes('**Examples**')) {
        inExamplesSection = true;
        inSynonymsSection = false;
        inAntonymsSection = false;
        continue;
      } else if (line.includes('Synonyms') || line.includes('**Synonyms**')) {
        inExamplesSection = false;
        inSynonymsSection = true;
        inAntonymsSection = false;
        continue;
      } else if (line.includes('Antonyms') || line.includes('**Antonyms**')) {
        inExamplesSection = false;
        inSynonymsSection = false;
        inAntonymsSection = true;
        continue;
      }
      
      // Find definition
      if (line.includes('Definition:') || line.includes('**Definition**:') || line.match(/\*\*Definition\*\*[:\s]+/)) {
        entry.content.definition = extractTextContent(line, true);
        
        // For multi-word phrases, check next few lines for additional definition text
        if (isMultiWordPhrase && entry.content.definition) {
          addAdditionalDefinitionText(entry, lines, j);
        }
      }
      
      // Collect examples
      if (inExamplesSection && !inSynonymsSection && !inAntonymsSection) {
        if (line.match(/^\s*\d+\./) || line.match(/^\s*•/) || line.match(/^\s*-/)) {
          const example = extractTextContent(line);
          
          // Skip lines that aren't actual examples
          if (isValidExampleLine(example)) {
            entry.content.examples.push(example);
          }
        }
      }
      
      // Special handling for multi-word phrases
      if (isMultiWordPhrase && j === entry.lineIndex + 1 && 
          isDefinitionLineForPhrase(line, entry.word) &&
          !entry.content.definition) {
        entry.content.definition = extractTextContent(line);
      }
    }
  }
  
  return wordEntries;
}

/**
 * Add additional definition text for multi-word phrases
 */
function addAdditionalDefinitionText(entry, lines, startIndex) {
  let k = startIndex + 1;
  while (k < lines.length && k < startIndex + 5 && 
         !lines[k].trim().match(/^(\*\*|\-)/) && 
         !lines[k].trim().startsWith('•')) {
    const additionalText = extractTextContent(lines[k]);
    
    if (additionalText) {
      entry.content.definition += ' ' + additionalText;
    }
    k++;
  }
}

/**
 * Extract clean text content from a line
 */
function extractTextContent(line, isDefinition = false) {
  let text = line;
  
  // Remove definition prefix if needed
  if (isDefinition) {
    text = text
      .replace(/\*\*Definition\*\*[:\s]+/, '')
      .replace(/Definition[:\s]+/, '');
  }
  
  // Remove bullet points or numbering
  text = text
    .replace(/^\s*\d+\./, '')
    .replace(/^\s*•/, '')
    .replace(/^\s*-/, '');
  
  // Remove markdown and other special characters
  return text
    .replace(/\^\^([^^]+)\^\^/g, '$1')
    .replace(/🔊/g, '')
    .trim();
}

/**
 * Check if a line is a valid example (not a section header)
 */
function isValidExampleLine(line) {
  return line && 
    !line.match(/^\*\*[^*]+\*\*/) && 
    !line.includes('Synonyms') && 
    !line.includes('Antonyms') &&
    !line.includes('Etymology') &&
    !line.includes('Usage Notes');
}

/**
 * Check if a line might be a definition line for a multi-word phrase
 */
function isDefinitionLineForPhrase(line, phrase) {
  return line.includes('A') && 
    (line.toLowerCase().includes(phrase.toLowerCase()) || 
     phrase.split(' ').every(word => line.toLowerCase().includes(word.toLowerCase()))) &&
    !line.includes('Examples') && 
    !line.includes('Synonyms');
}

/**
 * Create and send cards to Anki
 */
async function createAndSendCards(contextSentence, allMatches, wordEntries, deckName) {
  let createdCards = 0;
  
  // Process each highlighted word in the context
  for (const wordMatch of allMatches) {
    const word = wordMatch.word;
    
    // Find the corresponding word entry
    let wordEntry = findWordEntry(word, wordEntries);
    
    // Skip if we didn't find the word entry
    if (!wordEntry) continue;
    
    // Create the card content
    const { front, back } = createCardContent(contextSentence, word, wordEntry);
    
    // Send to Anki Connect API
    const success = await sendCardToAnki(front, back, deckName);
    if (success) createdCards++;
  }
  
  return createdCards;
}

/**
 * Find a word entry for a given word, with fallback for multi-word phrases
 */
function findWordEntry(word, wordEntries) {
  // First, try exact match
  let wordEntry = wordEntries.find(entry => 
    entry.word.toLowerCase() === word.toLowerCase()
  );
  
  // If no exact match and this is a multi-word phrase, try partial matches
  if (!wordEntry && word.includes(' ')) {
    wordEntry = findPartialMatch(word, wordEntries);
  }
  
  return wordEntry;
}

/**
 * Find a partial match for a multi-word phrase
 */
function findPartialMatch(phrase, wordEntries) {
  const phraseWords = phrase.split(' ').filter(w => w.length > 2);
  
  for (const entry of wordEntries) {
    for (const phraseWord of phraseWords) {
      if (entry.word.toLowerCase().includes(phraseWord.toLowerCase()) ||
          phraseWord.toLowerCase().includes(entry.word.toLowerCase())) {
        
        // Create a copy of the entry with the original phrase as the word
        return {
          ...entry,
          word: phrase,  // Use the original highlighted phrase
          content: {
            ...entry.content,
            definition: entry.content.definition || `Related to "${entry.word}"`
          }
        };
      }
    }
  }
  
  return null;
}

/**
 * Create the content for an Anki card (front and back)
 */
function createCardContent(contextSentence, word, wordEntry) {
  // Create the front of the card with context
  const front = `
<div style="text-align: left; margin-bottom: 20px;">
  <p>${contextSentence}</p>
</div>
<div style="text-align: center; font-size: 1.2em; font-weight: bold;">
  ${word}
</div>
  `.trim();
  
  // Process word block content
  const processedWordBlock = wordEntry.content.wordBlock
    .replace(/\^\^([^^]+)\^\^/g, '$1')
    .replace(/🔊/g, '')
    .replace(/^[•-]\s+[a-zA-Z0-9 -]+\s+/, '')
    .replace(/#[a-zA-Z0-9-_]+/g, '')
    .replace(/`([^`]+)`/g, '<mark style="background-color: #f2c744; color: black;">$1</mark>');
  
  // Create the back of the card with all information
  const back = `
<div style="text-align: left;">
  <p><b>Word Block:</b> ${processedWordBlock}</p>
  ${wordEntry.content.definition ? 
    `<p><b>Definition:</b> ${wordEntry.content.definition.replace(/^-\s*/, '')}</p>` : ''}
  ${wordEntry.content.examples.length > 0 ? 
    `<p><b>Examples:</b></p>
    <ul>${wordEntry.content.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>` : ''}
</div>
  `.trim();
  
  return { front, back };
}

/**
 * Send a card to Anki via AnkiConnect
 */
async function sendCardToAnki(front, back, deckName) {
  // Add CSS to ensure highlighting works in both light and dark mode
  const css = `
<style>
  /* Make sure highlighted text remains visible in dark mode */
  .night-mode mark, .nightMode mark {
    color: black !important;
  }
</style>
  `;
  
  try {
    const response = await axios.post('http://localhost:8765', {
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: deckName,
          modelName: "Basic",
          fields: {
            Front: front + css,
            Back: back + css
          },
          options: {
            allowDuplicate: true
          },
        }
      }
    });
    
    if (response.data.error) {
      console.error(`Error creating card:`, response.data.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error sending card to Anki:", error);
    return false;
  }
}