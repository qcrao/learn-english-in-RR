import { getValidLanguageCode, initializeOpenAIAPI } from "./ai/commands";

export let selectedVoiceName = "Nicky";

export let openaiLibrary;
export let OPENAI_API_KEY = "";
export let defaultOpenAIModel;

export let streamResponse = true;
export let motherLanguage = "zh";
export let ankiDeckName;

export function loadInitialSettings(extensionAPI) {
  OPENAI_API_KEY = extensionAPI.settings.get("openai-api-key");
  openaiLibrary = initializeOpenAIAPI(OPENAI_API_KEY);

  defaultOpenAIModel = extensionAPI.settings.get("openai-model");
  if (!defaultOpenAIModel) defaultOpenAIModel = "GPT-4o-mini";

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
        description: "Stream responses of GPT models",
        action: {
          type: "switch",
          onChange: (evt) => {
            streamResponse = !streamResponse;
          },
        },
      },
      {
        id: "openai-model",
        name: "OpenAI Model",
        description: "Choose the OpenAI model",
        action: {
          type: "select",
          items: [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "o1-preview",
            "o1-mini",
          ],
          onChange: (value) => {
            defaultOpenAIModel = value;
          },
        },
      },
      {
        id: "openai-api-key",
        name: "OpenAI API Key (GPT)",
        description: (
          <>
            <span>Copy here your OpenAI API key for GPT models</span>
            <br></br>
            <a href="https://platform.openai.com/api-keys" target="_blank">
              (Follow this link to generate a new one)
            </a>
          </>
        ),
        action: {
          type: "input",
          onChange: (evt) => {
            setTimeout(() => {
              OPENAI_API_KEY = evt.target.value;
              openaiLibrary = initializeOpenAIAPI(OPENAI_API_KEY);
            }, 200);
          },
        },
      },
    ],
  };
}
