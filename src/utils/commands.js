import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import { AppToaster } from "../components/toaster";
import { motherLanguage, ankiDeckName } from "../config";
import {
  createChildBlock,
  getFocusAndSelection,
  getBlockAndChildrenContentByUid,
} from "./utils";
import { createAnkiCardFromBlock } from "./anki";
import axios from "axios";

export const CONTEXT_MENU_COMMAND_LABEL = "Extract new words";
export const ANKI_CONTEXT_MENU_COMMAND_LABEL = "Send to Anki";

export const loadRoamExtensionCommands = async (extensionAPI) => {
  const extractNewWords = (uid, blockContent) => {
    // if content is empty, return
    if (!blockContent) {
      AppToaster.show({
        message: "Content is empty. Please provide some text to process.",
        intent: "warning",
        timeout: 3000,
      });
      return;
    }

    // check the new words total number separated by ^^^^
    const newWordsArray = blockContent.match(/\^\^(.*?)\^\^/g) || [];
    const newWordsNumber = newWordsArray.length;

    const maxWordsLimit = 10;

    if (newWordsNumber > maxWordsLimit) {
      AppToaster.show({
        message: `Too many (${newWordsNumber}) new words. Please provide less than ${maxWordsLimit} new words.`,
        intent: "warning",
        timeout: 3000,
      });
      return;
    }

    console.log("uid: ", uid);
    const targetUid = createChildBlock(uid, "");

    console.log("createChildBlock targetUid: ", targetUid);

    insertCompletion(
      motherLanguage,
      uid,
      systemPrompt,
      targetUid,
      blockContent
    );
  };

  // Add the send to Anki function
  const sendToAnki = async (uid) => {
    try {
      AppToaster.show({
        message: "Sending to Anki...",
        intent: "primary",
        timeout: 2000,
      });

      const blockContent = getBlockAndChildrenContentByUid(uid);

      if (!blockContent) {
        AppToaster.show({
          message: "No content found in the selected block.",
          intent: "warning",
          timeout: 3000,
        });
        return;
      }

      // Check if the block contains highlighted words
      const hasHighlightedWords =
        blockContent.includes("^^") || blockContent.includes("🔊");

      if (!hasHighlightedWords) {
        AppToaster.show({
          message:
            "No highlighted words found in the selected block. Please highlight words with ^^ or 🔊.",
          intent: "warning",
          timeout: 3000,
        });
        return;
      }

      // Check if Anki Connect is available
      try {
        await axios.post("http://localhost:8765", {
          action: "version",
          version: 6,
        });
      } catch (error) {
        AppToaster.show({
          message:
            "Error connecting to Anki. Please make sure Anki is running with AnkiConnect plugin installed.",
          intent: "danger",
          timeout: 5000,
        });
        return;
      }

      const success = await createAnkiCardFromBlock(blockContent);

      // The success message is now handled in the createAnkiCardFromBlock function
    } catch (error) {
      console.error("Error sending to Anki:", error);
      AppToaster.show({
        message: `Error sending to Anki: ${error.message}`,
        intent: "danger",
        timeout: 5000,
      });
    }
  };

  // Add the new context menu option
  extensionAPI.ui.commandPalette.addCommand({
    label: "Extract new words: from current block, with highlight",
    callback: async () => {
      const { currentUid, currentBlockContent } = getFocusAndSelection();
      if (currentUid) {
        extractNewWords(currentUid, currentBlockContent);
      }
    },
  });

  // Add the Anki context menu option to command palette
  extensionAPI.ui.commandPalette.addCommand({
    label: "Send to Anki: create flashcard from current block",
    callback: async () => {
      const { currentUid } = getFocusAndSelection();
      if (currentUid) {
        sendToAnki(currentUid);
      }
    },
  });

  // Add the context menu item for extracting words
  const commandCallback = (e) => {
    const uid = e.target.closest(".rm-block__input").id.slice(-9);
    const blockContent = e.target.closest(".rm-block__input").textContent;
    extractNewWords(uid, blockContent);
  };

  // Add the context menu item for sending to Anki
  const ankiCommandCallback = (e) => {
    const uid = e.target.closest(".rm-block__input").id.slice(-9);
    sendToAnki(uid);
  };

  await window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: CONTEXT_MENU_COMMAND_LABEL,
    callback: commandCallback,
  });

  // Add the Anki context menu command
  await window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: ANKI_CONTEXT_MENU_COMMAND_LABEL,
    callback: ankiCommandCallback,
  });
};
