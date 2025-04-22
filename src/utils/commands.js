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
    // Explicitly set open=true to ensure the block is expanded
    const targetUid = createChildBlock(uid, "", "last", true);

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
      // First, get the total number of top-level children (words)
      const topLevelChildren = window.roamAlphaAPI.q(`
        [:find (pull ?block [:block/uid])
         :where 
         [?parent :block/uid "${uid}"]
         [?parent :block/children ?block]]
      `);

      if (!topLevelChildren || topLevelChildren.length === 0) {
        AppToaster.show({
          message: "No content found in the selected block.",
          intent: "warning",
          timeout: 3000,
        });
        return;
      }

      // Check if Anki Connect is available first
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

      let successfulCards = 0;

      // Process each top-level child (word) one by one
      for (let i = 0; i < topLevelChildren.length; i++) {
        // Get the content for the current word/phrase
        const blockContent = getBlockAndChildrenContentByUid(uid, i);

        // Skip if no content
        if (!blockContent) continue;

        // Check if the block contains highlighted words
        const hasHighlightedWords =
          blockContent.includes("^^") || blockContent.includes("🔊");

        if (!hasHighlightedWords) continue;

        // Create the Anki card for this word
        const success = await createAnkiCardFromBlock(blockContent);
        if (success) successfulCards++;
      }

      // Show a summary message
      if (successfulCards > 0) {
        AppToaster.show({
          message: `Successfully created ${successfulCards} Anki card${
            successfulCards > 1 ? "s" : ""
          }.`,
          intent: "success",
          timeout: 3000,
        });
      } else {
        AppToaster.show({
          message: "No Anki cards were created. Check your word entries.",
          intent: "warning",
          timeout: 3000,
        });
      }
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
