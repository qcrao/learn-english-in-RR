export let defaultModel;
export let apiKey;

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
    ],
  };
}

async function onload({ extensionAPI, ...rest }) {
  console.log("Loaded Learn-English-in-RR in roam");

  const panelConfig = initPanelConfig(extensionAPI);

  await extensionAPI.settings.panel.create(panelConfig);
}

function onunload() {
  console.log("Unloaded Learn-English-in-RR in roam");
}

export default {
  onload: onload,
  onunload: onunload,
};
