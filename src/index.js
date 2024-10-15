import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeUp } from "@fortawesome/free-solid-svg-icons";

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

  console.log(highlights);

  highlights.forEach((highlight) => {
    // 检查是否已经添加了图标
    if (
      highlight.nextElementSibling &&
      highlight.nextElementSibling.classList.contains("speech-icon")
    ) {
      console.log("已经添加了图标");
      return;
    }

    const speechIcon = document.createElement("span");
    speechIcon.className = "speech-icon";
    speechIcon.innerHTML = `<FontAwesomeIcon icon={faVolumeUp} />`;
    speechIcon.style.marginLeft = "5px";
    speechIcon.style.cursor = "pointer";

    const text = highlight.textContent;

    speechIcon.addEventListener("mouseover", () => {
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.speak(utterance);
    });

    console.log("speechIcon", speechIcon);

    highlight.insertAdjacentElement("afterend", speechIcon);
  });
}

async function onload({ extensionAPI }) {
  console.log("Loaded Learn-English-in-RR in roam");

  const panelConfig = initPanelConfig(extensionAPI);
  await extensionAPI.settings.panel.create(panelConfig);

  // 在页面加载完成后调用函数
  addSpeechIconToHighlights();

  // 监听页面变化,以处理动态加载的内容
  const observer = new MutationObserver(() => {
    addSpeechIconToHighlights();
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
