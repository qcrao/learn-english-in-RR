export let defaultModel;

async function onload({ extensionAPI, ...rest }) {
  console.log("Loaded learn english in roam");

  const panelConfig = {
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
            console.log(value);
          },
        },
      },
    ],
  };

  await extensionAPI.settings.panel.create(panelConfig);
}

function onunload() {
  console.log("Unloaded learn english in roam");
}

export default {
  onload: onload,
  onunload: onunload,
};
