import OpenAI from "openai";
import { AppToaster } from "../components/toaster";
import {
  OPENAI_API_KEY,
  openaiClient,
  streamResponse,
  GROK_API_KEY,
  grokClient,
  DEEPSEEK_API_KEY,
  deepseekClient,
  selectedAIProvider,
  defaultOpenAIModel,
  defaultGrokModel,
  defaultDeepSeekModel,
} from "../config";
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
  "gpt-4o-mini": 128000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  "o1-preview": 128000,
  "o1-mini": 128000,
  "grok-1": 128000,
  "grok-3-beta": 128000,
  "grok-3-mini-beta": 128000,
  "deepseek-chat": 64000,
  "deepseek-reasoner": 64000,
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

// Helper function to get already parsed words from immediate child blocks
function getExistingParsedWords(blockUid) {
  // Get all immediate children, regardless of whether they have children
  const childrenQuery = `[:find (pull ?child [:block/string])
                        :where
                        [?parent :block/uid "${blockUid}"]
                        [?child :block/parents ?parent]
                        [?parent :block/children ?child]]`; // This ensures we only get immediate children

  const results = window.roamAlphaAPI.q(childrenQuery);
  const existingWords = new Set();

  results.forEach((result) => {
    const blockContent = result[0]?.string;

    if (blockContent) {
      // Extract the first word, which may have ^^ marks
      const wordMatch = blockContent.match(/^\^\^([^`^]+)\^\^/);
      if (wordMatch && wordMatch[1]) {
        existingWords.add(wordMatch[1].toLowerCase());
      }
    }
  });

  return existingWords;
}

// Helper function to remove ^^ marks from already parsed words
function removeMarksFromParsedWords(content, existingWords) {
  let result = content;
  // First pass: remove ^^ marks from already parsed words
  existingWords.forEach((word) => {
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\^\\^${escapedWord}\\^\\^`, "gi");
    result = result.replace(regex, word);
  });

  return result;
}

export const insertCompletion = async (
  motherLanguage,
  parentUid,
  prompt,
  targetUid,
  content
) => {
  // Get existing parsed words
  const existingWords = getExistingParsedWords(parentUid);
  console.log("existingWords: ", existingWords);

  // Remove ^^ marks from already parsed words
  const updatedContent = removeMarksFromParsedWords(content, existingWords);

  // Check if there are any remaining marked words
  const remainingMarkedWords = updatedContent.match(/\^\^([^\^]+)\^\^/g);
  console.log("remainingMarkedWords: ", remainingMarkedWords);

  if (!remainingMarkedWords) {
    AppToaster.show({
      message: "No new marked words to parse.",
      intent: "warning",
      timeout: 3000,
    });
    // remove targetUid
    window.roamAlphaAPI.deleteBlock({
      block: {
        uid: targetUid,
      },
    });
    return;
  }

  // model should be grok-3-mini-beta or gpt-4o-mini or deepseek-chat
  let model = "gpt-4o-mini";
  if (selectedAIProvider === "xAI") {
    model = "grok-3-mini-beta";
  } else if (selectedAIProvider === "deepseek") {
    model = "deepseek-chat";
  }

  content = await verifyTokenLimitAndTruncate(model, prompt, updatedContent);

  prompt += `\n\nThe mother language of the user is ${motherLanguage}.`;

  if (!motherLanguage) {
    AppToaster.show({
      message:
        "Incorrect mother language code, see instructions in settings panel.",
      intent: "warning",
      timeout: 3000,
    });
    // remove targetUid
    window.roamAlphaAPI.deleteBlock({
      block: {
        uid: targetUid,
      },
    });
    console.error("No mother language provided");
    return;
  }

  const intervalId = await displaySpinner(targetUid);
  console.log("intervalId: ", intervalId);

  console.log("targetUid: ", targetUid);
  const aiResponse = await aiCompletion(prompt, content, "text", targetUid);
  removeSpinner(intervalId);

  // remove targetUid
  window.roamAlphaAPI.deleteBlock({
    block: {
      uid: targetUid,
    },
  });

  if (!aiResponse) {
    console.error("No response from AI");
    return;
  }

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

  // Handle special cases for Chinese variants
  if (
    input.toLowerCase().trim() === "zh-tw" ||
    input.toLowerCase().trim() === "zh-hant"
  ) {
    AppToaster.clear();
    return "zh-Hant";
  }
  if (
    input.toLowerCase().trim() === "zh-cn" ||
    input.toLowerCase().trim() === "zh-hans"
  ) {
    AppToaster.clear();
    return "zh-Hans";
  }

  // Handle basic two-letter codes
  let lggCode = input.toLowerCase().trim().slice(0, 2);
  if (supportedLanguage.includes(lggCode)) {
    AppToaster.clear();
    return lggCode;
  } else {
    AppToaster.show({
      message:
        "Incorrect language code for mother language, see instructions in settings panel.",
    });
    return "";
  }
}

async function aiCompletion(prompt, content, responseFormat, targetUid) {
  let aiResponse = "";

  // Select the appropriate API based on the chosen provider
  switch (selectedAIProvider) {
    case "openai":
      if (openaiClient && openaiClient.apiKey && openaiClient.apiKey !== "") {
        aiResponse = await openaiCompletion(
          openaiClient,
          defaultOpenAIModel,
          prompt,
          content,
          responseFormat,
          targetUid
        );
      } else {
        AppToaster.show({
          message: `Provide an OpenAI API key to use ${defaultOpenAIModel} model. See doc and settings.`,
          intent: "warning",
          timeout: 15000,
        });
      }
      break;

    case "xAI":
      if (GROK_API_KEY && GROK_API_KEY !== "") {
        aiResponse = await grokCompletion(prompt, content, targetUid);
      } else {
        AppToaster.show({
          message: `Provide a xAI API key to use ${defaultGrokModel} model. See settings.`,
          intent: "warning",
          timeout: 15000,
        });
      }
      break;

    case "deepseek":
      if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "") {
        aiResponse = await deepseekCompletion(prompt, content, targetUid);
      } else {
        AppToaster.show({
          message: `Provide a DeepSeek API key to use ${defaultDeepSeekModel} model. See settings.`,
          intent: "warning",
          timeout: 15000,
        });
      }
      break;

    default:
      AppToaster.show({
        message: `Unknown AI provider: ${selectedAIProvider}. Please select a valid provider in settings.`,
        intent: "warning",
        timeout: 15000,
      });
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

export function initializeGrokAPI(API_KEY) {
  try {
    if (!API_KEY || API_KEY === "") {
      return null;
    }

    // Initialize Grok client using OpenAI SDK with Grok baseURL
    const grokClient = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://api.x.ai/v1",
      dangerouslyAllowBrowser: true,
    });

    return grokClient;
  } catch (error) {
    console.log(error.message);
    AppToaster.show({
      message: `Learn English in RR - Error with xAI API key: ${error.message}`,
      intent: "warning",
    });
    return null;
  }
}

export function initializeDeepSeekAPI(API_KEY) {
  try {
    if (!API_KEY || API_KEY === "") {
      return null;
    }

    // Initialize DeepSeek client using OpenAI SDK with DeepSeek baseURL
    const deepseekClient = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://api.deepseek.com",
      dangerouslyAllowBrowser: true,
    });

    return deepseekClient;
  } catch (error) {
    console.log(error.message);
    AppToaster.show({
      message: `Learn English in RR - Error with DeepSeek API key: ${error.message}`,
      intent: "warning",
    });
    return null;
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

  console.log("messages: ", messages);
  console.log("model: ", model);
  console.log("prompt: ", prompt);
  console.log("content: ", content);
  console.log("responseFormat: ", responseFormat);
  console.log("in openaiCompletion targetUid: ", targetUid);

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
      console.log("in openaiCompletion streamResponse: ", streamResponse);

      // Create a placeholder for the stream content
      let streamElt = insertParagraphForStream(targetUid);

      // Set a flag to track if we found a real DOM element to work with
      let streamElementFound = false;

      // Retry finding the element up to 5 times with increasing delays
      for (let attempt = 0; attempt < 5; attempt++) {
        if (streamElt && !streamElt.classList.contains("placeholder")) {
          streamElementFound = true;
          break;
        }

        // Wait with exponential backoff
        const waitTime = 200 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Try to get the element again
        streamElt = document.querySelector(
          `[id*="${targetUid}"] .speech-stream`
        );
      }

      // If we couldn't find the element after retries, log the error but continue
      if (!streamElementFound) {
        console.error(
          `Could not find stream element for block with UID ${targetUid}`
        );
      }

      try {
        for await (const chunk of response) {
          if (isCanceledStreamGlobal) {
            if (streamElementFound) {
              streamElt.innerHTML += "(⚠️ stream interrupted by user)";
            }
            break;
          }
          respStr += chunk.choices[0]?.delta?.content || "";

          if (streamElementFound) {
            streamElt.innerHTML += chunk.choices[0]?.delta?.content || "";
          }
        }
      } catch (e) {
        console.log("Error during OpenAI stream response: ", e);
        return "";
      } finally {
        if (streamElementFound) {
          streamEltCopy = streamElt.innerHTML;
          if (!isCanceledStreamGlobal) {
            streamElt.remove();
          }
        }

        if (isCanceledStreamGlobal) {
          console.log("GPT response stream interrupted.");
        }
      }
    }
    return streamResponse && responseFormat === "text"
      ? respStr
      : response.choices[0].message.content;
  } catch (error) {
    console.error(error);
    AppToaster.show({
      message: `OpenAI error msg: ${error.message}`,
      timeout: 15000,
      intent: "danger",
    });
    return respStr;
  }
}

