import {
  getValidLanguageCode,
  initializeOpenAIAPI,
  initializeGrokAPI,
} from "./ai/commands";

export let selectedVoiceName = "Nicky";

export let openaiClient;
export let OPENAI_API_KEY = "";
export let defaultOpenAIModel = "gpt-4o-mini";

export let grokClient;
export let GROK_API_KEY = "";
export let defaultGrokModel = "grok-3-mini-beta";

export let selectedAIProvider = "openai";
export let streamResponse = true;
export let motherLanguage = "zh";
export let ankiDeckName = "English Vocabulary in RR";

// Define the provider mapping
const providerMap = {
  "OpenAI": "openai",
  "xAI": "xAI"
};

export function loadInitialSettings(extensionAPI) {
  // OpenAI settings
  OPENAI_API_KEY = extensionAPI.settings.get("openai-api-key");
  openaiClient = initializeOpenAIAPI(OPENAI_API_KEY);

  // Grok settings
  GROK_API_KEY = extensionAPI.settings.get("grok-api-key");
  grokClient = initializeGrokAPI(GROK_API_KEY);

  // General settings
  selectedAIProvider = extensionAPI.settings.get("ai-provider");
  if (!selectedAIProvider) selectedAIProvider = "openai";

  streamResponse = extensionAPI.settings.get("streamResponse");

  motherLanguage = extensionAPI.settings.get("mother-language-input");
  if (!motherLanguage) motherLanguage = "zh";

  const savedAnkiDeck = extensionAPI.settings.get("anki-deck-name");
  if (savedAnkiDeck) ankiDeckName = savedAnkiDeck;
}

export function initPanelConfig(extensionAPI) {
  return {
    tabTitle: "Learn English in RR",
    settings: [
      {
        id: "voice-selection",
        name: "Voice",
        description: "Select the preferred voice",
        action: {
          type: "select",
          items: ["Nicky", "Aaron", "Junior"],
          onChange: (value) => {
            selectedVoiceName = value;
          },
        },
      },
      {
        id: "mother language",
        name: "Mother language",
        className: "mother-language-input",
        description: (
          <>
            <span>
              Your mother language code for better explanation of words
              (optional)
            </span>
            <br></br>
            e.g.: zh, en, es, fr...{" "}
            <a
              href="https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes"
              target="_blank"
            >
              (See ISO 639-1 codes here)
            </a>
          </>
        ),
        action: {
          type: "input",
          onChange: (evt) => {
            motherLanguage = getValidLanguageCode(evt.target.value);
          },
        },
      },
      {
        id: "anki-deck-name",
        name: "Anki Deck Name",
        description: "Name of the Anki deck to add cards to",
        action: {
          type: "input",
          placeholder: "English Vocabulary in RR  ",
          onChange: (evt) => {
            ankiDeckName = evt.target.value || "English Vocabulary in RR";
            extensionAPI.settings.set("anki-deck-name", ankiDeckName);
          },
        },
      },
      {
        id: "streamResponse",
        name: "Stream response",
        description: "Stream responses of AI models (when supported)",
        action: {
          type: "switch",
          onChange: (evt) => {
            streamResponse = !streamResponse;
          },
        },
      },
      {
        id: "ai-provider",
        name: "AI Provider",
        description: "Choose the AI service provider",
        action: {
          type: "select",
          items: ["OpenAI", "xAI"],
          initialValueFn: () => {
            // Convert internal ID to display name
            if (selectedAIProvider === "xAI") return "xAI";
            return "OpenAI";
          },
          onChange: (value) => {
            // Map display names to internal identifiers
            selectedAIProvider = providerMap[value] || "openai";
            extensionAPI.settings.set("ai-provider", selectedAIProvider);
          },
        },
      },
      {
        id: "openai-api-key",
        name: "OpenAI API Key",
        description: (
          <>
            <span>Enter your OpenAI API key (using gpt-4o-mini model)</span>
            <br></br>
            <a href="https://platform.openai.com/api-keys" target="_blank">
              (Get an API key from OpenAI)
            </a>
          </>
        ),
        action: {
          type: "input",
          onChange: (evt) => {
            setTimeout(() => {
              OPENAI_API_KEY = evt.target.value;
              openaiClient = initializeOpenAIAPI(OPENAI_API_KEY);
            }, 200);
          },
        },
      },
      {
        id: "grok-api-key",
        name: "xAI API Key",
        description: (
          <>
            <span>Enter your xAI API key (using grok-3-mini-beta model)</span>
            <br></br>
            <a
              href="https://console.x.ai/team/e0167c17-198b-4ef2-829f-0e49447d094f/api-keys"
              target="_blank"
            >
              (Get an API key from xAI)
            </a>
          </>
        ),
        action: {
          type: "input",
          onChange: (evt) => {
            setTimeout(() => {
              GROK_API_KEY = evt.target.value;
              grokClient = initializeGrokAPI(GROK_API_KEY);
            }, 200);
          },
        },
      },
    ],
  };
}
