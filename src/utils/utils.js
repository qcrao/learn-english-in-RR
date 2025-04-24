import { AppToaster } from "../components/toaster";

export const uidRegex = /\(\([^\)]{9}\)\)/g;
export const pageRegex = /\[\[.*\]\]/g; // very simplified, not recursive...
export const contextRegex = /\(\(context:.?([^\)]*)\)\)/;
export const templateRegex = /\(\(template:.?(\(\([^\)]{9}\)\))\)\)/;
export const dateStringRegex = /^[0-9]{2}-[0-9]{2}-[0-9]{4}$/;
export const numbersRegex = /\d+/g;
export const roamImageRegex = /!\[[^\]]*\]\((http[^\s)]+)\)/g;

export const getFocusAndSelection = () => {
  const currentUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];

  const selectionUids = getBlocksSelectionUids();
  const currentBlockContent = currentUid
    ? resolveReferences(getBlockContentByUid(currentUid))
    : "";
  return { currentUid, currentBlockContent, selectionUids };
};

export const getBlocksSelectionUids = (reverse) => {
  let selectedBlocksUids = [];
  let blueSelection = !reverse
    ? document.querySelectorAll(".block-highlight-blue")
    : document.querySelectorAll(".rm-block-main");
  let checkSelection = roamAlphaAPI.ui.individualMultiselect.getSelectedUids();
  if (blueSelection.length === 0) blueSelection = null;
  if (blueSelection) {
    blueSelection.forEach((node) => {
      let inputBlock = node.querySelector(".rm-block__input");
      if (!inputBlock) return;
      selectedBlocksUids.push(inputBlock.id.slice(-9));
    });
  } else if (checkSelection.length !== 0) {
    selectedBlocksUids = checkSelection;
  }
  return selectedBlocksUids;
};

export const resolveReferences = (content, refsArray = [], once = false) => {
  uidRegex.lastIndex = 0;
  if (uidRegex.test(content)) {
    uidRegex.lastIndex = 0;
    let matches = content.matchAll(uidRegex);
    for (const match of matches) {
      let refUid = match[0].slice(2, -2);
      // prevent infinite loop !
      let isNewRef = !refsArray.includes(refUid);
      refsArray.push(refUid);
      let resolvedRef = getBlockContentByUid(refUid);
      uidRegex.lastIndex = 0;
      if (uidRegex.test(resolvedRef) && isNewRef && !once)
        resolvedRef = resolveReferences(resolvedRef, refsArray);
      content = content.replace(match, resolvedRef);
    }
  }
  return content;
};

export function getBlockContentByUid(uid) {
  let result = window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid]);
  if (result) return result[":block/string"];
  else return "";
}

