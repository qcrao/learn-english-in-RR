import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import { AppToaster } from "../components/toaster";
import { motherLanguage } from "../config";
import { createChildBlock, getFocusAndSelection, getBlockAndChildrenContentByUid } from "./utils";
import { createAnkiCardFromBlock } from "./anki";

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

    const targetUid = createChildBlock(uid, "");
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
      const blockContent = getBlockAndChildrenContentByUid(uid);
      
      if (!blockContent) {
        AppToaster.show({
          message: "No content found in the selected block.",
          intent: "warning",
          timeout: 3000,
        });
        return;
      }
      
      const success = await createAnkiCardFromBlock(blockContent);
      
      if (success) {
        AppToaster.show({
          message: "Successfully sent to Anki!",
          intent: "success",
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
