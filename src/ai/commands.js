import OpenAI from "openai";
import { AppToaster } from "../components/toaster";
import { isResponseToSplit, openaiLibrary, streamResponse } from "../config";
import {
  displaySpinner,
  insertParagraphForStream,
  removeSpinner,
} from "../utils/domElt";
import { splitParagraphs } from "../utils/format";
import {
  addContentToBlock,
  createChildBlock,
  createSiblingBlock,
  insertBlockInCurrentView,
  isExistingBlock,
  processContent,
} from "../utils/utils";
import axios from "axios";
import { Tiktoken } from "js-tiktoken/lite"; // too big in bundle (almost 3 Mb)

export let isCanceledStreamGlobal = false;

export const tokensLimit = {
  "gpt-3.5-turbo": 16385,
  "gpt-4-turbo-preview": 131073,
  "gpt-4o": 131073,
  "Claude Haiku": 200000,
  "Claude Sonnet": 200000,
  "Claude Opus": 200000,
  custom: undefined,
};

const getTokenizer = async () => {
  try {
    const { data } = await axios.get(
      "https://tiktoken.pages.dev/js/cl100k_base.json"
    );
    return new Tiktoken(data);
  } catch (error) {
    console.log("Fetching tiktoken rank error:>> ", error);
    return null;
  }
};
export let tokenizer = await getTokenizer();

export const lastCompletion = {
  prompt: null,
  targetUid: null,
  context: null,
  typeOfCompletion: null,
};

export const insertCompletion = async (
  prompt,
  targetUid,
  context,
  typeOfCompletion,
  instantModel,
  isRedone
) => {
  lastCompletion.prompt = prompt;
  lastCompletion.context = context;
  lastCompletion.targetUid = targetUid;
  lastCompletion.typeOfCompletion = typeOfCompletion;
  lastCompletion.instantModel = instantModel;

  let defaultModel = "gpt-3.5-turbo";

  let model = instantModel || defaultModel;
  if (model === "first OpenRouter model") {
    model = openRouterModels.length
      ? "openRouter/" + openRouterModels[0]
      : "gpt-3.5-turbo";
  } else if (model === "first Ollama local model") {
    model = ollamaModels.length ? "ollama/" + ollamaModels[0] : "gpt-3.5-turbo";
  }
  const responseFormat =
    typeOfCompletion === "gptPostProcessing" ? "json_object" : "text";

  console.log("responseFormat", responseFormat);

  let content = context;

  if (isRedone) content = context;
  else {
    content = await verifyTokenLimitAndTruncate(model, prompt, content);
  }
  console.log("Context (eventually truncated):\n", content);

  if (isRedone && typeOfCompletion === "gptCompletion") {
    if (isExistingBlock(targetUid)) {
      targetUid = createSiblingBlock(targetUid, "before");
      window.roamAlphaAPI.updateBlock({
        block: {
          uid: targetUid,
          string: assistantRole,
        },
      });
    } else targetUid = await insertBlockInCurrentView(assistantRole);
  }
  const intervalId = await displaySpinner(targetUid);
  console.log("Prompt sent to AI assistant :>>\n", prompt);
  const aiResponse = await aiCompletion(
    model,
    context,
    prompt,
    responseFormat,
    targetUid
  );
  console.log("aiResponse :>> ", aiResponse);
  removeSpinner(intervalId);
  if (typeOfCompletion === "gptPostProcessing" && Array.isArray(aiResponse)) {
    console.log("gptPostProcessing");
    updateArrayOfBlocks(aiResponse);
  } else {
    const splittedResponse = splitParagraphs(aiResponse);
    console.log("split aiResponse :>> ", splittedResponse);
    // 主处理逻辑
    console.log("split aiResponse :>> ", splittedResponse);
    for (let i = 0; i < splittedResponse.length; i++) {
      processContent(targetUid, splittedResponse[i]);
    }
    // if (!isResponseToSplit || splittedResponse.length === 1)
    //   addContentToBlock(targetUid, splittedResponse[0]);
    // else {
    //   for (let i = 0; i < splittedResponse.length; i++) {
    //     createChildBlock(targetUid, splittedResponse[i]);
    //   }
    // }
  }
};

