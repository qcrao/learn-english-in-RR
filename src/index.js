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
    // 检查是否已经添加了语音图标
    if (
      highlight.nextElementSibling &&
      highlight.nextElementSibling.classList.contains("speech-icon-container")
    ) {
      return;
    }

    const text = highlight.textContent;
    const iconContainer = document.createElement("span");
    iconContainer.className = "speech-icon-container";

    // 创建一个函数来处理朗读
    const speakText = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    };

    // 为高亮文本添加鼠标悬停事件
    highlight.addEventListener("mouseenter", speakText);
    highlight.addEventListener("mouseleave", () => speechSynthesis.cancel());

    // 使用函数组件和 React.createElement 替代 ReactDOM.render
    const SpeechIconComponent = () => {
      return React.createElement(SpeechIcon, {
        onClick: speakText,
        onMouseEnter: speakText,
        onMouseLeave: () => speechSynthesis.cancel(),
      });
    };

    ReactDOM.render(React.createElement(SpeechIconComponent), iconContainer);
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