export async function grokCompletion(prompt, content, targetUid) {
  let respStr = "";

  console.log("Using xAI model:", defaultGrokModel);
  console.log("xAI prompt:", prompt);
  console.log("xAI content:", content);

  try {
    if (!grokClient) {
      throw new Error("xAI API client not initialized");
    }

    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: content },
    ];

    const intervalId = await displaySpinner(targetUid);

    if (streamResponse) {
      // Handle streaming response with OpenAI client
      const streamElt = insertParagraphForStream(targetUid);
      let streamElementFound =
        streamElt && !streamElt.classList.contains("placeholder");

      const response = await grokClient.chat.completions.create({
        model: defaultGrokModel,
        messages: messages,
        stream: true,
        temperature: 0.7,
      });

      // Process streaming response
      try {
        for await (const chunk of response) {
          if (isCanceledStreamGlobal) {
            if (streamElementFound) {
              streamElt.innerHTML += "(⚠️ stream interrupted by user)";
            }
            break;
          }
          const content = chunk.choices[0]?.delta?.content || "";
          respStr += content;

          if (streamElementFound) {
            streamElt.innerHTML += content;
          }
        }
      } catch (e) {
        console.error("Error during xAI stream response: ", e);
        return "";
      } finally {
        if (streamElementFound && !isCanceledStreamGlobal) {
          streamElt.remove();
        }

        if (isCanceledStreamGlobal) {
          console.log("xAI response stream interrupted.");
        }
      }
    } else {
      // Non-streaming response
      const response = await grokClient.chat.completions.create({
        model: defaultGrokModel,
        messages: messages,
        stream: false,
        temperature: 0.7,
      });

      respStr = response.choices[0].message.content;
    }

    removeSpinner(intervalId);
    return respStr;
  } catch (error) {
    console.error("xAI error:", error);
    AppToaster.show({
      message: `xAI error: ${error.message}`,
      timeout: 15000,
      intent: "danger",
    });
    return respStr;
  }
}