export function getBlockAndChildrenContentByUid(uid, cardIndex = 0) {
  console.log(`Getting content for card index ${cardIndex} from block ${uid}`);

  const blockContent = getBlockContentByUid(uid);

  // Get all top-level child blocks (each representing a word/phrase)
  const topLevelChildren = window.roamAlphaAPI.q(`
    [:find (pull ?block [:block/string :block/uid :block/order])
     :where 
     [?parent :block/uid "${uid}"]
     [?parent :block/children ?block]]
  `);

  // If no children, just return the parent content
  if (!topLevelChildren || topLevelChildren.length === 0) {
    console.log("No children found in block");
    return blockContent || "";
  }

  // Sort top-level children by order
  const sortedTopChildren = topLevelChildren.sort(
    (a, b) => a[0].order - b[0].order
  );
  console.log(`Found ${sortedTopChildren.length} top-level children`);

  // Check if the requested card index exists
  if (cardIndex >= sortedTopChildren.length) {
    console.log(
      `Card index ${cardIndex} out of range (max: ${
        sortedTopChildren.length - 1
      })`
    );
    // If asking for a non-existent card, return empty
    return "";
  }

  // Get the card we want to process
  const currentCard = sortedTopChildren[cardIndex];
  const cardUid = currentCard[0].uid;
  const cardContent = currentCard[0].string;
  console.log(
    `Processing card ${cardIndex}: ${cardContent.substring(0, 30)}...`
  );

  // For Anki cards, we need to include the highlighted word in the context
  // Check if the word is already highlighted in the parent content
  let contextWithHighlight = blockContent || "";

  // Extract the word from the card content, handling highlighted words properly
  let wordToHighlight = "";
  const highlightMatch = cardContent.match(/\^\^([^^]+?)\^\^/);

  if (highlightMatch) {
    // If the word is already highlighted, use that
    wordToHighlight = highlightMatch[1].trim();
    console.log(`Found highlighted word in card content: ${wordToHighlight}`);
  } else {
    // Otherwise use the first word as a fallback
    wordToHighlight = cardContent.trim().split(/\s+/)[0];
    console.log(`Using first word as fallback: ${wordToHighlight}`);
  }

  // Create a unique identifier for this card to avoid duplicates
  // Use a simpler format without underscores in the word for better readability in logs
  const cardId = `${uid}_${cardIndex}_${wordToHighlight}`;
  console.log(`Card ID: ${cardId}`);

  // If the word is not already highlighted in the context, add the highlight
  if (
    wordToHighlight &&
    !contextWithHighlight.includes(`^^${wordToHighlight}^^`) &&
    !contextWithHighlight.includes(`${wordToHighlight} 🔊`)
  ) {
    // Try to find and highlight the word in the context
    if (contextWithHighlight.includes(wordToHighlight)) {
      contextWithHighlight = contextWithHighlight.replace(
        new RegExp(`\\b${wordToHighlight}\\b`, "g"),
        `^^${wordToHighlight}^^`
      );
      console.log(`Highlighted word '${wordToHighlight}' in context`);
    }
  }

  // Start building card content with the context
  let singleCardContent = contextWithHighlight;

  // Add the word entry line
  singleCardContent += "\n- " + cardContent;

  // Get all second-level blocks for this card
  const secondLevelBlocks = window.roamAlphaAPI.q(`
    [:find (pull ?block [:block/string :block/uid :block/order])
     :where 
     [?parent :block/uid "${cardUid}"]
     [?parent :block/children ?block]]
  `);

  if (secondLevelBlocks && secondLevelBlocks.length > 0) {
    console.log(
      `Found ${secondLevelBlocks.length} second-level blocks for the card`
    );

    // Sort second-level blocks
    const sortedSecondLevel = secondLevelBlocks.sort(
      (a, b) => a[0].order - b[0].order
    );

    // Process each second-level block
    sortedSecondLevel.forEach((block) => {
      const blockUid = block[0].uid;
      const blockString = block[0].string;

      // Add the second-level block content
      singleCardContent += "\n  - " + blockString;

      // If this is an "Examples" block, we need to include its children as well
      if (blockString.includes("Examples")) {
        const examplesContent = getNestedChildrenContent(blockUid, 3);
        if (examplesContent) {
          singleCardContent += examplesContent;
        }
      }
      // For other blocks that might have children, like Synonyms or Antonyms
      else if (
        blockString.includes("Synonyms") ||
        blockString.includes("Antonyms") ||
        blockString.includes("Etymology") ||
        blockString.includes("Usage Notes")
      ) {
        const nestedContent = getNestedChildrenContent(blockUid, 3);
        if (nestedContent) {
          singleCardContent += nestedContent;
        }
      }
    });
  }

  console.log(`Finished compiling content for card ${cardIndex}`);
  return singleCardContent;
}

function getNestedChildrenContent(parentUid, depth) {
  let content = "";
  const children = window.roamAlphaAPI.q(`
    [:find (pull ?block [:block/string :block/uid :block/order])
     :where 
     [?parent :block/uid "${parentUid}"]
     [?parent :block/children ?block]]
  `);

  if (children && children.length > 0) {
    // Sort children by order
    const sortedChildren = children.sort((a, b) => a[0].order - b[0].order);

    // Add children content with indentation
    sortedChildren.forEach((child) => {
      const childUid = child[0].uid;
      const childContent = child[0].string;

      // Include all nested content for proper parsing
      content += "\n" + "  ".repeat(depth) + "- " + childContent;

      // Recursively get nested children with increased depth
      const nestedContent = getNestedChildrenContent(childUid, depth + 1);
      if (nestedContent) {
        content += nestedContent;
      }
    });
  }

  return content;
}

// export function createChildBlock(
//   parentUid,
//   content = "",
//   order = "last",
//   open = true
// ) {
//   const uid = window.roamAlphaAPI.util.generateUID();
//   window.roamAlphaAPI.createBlock({
//     location: { "parent-uid": parentUid, order: order },
//     block: { string: content, uid: uid, open: open },
//   });
//   return uid;
// }

/**
 * Block expansion and visibility utilities for Roam blocks
 */

/**
 * Waits for a specific delay using Promise
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find and retrieve a DOM element for a Roam block with a specific UID
 * @param {string} uid - The block UID to find
 * @param {number} maxAttempts - Maximum number of attempts (default: 5)
 * @param {number} baseDelay - Base delay in ms between attempts (default: 100)
 * @returns {Promise<Element|null>} - The found DOM element or null
 */
export async function findBlockElement(uid, maxAttempts = 5, baseDelay = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const element = document.querySelector(`[id*="${uid}"]`);
    if (element) return element;

    // Wait with exponential backoff
    await delay(baseDelay * Math.pow(2, attempt));
  }

  console.error(
    `Could not find DOM element for block with UID ${uid} after ${maxAttempts} attempts`
  );
  return null;
}

