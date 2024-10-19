import React from "react";
import ReactDOM from "react-dom";
import { SpeechIcon } from "./SpeechIcon";
import {
  initPanelConfig,
  defaultModel,
  apiKey,
  selectedVoiceName,
  OPENAI_API_KEY,
} from "./config";
import { speakText } from "./utils/speechUtils";
import { loadRoamExtensionCommands } from "./utils/commands";

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

    // Use the imported speakText function
    const handleSpeak = () => speakText(text);

    // 为高亮文本添加鼠标悬停事件
    highlight.addEventListener("mouseenter", handleSpeak);
    highlight.addEventListener("mouseleave", () => speechSynthesis.cancel());

    // 使用函数组件和 React.createElement 替代 ReactDOM.render
    const SpeechIconComponent = () => {
      return React.createElement(SpeechIcon, {
        onClick: handleSpeak,
        onMouseEnter: handleSpeak,
        onMouseLeave: () => speechSynthesis.cancel(),
      });
    };

    ReactDOM.render(React.createElement(SpeechIconComponent), iconContainer);
    highlight.insertAdjacentElement("afterend", iconContainer);
  });
}

async function onload({ extensionAPI }) {
  console.log("Loaded Learn-English-in-RR in roam");

  if (extensionAPI.settings.get("openaiapi-key") === null)
    await extensionAPI.settings.set(
      "openaiapi-key",
      "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"
    );

  if (extensionAPI.settings.get("streamResponse") === null)
    await extensionAPI.settings.set("streamResponse", true);
  if (extensionAPI.settings.get("splitResponse") === null)
    await extensionAPI.settings.set("splitResponse", true);

  const panelConfig = initPanelConfig(extensionAPI);
  await extensionAPI.settings.panel.create(panelConfig);

  loadRoamExtensionCommands(extensionAPI);

  // 在页面加载完后调用函数
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
