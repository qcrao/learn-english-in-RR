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

// 修改后的 createChildBlock 函数，支持递归创建子块
export function createChildBlock(
  parentUid,
  content,
  order = "last",
  open = true
) {
  const uid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order: order },
    block: { string: content.trim(), uid: uid, open: open },
  });
  return uid;
}

// 新的处理多层级内容的函数
export function processContent(parentUid, content) {
  const lines = content.split("\n");
  const stack = [{ uid: parentUid, level: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indentLevel = line.search(/\S|$/);

    // 移除所有缩进级别高于当前行的项
    while (stack.length > 1 && stack[stack.length - 1].level >= indentLevel) {
      stack.pop();
    }

    // 创建新的块并将其添加到栈中
    const newUid = createChildBlock(stack[stack.length - 1].uid, line);
    stack.push({ uid: newUid, level: indentLevel });
  }
}
export const getRoamContextFromPrompt = (prompt) => {
  const elts = ["linkedRefs", "sidebar", "mainPage", "logPages"];
  const roamContext = {};
  let hasContext = false;
  const inlineCommand = getMatchingInlineCommand(prompt, contextRegex);
  if (!inlineCommand) return null;
  const { command, options } = inlineCommand;
  // console.log("options :>> ", options);
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
