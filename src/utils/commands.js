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
      const { currentUid, currentBlockContent, selectionUids } =
        getFocusAndSelection();

      console.log("currentUid :>> ", currentUid);
      console.log("currentBlockContent :>> ", currentBlockContent);
      console.log("selectionUids :>> ", selectionUids);

      if (!currentUid && !selectionUids.length) return;

      let targetUid = currentUid
        ? await createChildBlock(currentUid, chatRoles.assistant)
        : await insertBlockInCurrentView(
            chatRoles.user + " a selection of blocks"
          );
          
      let prompt = currentBlockContent ? currentBlockContent : contextAsPrompt;
      console.log("currentBlockContent :>> ", currentBlockContent);
      const inlineContext = currentBlockContent
        ? getRoamContextFromPrompt(currentBlockContent)
        : null;
      if (inlineContext) prompt = inlineContext.updatedPrompt;
      console.log("inlineContext :>> ", inlineContext);
      let context = await getAndNormalizeContext(
        // currentUid && selectionUids.length ? null : currentUid,
        null,
        selectionUids,
        inlineContext?.roamContext,
        currentUid
      );
      insertCompletion(prompt, targetUid, context, "gptCompletion");
    },
  });
};
