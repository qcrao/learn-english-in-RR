import axios from 'axios';
import { AppToaster } from "../components/toaster";
import { stripBackticks } from './utils';

/**
 * Creates Anki cards from Roam Research word entries
 * @param {string} blockContent - The content of the Roam Research block
 * @param {string} deckName - The name of the Anki deck
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export async function createAnkiCardFromBlock(blockContent, deckName = "English Vocabulary") {
  try {
    // Parse the content from Roam Research format
    const lines = blockContent.split('\n');
    
    // Extract word, phonetic, part of speech, and translation from the first line
    const firstLine = lines[0];
    const wordMatch = firstLine.match(/\^\^([^^]+)\^\^/);
    const phoneticMatch = firstLine.match(/`([^`]+)`/);
    
    // Get part of speech and translation if available
    const parts = firstLine.split('`').filter(part => part.trim() && !part.includes('^'));
    const partOfSpeech = parts.length > 1 ? parts[1].trim() : '';
    const translation = parts.length > 2 ? parts[2].trim() : '';
    
    // Extract tags
    const tagsMatch = firstLine.match(/#([a-zA-Z0-9-_]+)/g);
    const tags = tagsMatch ? tagsMatch.map(tag => tag.substring(1)) : [];
    
    // Find definition
    const definitionLine = lines.find(line => line.includes('**Definition**:'));
    const definition = definitionLine 
      ? definitionLine.replace('**Definition**:', '').trim() 
      : '';
    
    // Extract examples
    const examplesStartIndex = lines.findIndex(line => line.includes('**Examples**'));
    let examples = [];
    if (examplesStartIndex !== -1) {
      let i = examplesStartIndex + 1;
      while (i < lines.length && lines[i].trim().startsWith('-')) {
        examples.push(lines[i].replace('-', '').trim());
        i++;
      }
    }
    
    // Format content for Anki
    const word = wordMatch ? wordMatch[1] : '';
    const phonetic = phoneticMatch ? phoneticMatch[1] : '';
    
    // Create front and back of the card
    const front = word;
    const back = `
<div style="text-align: left;">
  <p><b>Pronunciation:</b> ${stripBackticks(phonetic)}</p>
  <p><b>Part of Speech:</b> ${partOfSpeech}</p>
  <p><b>Definition:</b> ${definition}</p>
  ${translation ? `<p><b>Translation:</b> ${translation}</p>` : ''}
  ${examples.length > 0 ? 
    `<p><b>Examples:</b></p>
    <ul>${examples.map(ex => `<li>${ex}</li>`).join('')}</ul>` : ''}
</div>
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
            Front: front,
            Back: back
          },
          options: {
            allowDuplicate: false
          },
          tags: tags
        }
      }
    });
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    AppToaster.show({
      message: `Added "${word}" to Anki deck "${deckName}"`,
      intent: "success",
      timeout: 3000,
    });
    
    return true;
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