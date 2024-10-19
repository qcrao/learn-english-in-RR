import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import {
  createChildBlock,
  getAndNormalizeContext,
  getFocusAndSelection,
  getRoamContextFromPrompt,
  insertBlockInCurrentView,
} from "./utils";

export const loadRoamExtensionCommands = (extensionAPI) => {
  console.log("loadRoamExtensionCommands");

  extensionAPI.ui.commandPalette.addCommand({
    label: "Extract new words: from current block, with highlight",
    callback: async () => {
      const { currentUid, currentBlockContent, _ } = getFocusAndSelection();

      console.log("currentUid :>> ", currentUid);
      console.log("currentBlockContent :>> ", currentBlockContent);

      if (!currentUid) return;

      let targetUid = await createChildBlock(currentUid, "");
      // let targetUid = currentUid;

      // get system prompt from system-prompt.txt
      console.log("systemPrompt :>> ", systemPrompt);

      insertCompletion(
        targetUid,
        systemPrompt,
        targetUid,
        currentBlockContent,
        "gptCompletion"
      );
    },
  });
};
