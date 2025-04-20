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
    const highlightedWordsMatches = [...firstLine.matchAll(/\^\^([^^]+)\^\^/g)];
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
    
    // Now create cards for each highlighted word
    let createdCards = 0;
    
    for (const wordMatch of allMatches) {
      const word = wordMatch.word;
      
      // Find the word entry in the child blocks
      const wordBlockIndex = lines.findIndex(line => 
        (line.includes(`^^${word}^^`) || line.includes(`${word} 🔊`)) && 
        (line.includes('noun') || line.includes('verb') || line.includes('adjective')) &&
        !line.includes('In areas') // Exclude the context line if it contains these
      );
      
      if (wordBlockIndex === -1) continue;
      
      // This is the word block (first level) with pronunciation, part of speech, etc.
      const wordBlock = lines[wordBlockIndex].trim();
      
      // Extract phonetic, part of speech, and translation
      let phonetic = '', partOfSpeech = '', translation = '';
      
      // Extract phonetic - check both formats
      const phoneticMatch = wordBlock.match(/`([^`]+)`/) || wordBlock.match(/\/\s*([^\/]+)\//);
      if (phoneticMatch) phonetic = phoneticMatch[1].trim();
      
      // Extract part of speech
      const posMatches = wordBlock.match(/`([^`]+)`/g) || [];
      if (posMatches.length > 1) {
        partOfSpeech = posMatches[1].replace(/`/g, '').trim();
      } else {
        // Try alternate format
        const posMatch = wordBlock.match(/\/[^\/]+\/\s+(\w+)/);
        if (posMatch) partOfSpeech = posMatch[1].trim();
      }
      
      // Extract translation
      if (posMatches.length > 2) {
        translation = posMatches[2].replace(/`/g, '').trim();
      } else {
        // Try alternate format with Chinese characters
        const translationMatch = wordBlock.match(/noun\s+([^\s#]+)/) || 
                                wordBlock.match(/verb\s+([^\s#]+)/) || 
                                wordBlock.match(/adjective\s+([^\s#]+)/);
        if (translationMatch) translation = translationMatch[1].trim();
      }
      
      // Extract tags
      const tagsMatch = wordBlock.match(/#([a-zA-Z0-9-_]+)/g);
      const tags = tagsMatch ? tagsMatch.map(tag => tag.substring(1)) : [];
      
      // Find definition and examples related to this word
      let definition = '';
      let examples = [];
      
      // Find the definition section for this word (after word block)
      for (let i = wordBlockIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Stop processing if we've reached another word entry
        if (i > wordBlockIndex + 1 && (
            (line.includes('^^') && line.includes('#new-words')) || 
            (line.includes('🔊') && line.includes('#new-words')) ||
            // Match a line with the bullet point format that starts a new word
            (line.match(/^\s*•\s+([a-zA-Z]+)(\s+🔊|\s+\^\^)/))
        )) {
          break;
        }
        
        // Find definition
        if (line.includes('Definition:') || line.includes('**Definition**:')) {
          definition = line
            .replace(/\*\*Definition\*\*:/, '')
            .replace(/Definition:/, '')
            .trim();
          
          // Clean up definition
          definition = definition
            .replace(/\^\^([^^]+)\^\^/g, '$1')
            .replace(/🔊/g, '')
            .trim();
        }
        
        // Find "Examples" heading section
        if (line.includes('Examples') || line.includes('**Examples**')) {
          // Start collecting examples from the next line
          let j = i + 1;
          while (j < lines.length) {
            const exLine = lines[j].trim();
            
            // Stop collecting if we hit another main heading or another word
            if ((exLine.match(/^\s*\*\*[^*]+\*\*/) && !exLine.includes('Example')) ||
                (exLine.match(/^\s*•\s+([a-zA-Z]+)(\s+🔊|\s+\^\^)/)) ||
                (exLine.includes('#new-words'))) {
              break;
            }
            
            // Check for bullet points or numbered examples
            if (exLine.match(/^\s*•/) || exLine.match(/^\s*-/) || exLine.match(/^\s*\d+\./)) {
              let example = exLine
                .replace(/^\s*•/, '')
                .replace(/^\s*-/, '')
                .replace(/^\s*\d+\./, '')
                .replace(/\^\^([^^]+)\^\^/g, '$1')
                .replace(/🔊/g, '')
                .trim();
              
              // Only add if not empty and not a section marker
              if (example && 
                  !example.match(/^\*\*[^*]+\*\*/) && 
                  !example.includes('Synonyms') && 
                  !example.includes('Antonyms') &&
                  !example.includes('Etymology') &&
                  !example.includes('Usage Notes')) {
                examples.push(example);
              }
            }
            
            j++;
          }
          break; // Exit after finding Examples section
        }
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
      
      // Create the back of the card with all information
      const back = `
<div style="text-align: left;">
  <p><b>Word Block:</b> ${wordBlock.replace(/\^\^([^^]+)\^\^/g, '$1').replace(/🔊/g, '')}</p>
  ${phonetic ? `<p><b>Pronunciation:</b> ${phonetic}</p>` : ''}
  ${partOfSpeech ? `<p><b>Part of Speech:</b> ${partOfSpeech}</p>` : ''}
  ${definition ? `<p><b>Definition:</b> ${definition}</p>` : ''}
  ${translation ? `<p><b>Translation:</b> ${translation}</p>` : ''}
  ${examples.length > 0 ? 
    `<p><b>Examples:</b></p>
    <ul>${examples.map(ex => `<li>${ex}</li>`).join('')}</ul>` : ''}
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