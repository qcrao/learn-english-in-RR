export const insertCompletion = async (
  prompt,
  targetUid,
  context,
  typeOfCompletion,
  instantModel,
  isRedone
) => {
  lastCompletion.prompt = prompt;
  lastCompletion.targetUid = targetUid;
  lastCompletion.context = context;
  lastCompletion.typeOfCompletion = typeOfCompletion;
  lastCompletion.instantModel = instantModel;

  let model = instantModel || defaultModel;
  if (model === "first OpenRouter model") {
    model = openRouterModels.length
      ? "openRouter/" + openRouterModels[0]
      : "gpt-3.5-turbo";
  } else if (model === "first Ollama local model") {
    model = ollamaModels.length ? "ollama/" + ollamaModels[0] : "gpt-3.5-turbo";
  }
  const responseFormat =
    typeOfCompletion === "gptPostProcessing" ? "json_object" : "text";
  const assistantRole = instantModel
    ? getInstantAssistantRole(instantModel)
    : chatRoles.assistant;

  let content;

  if (isRedone) content = context;
  else {
    content =
      assistantCharacter +
      // (responseFormat === "json_object" ? instructionsOnJSONResponse : "") +
      (context
        ? contextInstruction +
          userContextInstructions +
          "\nHere is the content to rely on:\n" +
          context
        : "");
    content = await verifyTokenLimitAndTruncate(model, prompt, content);
  }
  console.log("Context (eventually truncated):\n", content);

  if (isRedone && typeOfCompletion === "gptCompletion") {
    if (isExistingBlock(targetUid)) {
      targetUid = createSiblingBlock(targetUid, "before");
      window.roamAlphaAPI.updateBlock({
        block: {
          uid: targetUid,
          string: assistantRole,
        },
      });
    } else targetUid = await insertBlockInCurrentView(assistantRole);
  }
  const intervalId = await displaySpinner(targetUid);
  console.log("Prompt sent to AI assistant :>>\n", prompt);
  const aiResponse = await aiCompletion(
    model,
    prompt,
    context,
    responseFormat,
    targetUid
  );
  // console.log("aiResponse :>> ", aiResponse);
  removeSpinner(intervalId);
  if (typeOfCompletion === "gptPostProcessing" && Array.isArray(aiResponse)) {
    updateArrayOfBlocks(aiResponse);
  } else {
    const splittedResponse = splitParagraphs(aiResponse);
    if (!isResponseToSplit || splittedResponse.length === 1)
      addContentToBlock(targetUid, splittedResponse[0]);
    else {
      for (let i = 0; i < splittedResponse.length; i++) {
        createChildBlock(targetUid, splittedResponse[i]);
      }
    }
  }
};