/**
 * Force expand a block in the UI by simulating a user click on the caret
 * @param {string} uid - The block UID to expand
 */
export function forceExpandBlockInUI(uid) {
  setTimeout(async () => {
    try {
      // Find the block element
      const blockElement = await findBlockElement(uid);
      if (!blockElement) return;

      // Find the closest parent with the rm-block class
      const blockContainer = blockElement.closest(".rm-block");
      if (!blockContainer) {
        console.log(`Block container for ${uid} not found`);
        return;
      }

      // Check if the block is already expanded by looking for visible children
      const childrenContainer = blockContainer.querySelector(
        ".rm-block__children"
      );
      const isCollapsed =
        childrenContainer &&
        (childrenContainer.style.display === "none" ||
          !childrenContainer.querySelector(".rm-block"));

      if (isCollapsed) {
        // Find the expand/collapse button
        const expandButton = blockContainer.querySelector(".rm-caret");
        if (expandButton) {
          // Simulate a click to expand
          expandButton.click();
          console.log(`Expanded block ${uid} by simulating UI click`);
        } else {
          console.log(`Expand button for block ${uid} not found`);
        }
      } else {
        console.log(`Block ${uid} is already expanded or has no children`);
      }
    } catch (e) {
      console.log(`Error force-expanding block ${uid}:`, e);
    }
  }, 200); // Wait for the DOM to be updated
}

/**
 * Create a child block under a parent block in Roam
 * @param {string} parentUid - The parent block's UID
 * @param {string} content - Content for the new block
 * @param {string|number} order - Order of the new block ("last", "first", or a number)
 * @param {boolean} open - Whether the new block should be open/expanded
 * @returns {string} - The UID of the newly created block
 */
export function createChildBlock(
  parentUid,
  content,
  order = "last",
  open = false
) {
  // Generate a new UID for the block
  const uid = window.roamAlphaAPI.util.generateUID();

  // First ensure the parent block is open using the API
  window.roamAlphaAPI.updateBlock({
    block: { uid: parentUid, open: open },
  });

  // Create the new block with trimmed content
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order: order },
    block: { string: content.trim(), uid: uid, open: open },
  });

  return uid;
}

