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

export const loadRoamExtensionCommands = (extensionAPI) => {
  extensionAPI.ui.commandPalette.addCommand({
    label: "Extract new words: from current block, with highlight",
    callback: async () => {
      const { currentUid, currentBlockContent, _ } = getFocusAndSelection();

      if (!currentUid) return;

      let targetUid = await createChildBlock(currentUid, "");

      insertCompletion(
        motherLanguage,
        currentUid,
        systemPrompt,
        targetUid,
        currentBlockContent,
        "gptCompletion"
      );
    },
  });
};
