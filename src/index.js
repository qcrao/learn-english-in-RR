import React from "react";
import ReactDOM from "react-dom";
import { SpeechIcon } from "./SpeechIcon";

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

function addSpeechIconToHighlights() {
  const highlights = document.querySelectorAll(".rm-highlight");

  highlights.forEach((highlight) => {
    if (
      highlight.nextElementSibling &&
      highlight.nextElementSibling.classList.contains("speech-icon-container")
    ) {
      return;
    }

    const text = highlight.textContent;
    const iconContainer = document.createElement("span");
    iconContainer.className = "speech-icon-container";

    ReactDOM.render(
      <SpeechIcon
        onClick={() => {
          const utterance = new SpeechSynthesisUtterance(text);
          speechSynthesis.speak(utterance);
        }}
      />,
      iconContainer
    );

    highlight.insertAdjacentElement("afterend", iconContainer);
  });
}

async function onload({ extensionAPI }) {
  console.log("Loaded Learn-English-in-RR in roam");

  const panelConfig = initPanelConfig(extensionAPI);
  await extensionAPI.settings.panel.create(panelConfig);

  // 在页面加载完成后调用函数
  addSpeechIconToHighlights();

  let debounceTimer;
  const observer = new MutationObserver((mutations) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const hasRelevantChanges = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node.classList.contains("rm-highlight") ||
              node.querySelector(".rm-highlight"))
        )
      );
      if (hasRelevantChanges) {
        addSpeechIconToHighlights();
      }
    }, 500);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function onunload() {
  console.log("Unloaded Learn-English-in-RR in roam");
  // 如果需要,在这里清理添加的图标和事件监听器
}

export default {
  onload: onload,
  onunload: onunload,
};
