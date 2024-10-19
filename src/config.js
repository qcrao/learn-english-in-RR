import { systemPrompt } from "../systemPrompt";
import { initializeOpenAIAPI } from "./ai/commands";
import OpenAI from "openai";

export let defaultModel;
export let apiKey;
export let selectedVoiceName = "Nicky";
export let OPENAI_API_KEY =
  "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";
export let isResponseToSplit;
export let streamResponse = true;

export let openaiLibrary;

export function initPanelConfig(extensionAPI) {
  console.log(systemPrompt);
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
        id: "splitResponse",
        name: "Split response in multiple blocks",
        description:
          "Divide the responses of the AI assistant into as many blocks as paragraphs",
        action: {
          type: "switch",
          onChange: (evt) => {
            isResponseToSplit = !isResponseToSplit;
          },
        },
      },
      {
        id: "openaiapi-key",
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
