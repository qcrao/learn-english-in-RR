# Learn English in RR (Roam Research)

Learn English in RR is a powerful Roam Research extension designed to enhance your English learning experience within your Roam graph. This extension provides various features to help you understand, practice, and remember new English words and phrases.

Recommendation: create a new Roam graph for learning English.

## Features

1. **Word Extraction and Explanation**

   - Extract new words or phrases from your Roam blocks, new words should be highlighted with `^^` (e.g., `^^unpretentious^^`)
   - Get detailed explanations including phonetics, definitions, examples, synonyms, antonyms, etymology, and usage notes

2. **Text-to-Speech**

   - Listen to the pronunciation of highlighted words or phrases
   - Customizable voice selections

3. **Mother Language Support**

   - Receive translations and explanations in your native language
   - Supports a wide range of languages (use [language codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes))

4. **AI-Powered Explanations**

   - Utilizes OpenAI's GPT models for comprehensive word explanations
   - Customizable AI model selection

5. **Interactive UI**
   - Speech icons automatically added to highlighted text
   - Context menu integration for quick access to features

## Installation

1. In Roam Research, navigate to Settings > Roam Depot > Community extensions > Browse > Search "Learn English in RR"
2. Click "Install"

## Configuration

After installation, configure the extension in the Roam Research settings panel:

1. **Voice Selection**: Choose your preferred voice for text-to-speech (Nicky, Aaron, or Junior)
2. **Mother Language**: Set your native language code (e.g., zh for Chinese, en for English)
3. **Stream Response**: Toggle streaming responses from GPT models
4. **OpenAI Model**: Select the AI model for explanations (e.g., gpt-4o-mini, gpt-3.5-turbo)
5. **OpenAI API Key**: Enter your OpenAI API key for GPT model access

## Usage

1. **Extracting New Words**

   - Highlight a word or phrase with `^^` (e.g., `^^unpretentious^^`)
   - Better less than 10 words at a time
   - Right-click and select "Extract new words" from the context menu or use the shortcut `Cmd+Shift+E` (you should first set the shortcut in the settings) or use `Cmd+P` and type `extract new words`
   - The extension will generate a detailed explanation below the current block
   - Retry if the explanation is not detailed enough, you can delete the existing explanation and try again

2. **Text-to-Speech**

   - Hover over any highlighted text or the icon to hear the pronunciation

3. **Customizing Explanations**
   - Adjust the mother language in settings for translations in your native language
   - Change the OpenAI model for different levels of explanation detail

## Tips

- Use the extension regularly to build your vocabulary within your Roam graph
- Combine with other Roam features like daily notes and spaced repetition for effective learning
- Experiment with different AI models to find the best balance of speed and detail for your needs

## Support

If you encounter any issues or have suggestions for improvement, please open an issue on the GitHub repository or contact me through email: `qcrao91@gmail.com`.

## Acknowledgments

I have referred to the following projects:

- [Live AI Assistant](https://github.com/fbgallet/roam-extension-speech-to-roam)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
