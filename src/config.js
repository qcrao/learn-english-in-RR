export let defaultModel;
export let apiKey;
export let selectedVoiceName = "Nicky";

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
            defaultModel = value;
          },
        },
      },
      {
        id: "api-key",
        name: "API Key",
        description: "Enter your API key",
        action: {
          type: "input",
          onChange: (value) => {
            apiKey = value;
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
