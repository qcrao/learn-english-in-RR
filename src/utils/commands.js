import { systemPrompt } from "../../systemPrompt";
import { insertCompletion } from "../ai/commands";
import { AppToaster } from "../components/toaster";
import { motherLanguage, ankiDeckName } from "../config";
import {
  createChildBlock,
  getFocusAndSelection,
  getBlockAndChildrenContentByUid,
  forceExpandBlockInUI,
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
    forceExpandBlockInUI(uid);

    console.log("createChildBlock targetUid: ", targetUid);

    insertCompletion(
      motherLanguage,
      uid,
      systemPrompt,
      targetUid,
      blockContent,
    );
  };

  // Add the send to Anki function
  const sendToAnki = async (uid) => {
    // Create a processing lock to prevent multiple executions
    if (window._ankiProcessingLock) {
      console.log("Anki processing already in progress, please wait...");
      AppToaster.show({
        message: "Anki processing already in progress, please wait...",
        intent: "warning",
        timeout: 2000,
      });
      return;
    }

    try {
      // Set processing lock
      window._ankiProcessingLock = true;

      // Reset the card creation cache if this is a new block
      if (
        !window._lastProcessedBlockUid ||
        window._lastProcessedBlockUid !== uid
      ) {
        console.log("New block detected, resetting card cache");
        window._createdAnkiCards = new Set();
        window._lastProcessedBlockUid = uid;
      }

      console.log(`Processing block ${uid} for Anki cards`);

      // First, get the total number of top-level children (words)
      const topLevelChildren = window.roamAlphaAPI.q(`
        [:find (pull ?block [:block/string :block/uid])
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
      let failedCards = 0;
      let skippedCards = 0;
      const totalCards = topLevelChildren.length;

      console.log(`Processing ${totalCards} cards from block ${uid}`);

      // Process each top-level child (word) one by one
      for (let i = 0; i < totalCards; i++) {
        try {
          // Get the word content from the current child's text
          const wordText = topLevelChildren[i][0].string || "Unknown word";
          const wordPreview =
            wordText.length > 30 ? wordText.substring(0, 30) + "..." : wordText;

          // Create a card ID for tracking
          const wordId = wordText
            .trim()
            .replace(/\^\^|\s+/g, "_")
            .substring(0, 30);
          const cardTime = Date.now(); // Add timestamp to ensure uniqueness
          const cardId = `${uid}_${i}_${wordId}_${cardTime}`;

          // Extract word to better identify the card
          let wordToTrack = "unknown";
          const highlightMatch = wordText.match(/\^\^([^^]+?)\^\^/);
          if (highlightMatch) {
            wordToTrack = highlightMatch[1].trim();
          } else {
            const firstWord = wordText.trim().split(/\s+/)[0];
            if (firstWord) {
              wordToTrack = firstWord;
            }
          }

          // Simplified ID for tracking (without timestamp)
          const trackingId = `${uid}_${i}_${wordToTrack}_${cardTime}`;
          console.log(`Tracking ID for this card: ${trackingId}`);

          // Skip if we've already processed this card in this session
          let alreadyProcessed = false;

          if (window._createdAnkiCards) {
            // Check existing cards with the same tracking ID
            for (const existingId of window._createdAnkiCards) {
              if (existingId.includes(trackingId)) {
                alreadyProcessed = true;
                console.log(`Matched existing card with ID: ${existingId}`);
                break;
              }
            }
          }

          if (alreadyProcessed) {
            console.log(
              `Card ${i + 1}/${totalCards} already processed: ${wordPreview}`
            );
            skippedCards++;
            continue;
          }

          console.log(`Processing card ${i + 1}/${totalCards}: ${wordPreview}`);

          // Get the content for the current word/phrase
          const blockContent = getBlockAndChildrenContentByUid(uid, i);

          // Skip if no content
          if (!blockContent) {
            console.log(`Skipping card ${i + 1}: No content`);
            failedCards++;
            continue;
          }

          // Check if the block contains highlighted words
          const hasHighlightedWords =
            blockContent.includes("^^") || blockContent.includes("🔊");

          if (!hasHighlightedWords) {
            console.log(`Skipping card ${i + 1}: No highlighted words`);
            failedCards++;
            continue;
          }

          // Create the Anki card for this word
          const result = await createAnkiCardFromBlock(blockContent);

          if (result.success) {
            console.log(`Card ${i + 1} created successfully: ${result.message}`);
            // Track successful cards by ID - store the tracking ID instead of the full ID
            if (!window._createdAnkiCards) window._createdAnkiCards = new Set();
            window._createdAnkiCards.add(trackingId);
            successfulCards++;
          } else {
            // Check if it's a duplicate card
            if (result.message.includes("duplicate")) {
              console.log(`Card ${i + 1} is a duplicate`);
              skippedCards++;
            } else {
              console.log(`Card ${i + 1} creation failed: ${result.message}`);
              failedCards++;
            }
          }
        } catch (cardError) {
          console.error(`Error processing card ${i + 1}:`, cardError);
          failedCards++;
        }
      }

      // Show a summary message
      if (successfulCards > 0) {
        let message = `Created ${successfulCards} of ${totalCards} Anki cards.`;
        if (failedCards > 0) message += ` ${failedCards} failed.`;
        if (skippedCards > 0)
          message += ` ${skippedCards} skipped (already processed).`;

        AppToaster.show({
          message: message,
          intent: "success",
          timeout: 3000,
        });
      } else if (skippedCards > 0) {
        AppToaster.show({
          message: `No new cards created. ${skippedCards} cards were already processed.`,
          intent: "warning",
          timeout: 3000,
        });
      } else {
        AppToaster.show({
          message:
            "No Anki cards were created.",
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
    } finally {
      // Always release the lock
      window._ankiProcessingLock = false;
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
