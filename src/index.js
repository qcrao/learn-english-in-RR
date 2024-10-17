import React from "react";
import ReactDOM from "react-dom";
import { SpeechIcon } from "./SpeechIcon";
import {
  initPanelConfig,
  defaultModel,
  apiKey,
  selectedVoiceName,
} from "./config";

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

      // 获取可用的语音
      const voices = speechSynthesis.getVoices();

      // 选择指定的语音
      let selectedVoice = voices.find(
        (voice) => voice.name === selectedVoiceName
      );

      // 如果找到了指定的语音，就使用它
      if (!selectedVoice) {
        console.warn("Selected voice not found, using default voice");
        selectedVoice = voices[0]; // 使用第一个可用的语音作为默认值
      }

      utterance.voice = selectedVoice;

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

  // 在页面加载完后调用函数
  console.log("selectedVoiceName", selectedVoiceName);
  console.log("addSpeechIconToHighlights");
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
