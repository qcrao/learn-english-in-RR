import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import { motherLanguage } from "../config";
import {
  createChildBlock,
  getAndNormalizeContext,
  getFocusAndSelection,
  getRoamContextFromPrompt,
  insertBlockInCurrentView,
} from "./utils";

export const loadRoamExtensionCommands = async (extensionAPI) => {
  const extractNewWords = (uid, blockContent) => {
    createChildBlock(uid, "").then((targetUid) => {
      insertCompletion(
        motherLanguage,
        uid,
        systemPrompt,
        targetUid,
        blockContent,
        "gptCompletion"
      );
    });
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
