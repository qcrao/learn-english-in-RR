import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import { AppToaster } from "../components/toaster";
import { motherLanguage } from "../config";
import { createChildBlock, getFocusAndSelection } from "./utils";

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
    const targetUid = createChildBlock(uid, "");
    insertCompletion(
      motherLanguage,
      uid,
      systemPrompt,
      targetUid,
      blockContent
    );
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

  // Add the context menu item
  const CONTEXT_MENU_COMMAND_LABEL = "Extract new words";
  const commandCallback = (e) => {
    const uid = e.target.closest(".rm-block__input").id.slice(-9);
    const blockContent = e.target.closest(".rm-block__input").textContent;
    extractNewWords(uid, blockContent);
  };

  await window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: CONTEXT_MENU_COMMAND_LABEL,
    callback: commandCallback,
  });
};