async function aiCompletion(
  instantModel,
  prompt,
  content = "",
  responseFormat,
  targetUid
) {
  let aiResponse;
  let model = instantModel || defaultModel;
  let prefix = model.split("/")[0];
  if (responseFormat === "json_object")
    prompt += "\n\nResponse format:\n" + instructionsOnJSONResponse;
  if (prefix === "openRouter" && openrouterLibrary?.apiKey) {
    aiResponse = await openaiCompletion(
      openrouterLibrary,
      model.replace("openRouter/", ""),
      prompt,
      content,
      responseFormat,
      targetUid
    );
  } else if (prefix === "ollama") {
    aiResponse = await ollamaCompletion(
      model.replace("ollama/", ""),
      prompt,
      content,
      responseFormat,
      targetUid
    );
  } else {
    if (model.slice(0, 6) === "Claude" && ANTHROPIC_API_KEY)
      aiResponse = await claudeCompletion(
        model,
        prompt,
        content,
        responseFormat,
        targetUid
      );
    else if (openaiLibrary?.apiKey)
      aiResponse = await openaiCompletion(
        openaiLibrary,
        model,
        prompt,
        content,
        responseFormat,
        targetUid
      );
    else {
      AppToaster.show({
        message: `Provide an API key to use ${model} model. See doc and settings.`,
        timeout: 15000,
      });
      AppToaster;
      return "";
    }
  }

  if (responseFormat === "json_object") {
    let parsedResponse = JSON.parse(aiResponse);
    if (typeof parsedResponse.response === "string")
      parsedResponse.response = JSON.parse(parsedResponse.response);
    aiResponse = parsedResponse.response;
  }

  return aiResponse;
}

const verifyTokenLimitAndTruncate = async (model, prompt, content) => {
  // console.log("tokensLimit object :>> ", tokensLimit);
  if (!tokenizer) {
    tokenizer = await getTokenizer();
  }
  if (!tokenizer) return content;
  const tokens = tokenizer.encode(prompt + content);
  console.log("context tokens :", tokens.length);

  const limit = tokensLimit[model];
  if (!limit) {
    console.log("No context length provided for this model.");
    return content;
  }

  if (tokens.length > limit) {
    AppToaster.show({
      message: `The token limit (${limit}) has been exceeded (${tokens.length} needed), the context will be truncated to fit ${model} token window.`,
    });
    // 1% margin of error
    const ratio = limit / tokens.length - 0.01;
    content = content.slice(0, content.length * ratio);
    console.log(
      "tokens of truncated context:",
      tokenizer.encode(prompt + content).length
    );
  }
  return content;
};

export function initializeOpenAIAPI(API_KEY, baseURL) {
  try {
    const clientSetting = {
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true,
    };
    if (baseURL) {
      clientSetting.baseURL = baseURL;
      clientSetting.defaultHeaders = {
        "HTTP-Referer":
          "https://github.com/fbgallet/roam-extension-speech-to-roam", // Optional, for including your app on openrouter.ai rankings.
        "X-Title": "Live AI Assistant for Roam Research", // Optional. Shows in rankings on openrouter.ai.
      };
    }
    const openai = new OpenAI(clientSetting);
    return openai;
  } catch (error) {
    console.log(error.message);
    AppToaster.show({
      message: `Live AI Assistant - Error during the initialization of OpenAI API: ${error.message}`,
    });
  }
}

export async function openaiCompletion(
  aiClient,
  model,
  prompt,
  content,
  responseFormat = "text",
  targetUid
) {
  let respStr = "";
  let messages = [
    {
      role: "system",
      content: content,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
      ],
    },
  ];

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Timeout error on client side: OpenAI response time exceeded (90 seconds)"
          )
        );
      }, 90000);
    });
    const response = await Promise.race([
      await aiClient.chat.completions.create({
        model: model,
        response_format: { type: responseFormat },
        messages: messages,
        stream: streamResponse && responseFormat === "text",
      }),
      timeoutPromise,
    ]);
    let streamEltCopy = "";

    console.log("streamResponse", streamResponse);
    console.log(response);

    if (streamResponse && responseFormat === "text") {
      const streamElt = insertParagraphForStream(targetUid);

      try {
        for await (const chunk of response) {
          if (isCanceledStreamGlobal) {
            streamElt.innerHTML += "(⚠️ stream interrupted by user)";
            // respStr = "";
            break;
          }
          respStr += chunk.choices[0]?.delta?.content || "";
          streamElt.innerHTML += chunk.choices[0]?.delta?.content || "";
        }
      } catch (e) {
        console.log("Error during OpenAI stream response: ", e);
        return "";
      } finally {
        streamEltCopy = streamElt.innerHTML;
        if (isCanceledStreamGlobal)
          console.log("GPT response stream interrupted.");
        else streamElt.remove();
      }
    }
    console.log("OpenAI chat completion response :>>", response);
    return streamResponse && responseFormat === "text"
      ? respStr
      : response.choices[0].message.content;
  } catch (error) {
    console.error(error);
    AppToaster.show({
      message: `OpenAI error msg: ${error.message}`,
      timeout: 15000,
    });
    return respStr;
  }
}
