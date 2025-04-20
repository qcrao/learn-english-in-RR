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
    // Parse the content from Roam Research format
    const lines = blockContent.split('\n');
    
    // The first line may be the context sentence with multiple highlighted words
    const firstLine = lines[0].trim();
    
    // Find all highlighted words in the context
    const highlightedWordsMatches = [...firstLine.matchAll(/\^\^([^^]+?)\^\^/g)];
    const speechIconMatches = [...firstLine.matchAll(/([a-zA-Z]+)\s+🔊/g)];
    
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
    
    // If no highlighted words found, return with error
    if (allMatches.length === 0) {
      AppToaster.show({
        message: "No highlighted words found in the selected block.",
        intent: "warning",
        timeout: 3000,
      });
      return false;
    }
    
    // Prepare context sentence for the front of the card with proper highlighting
    // Use inline style that works reliably in Anki
    let contextSentence = firstLine;
    const allMatchesCopy = [...allMatches].sort((a, b) => b.index - a.index);
    
    for (const match of allMatchesCopy) {
      if (match.type === 'highlight') {
        // Using both color and background-color for better visibility in both light and dark mode
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
    contextSentence = contextSentence
      .replace(/\^\^/g, '')
      .replace(/🔊/g, '')
      .replace(/#([a-zA-Z0-9-_]+)/g, '');

    // Organize the lines into sections to correctly identify word entries and their content
    let wordsWithContent = [];
    let currentWordEntryIndex = -1;
    let inExamplesSection = false;
    let inSynonymsSection = false;
    let inAntonymsSection = false;
    
    // First pass: identify all word entries and their indexes
    const wordEntries = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a word entry line (either with ^^ or 🔊)
      // First try to match word entries with part of speech
      if ((line.match(/^\s*•\s+([a-zA-Z]+)(\s+🔊|\s+\^\^)/) || 
           line.match(/\^\^([^^]+)\^\^/) || 
           line.match(/([a-zA-Z]+)\s+🔊/)) && 
          (line.includes('noun') || 
           line.includes('verb') || 
           line.includes('adjective') || 
           line.includes('adverb') ||
           line.includes('adj'))) {
        
        // Extract the word from the line
        let wordMatch = line.match(/\^\^([^^]+)\^\^/) || line.match(/([a-zA-Z]+)\s+🔊/);
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
    
    // If we haven't found entries for all highlighted words, try a more flexible approach
    const highlightedWords = allMatches.map(match => match.word.toLowerCase());
    const foundWords = wordEntries.map(entry => entry.word.toLowerCase());
    const missingWords = highlightedWords.filter(word => !foundWords.includes(word));
    
    if (missingWords.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Only check lines that start with bullet points and include missing words
        if (line.startsWith('•') || line.match(/^\s*•/)) {
          for (const missingWord of missingWords) {
            if (line.toLowerCase().includes(missingWord)) {
              // Check if this line might be a word entry for a missing word
              const wordPattern = new RegExp(`\\b${missingWord}\\b`, 'i');
              const match = line.match(wordPattern);
              
              if (match) {
                wordEntries.push({
                  word: missingWord,
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
        }
      }
    }
    
    // Second pass: collect information for each word
    for (let i = 0; i < wordEntries.length; i++) {
      const entry = wordEntries[i];
      const nextEntryIndex = i < wordEntries.length - 1 ? wordEntries[i + 1].lineIndex : lines.length;
      
      // Look for definition and examples for this word
      for (let j = entry.lineIndex + 1; j < nextEntryIndex; j++) {
        const line = lines[j].trim();
        
        // Find definition
        if (line.includes('Definition:') || line.includes('**Definition**:')) {
          entry.content.definition = line
            .replace(/\*\*Definition\*\*:/, '')
            .replace(/Definition:/, '')
            .replace(/\^\^([^^]+)\^\^/g, '$1')
            .replace(/🔊/g, '')
            .trim();
        }
        
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
        
        // Collect examples only in the Examples section
        if (inExamplesSection && !inSynonymsSection && !inAntonymsSection) {
          if (line.match(/^\s*\d+\./) || line.match(/^\s*•/) || line.match(/^\s*-/)) {
            const example = line
              .replace(/^\s*\d+\./, '')
              .replace(/^\s*•/, '')
              .replace(/^\s*-/, '')
              .replace(/\^\^([^^]+)\^\^/g, '$1')
              .replace(/🔊/g, '')
              .trim();
            
            if (example && 
                !example.match(/^\*\*[^*]+\*\*/) && 
                !example.includes('Synonyms') && 
                !example.includes('Antonyms') &&
                !example.includes('Etymology') &&
                !example.includes('Usage Notes')) {
              entry.content.examples.push(example);
            }
          }
        }
      }
    }
    
    // Now create cards for each highlighted word that matches a word entry
    let createdCards = 0;
    
    // Process each highlighted word in the context
    for (const wordMatch of allMatches) {
      const word = wordMatch.word;
      
      // Find the corresponding word entry
      const wordEntry = wordEntries.find(entry => 
        entry.word.toLowerCase() === word.toLowerCase()
      );
      
      // Skip if we didn't find the word entry
      if (!wordEntry) continue;
      
      // Create the front of the card with context
      const front = `
<div style="text-align: left; margin-bottom: 20px;">
  <p>${contextSentence}</p>
</div>
<div style="text-align: center; font-size: 1.2em; font-weight: bold;">
  ${word}
</div>
      `.trim();
      
      // Extract tags
      const tagsMatch = wordEntry.content.wordBlock.match(/#([a-zA-Z0-9-_]+)/g);
      const tags = tagsMatch ? tagsMatch.map(tag => tag.substring(1)) : [];
      
      // Extract phonetic, part of speech, and translation
      let phonetic = '', partOfSpeech = '', translation = '';
      
      // Extract phonetic - check both formats
      const phoneticMatch = wordEntry.content.wordBlock.match(/`([^`]+)`/) || 
                           wordEntry.content.wordBlock.match(/\/\s*([^\/]+)\//);
      if (phoneticMatch) phonetic = phoneticMatch[1].trim();
      
      // Extract part of speech
      const posMatches = wordEntry.content.wordBlock.match(/`([^`]+)`/g) || [];
      if (posMatches.length > 1) {
        partOfSpeech = posMatches[1].replace(/`/g, '').trim();
      } else {
        // Try alternate format
        const posMatch = wordEntry.content.wordBlock.match(/\/[^\/]+\/\s+(\w+)/);
        if (posMatch) partOfSpeech = posMatch[1].trim();
      }
      
      // Extract translation
      if (posMatches.length > 2) {
        translation = posMatches[2].replace(/`/g, '').trim();
      } else {
        // Try alternate format with Chinese characters
        const translationMatch = wordEntry.content.wordBlock.match(/noun\s+([^\s#]+)/) || 
                               wordEntry.content.wordBlock.match(/verb\s+([^\s#]+)/) || 
                               wordEntry.content.wordBlock.match(/adjective\s+([^\s#]+)/);
        if (translationMatch) translation = translationMatch[1].trim();
      }
      
      // Create the back of the card with all information
      const back = `
<div style="text-align: left;">
  <p><b>Word Block:</b> ${wordEntry.content.wordBlock.replace(/\^\^([^^]+)\^\^/g, '$1').replace(/🔊/g, '')}</p>
  ${phonetic ? `<p><b>Pronunciation:</b> ${phonetic}</p>` : ''}
  ${partOfSpeech ? `<p><b>Part of Speech:</b> ${partOfSpeech}</p>` : ''}
  ${wordEntry.content.definition ? `<p><b>Definition:</b> ${wordEntry.content.definition}</p>` : ''}
  ${translation ? `<p><b>Translation:</b> ${translation}</p>` : ''}
  ${wordEntry.content.examples.length > 0 ? 
    `<p><b>Examples:</b></p>
    <ul>${wordEntry.content.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>` : ''}
</div>
      `.trim();
      
      // Add CSS to ensure highlighting works in both light and dark mode
      const css = `
<style>
  /* Make sure highlighted text remains visible in dark mode */
  .night-mode mark, .nightMode mark {
    color: black !important;
  }
</style>
      `;
      
      // Send to Anki Connect API
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
              allowDuplicate: false
            },
            tags: tags
          }
        }
      });
      
      if (response.data.error) {
        console.error(`Error creating card for "${word}":`, response.data.error);
      } else {
        createdCards++;
      }
    }
    
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