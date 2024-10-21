import OpenAI from "openai";
import { AppToaster } from "../components/toaster";
import { openaiLibrary, streamResponse } from "../config";
import {
  displaySpinner,
  insertParagraphForStream,
  removeSpinner,
} from "../utils/domElt";
import { processContent } from "../utils/utils";
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

export const insertCompletion = async (
  motherLanguage,
  parentUid,
  prompt,
  targetUid,
  content,
  instantModel
) => {
  let defaultModel = "gpt-4o-mini";

  let model = instantModel || defaultModel;

  content = await verifyTokenLimitAndTruncate(model, prompt, content);

  prompt += `\n\nThe mother language of the user is ${motherLanguage}.`;

  const intervalId = await displaySpinner(targetUid);

  const aiResponse = await aiCompletion(
    model,
    prompt,
    content,
    "text",
    targetUid
  );
  removeSpinner(intervalId);

  // remove targetUid
  window.roamAlphaAPI.deleteBlock({
    block: {
      uid: targetUid,
    },
  });

  processContent(parentUid, aiResponse);
};
const supportedLanguage = [
  "af",
  "am",
  "ar",
  "as",
  "az",
  "ba",
  "be",
  "bg",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "cs",
  "cy",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fo",
  "fr",
  "gl",
  "gu",
  "ha",
  "haw",
  "he",
  "hi",
  "hr",
  "ht",
  "hu",
  "hy",
  "id",
  "is",
  "it",
  "ja",
  "jw",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "la",
  "lb",
  "ln",
  "lo",
  "lt",
  "lv",
  "mg",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "ne",
  "nl",
  "nn",
  "no",
  "oc",
  "pa",
  "pl",
  "ps",
  "pt",
  "ro",
  "ru",
  "sa",
  "sd",
  "si",
  "sk",
  "sl",
  "sn",
  "so",
  "sq",
  "sr",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "tk",
  "tl",
  "tr",
  "tt",
  "uk",
  "ur",
  "uz",
  "vi",
  "yi",
  "yo",
  "zh",
];

export function getValidLanguageCode(input) {
  if (!input) return "";
  let lggCode = input.toLowerCase().trim().slice(0, 2);
  if (supportedLanguage.includes(lggCode)) {
    AppToaster.clear();
    return lggCode;
  } else {
    AppToaster.show({
      message:
        "Learn English in RR: Incorrect language code for mother language, see instructions in settings panel.",
    });
    return "";
  }
}
async function aiCompletion(
  instantModel,
  prompt,
  content,
  responseFormat,
  targetUid
) {
  let aiResponse;
  let model = instantModel || defaultModel;

  if (openaiLibrary?.apiKey) {
    aiResponse = await openaiCompletion(
      openaiLibrary,
      model,
      prompt,
      content,
      responseFormat,
      targetUid
    );
  } else {
    AppToaster.show({
      message: `Provide an API key to use ${model} model. See doc and settings.`,
      timeout: 15000,
    });
    AppToaster;
    return "";
  }

  return aiResponse;
}

const verifyTokenLimitAndTruncate = async (model, prompt, content) => {
  if (!tokenizer) {
    tokenizer = await getTokenizer();
  }
  if (!tokenizer) return content;
  const tokens = tokenizer.encode(prompt + content);

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
        "HTTP-Referer": "https://github.com/qcrao/learn-english-in-RR", // Optional, for including your app on openrouter.ai rankings.
        "X-Title": "Learn English in RR", // Optional. Shows in rankings on openrouter.ai.
      };
    }
    const openai = new OpenAI(clientSetting);
    return openai;
  } catch (error) {
    console.log(error.message);
    AppToaster.show({
      message: `Learn English in RR - Error during the initialization of OpenAI API: ${error.message}`,
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
      content: prompt,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: content,
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
    console.log("respStr :>> ", respStr);
    return streamResponse && responseFormat === "text"
      ? respStr
      : response.choices[0].message.content;
  } catch (error) {
    console.error(error);
    AppToaster.show({
      message: `OpenAI error msg: ${error.message}`,
      timeout: 15000,
    });
    console.log("respStr :>> ", respStr);
    return respStr;
  }
}
