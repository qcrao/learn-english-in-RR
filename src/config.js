import { getValidLanguageCode, initializeOpenAIAPI } from "./ai/commands";

export let selectedVoiceName = "Nicky";

export let openaiLibrary;
export let OPENAI_API_KEY = "";
export let defaultOpenAIModel;

export let streamResponse = true;
export let motherLanguage = "zh";

export function loadInitialSettings(extensionAPI) {
  OPENAI_API_KEY = extensionAPI.settings.get("openai-api-key");
  openaiLibrary = initializeOpenAIAPI(OPENAI_API_KEY);

  defaultOpenAIModel = extensionAPI.settings.get("model-provider");
  if (!defaultOpenAIModel) defaultOpenAIModel = "GPT-4o-mini";

  streamResponse = extensionAPI.settings.get("streamResponse");
  if (!streamResponse) streamResponse = true;

  motherLanguage = extensionAPI.settings.get("mother-language-input");
  if (!motherLanguage) motherLanguage = "zh";
}

export function initPanelConfig(extensionAPI) {
  return {
    tabTitle: "Learn English in RR",
    settings: [
      {
        id: "model-provider",
        name: "Model Provider",
        description: "Choose the model provider",
        action: {
          type: "select",
          items: ["OpenAI", "GitHub"],
          onChange: (value) => {
            defaultOpenAIModel = value;
          },
        },
      },
      {
        id: "streamResponse",
        name: "Stream response",
        description:
          "Stream responses of GPT models and OpenRouter streamable models:",
        action: {
          type: "switch",
          onChange: (evt) => {
            streamResponse = !streamResponse;
          },
        },
      },
      {
        id: "openai-api-key",
        name: "OpenAI API Key (GPT)",
        description: (
          <>
            <span>Copy here your OpenAI API key for Whisper & GPT models</span>
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
        id: "voice-selection",
        name: "Voice",
        description: "Select the preferred voice",
        action: {
          type: "select",
          items: ["Nicky", "Aaron", "Daniel", "Junior"],
          onChange: (value) => {
            if (value === "Daniel") {
              selectedVoiceName = "Daniel (English (United Kingdom))";
            } else {
              selectedVoiceName = value;
            }
          },
        },
      },
    ],
  };
}
