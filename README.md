# Learn English in RR (Roam Research)

Learn English in RR is a powerful Roam Research extension designed to enhance your English learning experience within your Roam graph. This extension provides various features to help you understand, practice, and remember new English words and phrases.

Recommendation: create a new Roam graph for learning English.

![extract new words](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/extract-new-words.gif?raw=true)

## Features

1. **Word Extraction and Explanation**

   - Extract new words or phrases from your Roam blocks, new words should be highlighted with `^^` (e.g., `^^unpretentious^^`)
   - Get detailed explanations including phonetics, definitions, examples, synonyms, antonyms, etymology, and usage notes
   - **NEW: Incremental Extraction** - Extract only new words from a block that contains previously extracted words

2. **Text-to-Speech**

   - Listen to the pronunciation of highlighted words or phrases
   - Customizable voice selections

3. **Mother Language Support**

   - Receive translations and explanations in your native language
   - Supports a wide range of languages (use [language codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes))

4. **AI-Powered Explanations**

   - Choose between OpenAI and xAI (Grok) for comprehensive word explanations
   - OpenAI uses gpt-4o-mini model
   - xAI uses grok-3-mini-beta model

5. **Anki Integration**

   - **NEW: Send to Anki** - Export your vocabulary directly to Anki for spaced repetition practice
   - Customizable Anki deck name

6. **Interactive UI**
   - Speech icons automatically added to highlighted text
   - Context menu integration for quick access to features

## Installation

1. In Roam Research, navigate to Settings > Roam Depot > Community extensions > Browse > Search "Learn English in RR"
2. Click "Install"

## Configuration

After installation, configure the extension in the Roam Research settings panel:

1. **Voice Selection**: Choose your preferred voice for text-to-speech (Nicky, Aaron, or Junior)
2. **Mother Language**: Set your native language code (e.g., zh for Chinese, en for English)
3. **Anki Deck Name**: Set the name of your Anki deck for vocabulary export
4. **Stream Response**: Toggle streaming responses from AI models
5. **AI Provider**: Choose between OpenAI and xAI (Grok)
6. **OpenAI API Key**: Enter your OpenAI API key (uses gpt-4o-mini model)
7. **xAI API Key**: Enter your xAI API key (uses grok-3-mini-beta model)

## Usage

### 1. **Customizing Explanations**

- Adjust the mother language in settings for translations in your native language
- Choose your preferred AI provider for different explanation styles

### 2. **Active the block**

- Note: cursor should be inside the block when you extract new words, that means the block should be active

![active the block](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/active_the_block.gif?raw=true)

### 3. **Extracting New Words**

- Highlight a word or phrase with `^^` (e.g., `^^unpretentious^^`)
- Better less than 10 words at a time
- Right-click and select "Extract new words" from the context menu or use the hotkey `Cmd+Shift+E` (you should first set the hotkey in the settings) or use `Cmd+P` and type `extract new words`
- The extension will generate a detailed explanation below the current block

#### right click context menu

![right click context menu](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/right-click-extensions.jpg?raw=true)

#### hotkeys

![hotkeys](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/hotkeys.jpg?raw=true)

#### command palette

![command palette](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/cmd+p.jpg?raw=true)

### 4. **Incremental Extraction**

- If a block already contains extracted words and you add new highlighted words
- The extension will only process newly highlighted words, preserving previous explanations

TODO: Add screenshot or GIF of incremental extraction

### 5. **Text-to-Speech**

![new words](https://github.com/qcrao/learn-english-in-RR/blob/main/assets/new_words.jpg?raw=true)

- Hover over any highlighted text or the icon to hear the pronunciation

### 6. **Send to Anki**

- After extracting words, use the "Send to Anki" feature to create flashcards
- Cards will be added to your specified Anki deck
- Make sure Anki is running with AnkiConnect plugin installed

TODO: Add screenshot or GIF of Anki integration

---

**NOTE: Retry if the explanation is not detailed enough, you can delete the existing explanation and try again**

## Tips

- Use the extension regularly to build your vocabulary within your Roam graph
- Combine with other Roam features like daily notes and spaced repetition for effective learning
- Use the Anki integration for additional spaced repetition practice outside of Roam
- Compare explanations from different AI providers to get diverse perspectives

## Support

If you encounter any issues or have suggestions for improvement, please open an issue on the GitHub repository or contact me through email: `qcrao91@gmail.com`.

## Acknowledgments

I have referred to the following projects:

- [Live AI Assistant](https://github.com/fbgallet/roam-extension-speech-to-roam)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