export async function deepseekCompletion(prompt, content, targetUid) {
  let respStr = "";

  console.log("Using DeepSeek model:", defaultDeepSeekModel);
  console.log("DeepSeek prompt:", prompt);
  console.log("DeepSeek content:", content);

  try {
    if (!deepseekClient) {
      throw new Error("DeepSeek API client not initialized");
    }

    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: content },
    ];

    const intervalId = await displaySpinner(targetUid);

    if (streamResponse) {
      // Handle streaming response with OpenAI client
      const streamElt = insertParagraphForStream(targetUid);
      let streamElementFound =
        streamElt && !streamElt.classList.contains("placeholder");

      const response = await deepseekClient.chat.completions.create({
        model: defaultDeepSeekModel,
        messages: messages,
        stream: true,
        temperature: 0.7,
      });

      // Process streaming response
      try {
        for await (const chunk of response) {
          if (isCanceledStreamGlobal) {
            if (streamElementFound) {
              streamElt.innerHTML += "(⚠️ stream interrupted by user)";
            }
            break;
          }
          const content = chunk.choices[0]?.delta?.content || "";
          respStr += content;

          if (streamElementFound) {
            streamElt.innerHTML += content;
          }
        }
      } catch (e) {
        console.error("Error during DeepSeek stream response: ", e);
        return "";
      } finally {
        if (streamElementFound && !isCanceledStreamGlobal) {
          streamElt.remove();
        }

        if (isCanceledStreamGlobal) {
          console.log("DeepSeek response stream interrupted.");
        }
      }
    } else {
      // Non-streaming response
      const response = await deepseekClient.chat.completions.create({
        model: defaultDeepSeekModel,
        messages: messages,
        stream: false,
        temperature: 0.7,
      });

      respStr = response.choices[0].message.content;
    }

    removeSpinner(intervalId);
    return respStr;
  } catch (error) {
    console.error("DeepSeek error:", error);
    AppToaster.show({
      message: `DeepSeek error: ${error.message}`,
      timeout: 15000,
      intent: "danger",
    });
    return respStr;
  }
}
