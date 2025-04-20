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
      if ((line.startsWith('•') || line.startsWith('-') || line.match(/^\s*•/) || line.match(/^\s*-/)) &&
          (line.includes('noun') || 
           line.includes('verb') || 
           line.includes('adjective') || 
           line.includes('adverb') ||
           line.includes('adj'))) {
        
        // Extract the word from the line - handle both formats
        // Try to match highlighted words first
        let wordMatch = line.match(/\^\^([^^]+)\^\^/);
        
        // If no match found, try alternate format with speech icon
        if (!wordMatch) {
          wordMatch = line.match(/([a-zA-Z0-9 -]+)\s+🔊/);
        }
        
        // If still no match, try to extract word before part of speech
        if (!wordMatch) {
          wordMatch = line.match(/[•-]\s+([a-zA-Z0-9 -]+)\s+(noun|verb|adjective|adverb|adj)/i);
        }
        
        if (wordMatch) {
          const extractedWord = wordMatch[1].trim();
          
          wordEntries.push({
            word: extractedWord,
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
      // First, try to find multi-word phrases in all bullet point lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Only check lines that start with bullet points
        if (line.startsWith('•') || line.startsWith('-') || line.match(/^\s*•/) || line.match(/^\s*-/)) {
          for (const missingWord of missingWords) {
            // For multi-word phrases, check if any parts of the phrase are in the line
            if (missingWord.includes(' ')) {
              
              // Split the multi-word phrase into individual words
              const phraseWords = missingWord.split(' ');
              
              // Check if all or key parts of the phrase are in the line
              const mainWords = phraseWords.filter(w => w.length > 2);  // Filter out small words like "of", "the", etc.
              let mainWordMatches = 0;
              
              for (const mainWord of mainWords) {
                if (line.toLowerCase().includes(mainWord.toLowerCase())) {
                  mainWordMatches++;
                }
              }
              
              // If we found most of the significant words, consider it a match
              if (mainWords.length > 0 && mainWordMatches / mainWords.length >= 0.5) {
                
                // Extract the word from the line - handle both formats
                let wordMatch = line.match(/\^\^([^^]+)\^\^/) || line.match(/([a-zA-Z0-9 -]+)\s+(noun|verb|adjective|adverb|adj)/i);
                
                if (wordMatch) {
                  const foundWord = wordMatch[1].trim();
                  
                  wordEntries.push({
                    word: missingWord,  // Use the original missing word for the card
                    lineIndex: i,
                    content: {
                      definition: '',
                      examples: [],
                      wordBlock: line
                    }
                  });
                  
                  // Break out of the loop after finding a match
                  break;
                }
              }
            } else {
              // Original single-word handling
              if (line.toLowerCase().includes(missingWord)) {
                
                // For multi-word phrases, we need to be careful with the regex pattern
                // Escape special regex characters and then create a pattern that handles word boundaries correctly
                const escapedWord = missingWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let wordPattern;
                
                if (missingWord.includes(' ')) {
                  // For multi-word phrases, we don't use word boundaries because they would break the match
                  wordPattern = new RegExp(escapedWord, 'i');
                } else {
                  // For single words, we use word boundaries as before
                  wordPattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
                }
                
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
      
      // If still missing some words, create fallback entries for them
      const updatedFoundWords = wordEntries.map(entry => entry.word.toLowerCase());
      const stillMissingWords = missingWords.filter(word => !updatedFoundWords.includes(word));
      
      if (stillMissingWords.length > 0) {
        
        for (const missingWord of stillMissingWords) {
          
          // Create a generic word entry with the word itself
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
    }
    
    // Deduplicate entries - keep only the best entry for each word
    const uniqueWordEntries = [];
    const seenWords = new Set();
    
    // First, sort entries by quality (entries with definitions and examples first)
    const sortedEntries = [...wordEntries].sort((a, b) => {
      // Entries with both definition and examples are best
      const aScore = (a.content.definition ? 2 : 0) + (a.content.examples.length > 0 ? 1 : 0);
      const bScore = (b.content.definition ? 2 : 0) + (b.content.examples.length > 0 ? 1 : 0);
      return bScore - aScore;
    });
    
    // Then keep only the best entry for each word
    for (const entry of sortedEntries) {
      const wordKey = entry.word.toLowerCase();
      if (!seenWords.has(wordKey)) {
        seenWords.add(wordKey);
        uniqueWordEntries.push(entry);
      }
    }
    
    // Set the wordEntries to the deduplicated list
    const finalWordEntries = uniqueWordEntries;
    
    // Second pass: collect information for each word
    for (let i = 0; i < finalWordEntries.length; i++) {
      const entry = finalWordEntries[i];
      const nextEntryIndex = i < finalWordEntries.length - 1 ? finalWordEntries[i + 1].lineIndex : lines.length;
      
      // Skip entries with duplicate line indexes (we only need to process one entry per line index)
      if (i > 0 && entry.lineIndex === finalWordEntries[i-1].lineIndex) {
        continue;
      }
      
      // If entry is a multi-word phrase that matched but might need more specific handling
      const isMultiWordPhrase = entry.word.includes(' ');
      
      // Look for definition and examples for this word
      let inExamplesSection = false;
      let inSynonymsSection = false;
      let inAntonymsSection = false;
      
      // For multi-word phrases, we need to check a few lines after the matching entry
      // to get the definition and examples associated with it
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
        
        // Find definition - check for both formats
        if (line.includes('Definition:') || line.includes('**Definition**:') || line.match(/\*\*Definition\*\*[:\s]+/)) {
          const definitionText = line
            .replace(/\*\*Definition\*\*[:\s]+/, '')
            .replace(/Definition[:\s]+/, '')
            .replace(/\^\^([^^]+)\^\^/g, '$1')
            .replace(/🔊/g, '')
            .trim();
          
          entry.content.definition = definitionText;
          
          // For multi-word phrases, also check the next few lines for additional definition text
          if (isMultiWordPhrase && entry.content.definition) {
            let k = j + 1;
            while (k < lines.length && k < j + 5 && !lines[k].trim().match(/^(\*\*|\-)/) && !lines[k].trim().startsWith('•')) {
              const additionalText = lines[k].trim()
                .replace(/\^\^([^^]+)\^\^/g, '$1')
                .replace(/🔊/g, '')
                .trim();
              
              if (additionalText) {
                entry.content.definition += ' ' + additionalText;
              }
              k++;
            }
          }
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
            
            // Skip lines that aren't actual examples
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
        
        // For multi-word phrases, we need to look for definitions formatted differently
        // or that might be embedded directly after the entry
        if (isMultiWordPhrase && j === entry.lineIndex + 1 && line.includes('A') && 
            (line.toLowerCase().includes(entry.word.toLowerCase()) || 
             entry.word.split(' ').every(word => line.toLowerCase().includes(word.toLowerCase())))) {
          if (!entry.content.definition && !line.includes('Examples') && !line.includes('Synonyms')) {
            entry.content.definition = line
              .replace(/\^\^([^^]+)\^\^/g, '$1')
              .replace(/🔊/g, '')
              .trim();
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
      let wordEntry = finalWordEntries.find(entry => 
        entry.word.toLowerCase() === word.toLowerCase()
      );
      
      // If no exact match found and this is a multi-word phrase, try to find partial matches
      if (!wordEntry && word.includes(' ')) {
        
        // Get the individual words from the phrase
        const phraseWords = word.split(' ').filter(w => w.length > 2);
        
        // Look for entries that contain any of the significant words from the phrase
        for (const entry of finalWordEntries) {
          for (const phraseWord of phraseWords) {
            if (entry.word.toLowerCase().includes(phraseWord.toLowerCase()) ||
                phraseWord.toLowerCase().includes(entry.word.toLowerCase())) {
              
              // Create a copy of the entry with the original phrase as the word
              wordEntry = {
                ...entry,
                word: word,  // Use the original highlighted phrase
                content: {
                  ...entry.content,
                  // Add a note that this is a partial match
                  definition: entry.content.definition || `Related to "${entry.word}"`
                }
              };
              
              break;
            }
          }
          if (wordEntry) break;
        }
      }
      
      // Skip if we didn't find the word entry
      if (!wordEntry) {
        continue;
      }
      
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
        let translationMatch = wordEntry.content.wordBlock.match(/noun\s+([^\s#]+)/) || 
                               wordEntry.content.wordBlock.match(/verb\s+([^\s#]+)/) || 
                               wordEntry.content.wordBlock.match(/adjective\s+([^\s#]+)/) ||
                               wordEntry.content.wordBlock.match(/adverb\s+([^\s#]+)/) ||
                               wordEntry.content.wordBlock.match(/phrase\s+([^\s#]+)/);
        
        // If no match yet, try a more flexible approach for multi-word phrases
        if (!translationMatch && word.includes(' ')) {
          // Look for Chinese characters after the part of speech tag
          translationMatch = wordEntry.content.wordBlock.match(/(?:noun|verb|adjective|adverb|phrase)\s+([一-龥]+)/);
        }
        
        if (translationMatch) {
          translation = translationMatch[1].trim();
        } else {
          // Last resort: try to find any Chinese characters in the line
          const chineseChars = wordEntry.content.wordBlock.match(/[一-龥]+/);
          if (chineseChars) {
            translation = chineseChars[0];
          }
        }
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