export function stripBackticks(text) {
  return text ? text.replace(/`/g, "").trim() : "";
}

export function ensureBackticks(text) {
  const stripped = stripBackticks(text);
  return stripped ? `\`${stripped}\`` : "";
}

export function processContent(parentUid, content) {
  if (!content) return;

  let data;
  try {
    // Remove any leading/trailing whitespace and potential Markdown code block markers
    const jsonContent = content.replace(/^```json\s*|\s*```$/g, "").trim();
    data = JSON.parse(jsonContent);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    console.log("Problematic content:", content);
    AppToaster.show({
      message: "Error parsing JSON content. Please check the format.",
      intent: "danger",
      timeout: 5000,
    });
    return;
  }

  if (!data.words || !Array.isArray(data.words)) {
    console.error("Invalid data structure: 'words' array not found");
    AppToaster.show({
      message: "Invalid data structure: 'words' array not found",
      intent: "danger",
      timeout: 5000,
    });
    return;
  }

  data.words.forEach((word) => {
    // Create the top-level block with basic information
    const { basic } = word;
    const basicInfo = `${basic.word} ${ensureBackticks(
      basic.phonetic
    )} ${ensureBackticks(basic.partOfSpeech)} ${ensureBackticks(
      basic.motherLanguageTranslation
    )} ${word.tags.map((tag) => `#${tag}`).join(" ")}`;
    const topLevelUid = createChildBlock(parentUid, basicInfo, "last", true);

    // Create a child block for the definition
    createChildBlock(topLevelUid, `**Definition**: ${word.definition}`);

    // Create nested blocks for examples, synonyms, and antonyms
    const nestedProperties = [
      { key: "Examples", items: word.examples.map((e, i) => `${i + 1}. ${e}`) },
      {
        key: "Synonyms",
        items: word.synonyms.map(
          (s, i) =>
            `^^${s.word}^^ ${ensureBackticks(s.phonetic)} ${ensureBackticks(
              s.partOfSpeech
            )} ${ensureBackticks(s.motherLanguageTranslation)}`
        ),
      },
      {
        key: "Antonyms",
        items: word.antonyms.map(
          (a, i) =>
            `^^${a.word}^^ ${ensureBackticks(a.phonetic)} ${ensureBackticks(
              a.partOfSpeech
            )} ${ensureBackticks(a.motherLanguageTranslation)}`
        ),
      },
    ];

    nestedProperties.forEach((prop) => {
      const propUid = createChildBlock(topLevelUid, `**${prop.key}**`);
      prop.items.forEach((item) => {
        createChildBlock(propUid, item);
      });
    });

    // Create child blocks for other properties
    const childProperties = [
      { key: "Etymology", value: word.etymology },
      { key: "Usage Notes", value: word.usageNotes },
    ];

    childProperties.forEach((prop) => {
      createChildBlock(topLevelUid, `**${prop.key}**: ${prop.value}`);
    });
  });
}

export const getRoamContextFromPrompt = (prompt) => {
  const elts = ["linkedRefs", "sidebar", "mainPage", "logPages"];
  const roamContext = {};
  let hasContext = false;
  const inlineCommand = getMatchingInlineCommand(prompt, contextRegex);
  if (!inlineCommand) return null;
  const { command, options } = inlineCommand;
  elts.forEach((elt) => {
    if (options.includes(elt)) {
      roamContext[elt] = true;
      if (elt === "logPages") {
        if (options.includes("logPages(")) {
          let nbOfDays = prompt.split("logPages(")[1].split(")")[0];
          if (!isNaN(nbOfDays)) roamContext.logPagesNb = Number(nbOfDays);
        }
      }
      hasContext = true;
    }
  });
  if (hasContext)
    return {
      roamContext: roamContext,
      updatedPrompt: prompt.replace(command, "").trim(),
    };
  AppToaster.show({
    message:
      "Valid options for ((context: )) command: mainPage, linkedRefs, sidebar, logPages. " +
      "For the last one, you can precise the number of days, eg.: logPages(30)",
    timeout: 0,
  });
  return null;
};

export const getAndNormalizeContext = async (
  startBlock,
  blocksSelectionUids,
  roamContext,
  focusedBlock,
  model = defaultModel
) => {
  let context = "";
  if (blocksSelectionUids && blocksSelectionUids.length > 0)
    context = getResolvedContentFromBlocks(blocksSelectionUids);
  else if (startBlock)
    context = resolveReferences(getBlockContentByUid(startBlock));
  else if (isMobileViewContext && window.innerWidth < 500)
    context = getResolvedContentFromBlocks(
      getBlocksSelectionUids(true).slice(0, -1)
    );
  if (roamContext) {
    if (roamContext.mainPage) {
      highlightHtmlElt(".roam-article > div:first-child");
      const viewUid =
        await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
      context += getFlattenedContentFromTree(viewUid);
    }
    if (roamContext.linkedRefs) {
      highlightHtmlElt(".rm-reference-main");
      const pageUid = await getMainPageUid();
      context += getFlattenedContentFromLinkedReferences(pageUid);
    }
    if (roamContext.logPages) {
      let startDate;
      if (isLogView()) {
        if (focusedBlock) {
          startDate = new Date(getPageUidByBlockUid(focusedBlock));
        }
        highlightHtmlElt(".roam-log-container");
      } else if (isCurrentPageDNP()) {
        startDate = new Date(await getMainPageUid());
        highlightHtmlElt(".rm-title-display");
      }
      context += getFlattenedContentFromLog(
        roamContext.logPagesNb || logPagesNbDefault,
        startDate,
        model
      );
    }
    if (roamContext.sidebar) {
      highlightHtmlElt("#roam-right-sidebar-content");
      context += getFlattenedContentFromSidebar();
    }
  }

  return context;
};

export async function insertBlockInCurrentView(content, order) {
  let zoomUid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  // If not on a given page, but in Daily Log
  if (!zoomUid) {
    zoomUid = window.roamAlphaAPI.util.dateToPageUid(new Date());
    // TODO : send a message "Added on DNP page"
  }
  const newUid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.createBlock({
    location: {
      "parent-uid": zoomUid,
      order: order === "first" || order === 0 ? 0 : "last",
    },
    block: {
      string: content,
      uid: newUid,
    },
  });
  return newUid;
}

export function isExistingBlock(uid) {
  let result = window.roamAlphaAPI.pull("[:block/uid]", [":block/uid", uid]);
  if (result) return true;
  return false;
}

export function createSiblingBlock(currentUid, position) {
  const currentOrder = getBlockOrderByUid(currentUid);
  const parentUid = getParentBlock(currentUid);
  const siblingUid = createChildBlock(
    parentUid,
    "",
    position === "before" ? currentOrder : currentOrder + 1
  );
  return siblingUid;
}

export function updateArrayOfBlocks(arrayOfBlocks) {
  if (arrayOfBlocks.length) {
    arrayOfBlocks.forEach((block) =>
      window.roamAlphaAPI.updateBlock({
        block: {
          uid: block.uid.replaceAll("(", "").replaceAll(")", "").trim(),
          string: block.content,
        },
      })
    );
  }
}

export function addContentToBlock(uid, contentToAdd) {
  const currentContent = getBlockContentByUid(uid).trimEnd();
  // currentContent += currentContent ? " " : "";
  window.roamAlphaAPI.updateBlock({
    block: {
      uid: uid,
      string: (currentContent ? currentContent + " " : "") + contentToAdd,
    },
  });
}
