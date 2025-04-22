import React from "react";
import ReactDOM from "react-dom";
import { SpeechIcon } from "./SpeechIcon";
import { initPanelConfig, loadInitialSettings } from "./config";
import { speakText } from "./utils/speechUtils";
import {
  loadRoamExtensionCommands,
  CONTEXT_MENU_COMMAND_LABEL,
  ANKI_CONTEXT_MENU_COMMAND_LABEL,
} from "./utils/commands";

// Define event handlers at module scope so they can be referenced both when adding and removing
const handleHighlightEnter = (event) => {
  const text = event.target.textContent;
  speakText(text);
};

const handleHighlightLeave = () => {
  speechSynthesis.cancel();
};

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

    // 为高亮文本添加鼠标悬停事件
    highlight.addEventListener("mouseenter", handleHighlightEnter);
    highlight.addEventListener("mouseleave", handleHighlightLeave);

    // 使用函数组件和 React.createElement 替代 ReactDOM.render
    const SpeechIconComponent = () => {
      return React.createElement(SpeechIcon, {
        onClick: () => speakText(text),
        onMouseEnter: () => speakText(text),
        onMouseLeave: handleHighlightLeave,
      });
    };

    ReactDOM.render(React.createElement(SpeechIconComponent), iconContainer);
    highlight.insertAdjacentElement("afterend", iconContainer);
  });
}

// 将 observer 移到外部作用域
let observer;

async function onload({ extensionAPI }) {
  await loadInitialSettings(extensionAPI);
  console.log("Loaded Learn-English-in-RR in roam");

  const panelConfig = initPanelConfig(extensionAPI);
  await extensionAPI.settings.panel.create(panelConfig);

  loadRoamExtensionCommands(extensionAPI);

  // 在页面加载完后调用函数
  addSpeechIconToHighlights();

  let debounceTimer;
  observer = new MutationObserver((mutations) => {
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

  // Remove the context menu commands
  window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
    label: CONTEXT_MENU_COMMAND_LABEL,
  });
  
  window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
    label: ANKI_CONTEXT_MENU_COMMAND_LABEL,
  });

  // 如果需要,在这里清理添加的图标和事件监听器
  const speechIconContainers = document.querySelectorAll(
    ".speech-icon-container"
  );
  if (speechIconContainers?.length) {
    speechIconContainers.forEach((container) => {
      container?.remove();
    });
  }

  const highlights = document.querySelectorAll(".rm-highlight");
  if (highlights?.length) {
    highlights.forEach((highlight) => {
      if (highlight) {
        highlight.removeEventListener("mouseenter", handleHighlightEnter);
        highlight.removeEventListener("mouseleave", handleHighlightLeave);
      }
    });
  }
  // clear the observer
  if (observer) {
    observer.disconnect();
  }
}

export default {
  onload: onload,
  onunload: onunload,
};
