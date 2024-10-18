export const displaySpinner = async (targetUid) => {
  let targetBlockElt, spinner, intervalId;
  setTimeout(() => {
    targetBlockElt = document.querySelector(`[id*="${targetUid}"]`);
    const previousSpinner = targetBlockElt.querySelector(".speech-spinner");
    if (previousSpinner) previousSpinner.remove();
    spinner = document.createElement("strong");
    spinner.classList.add("speech-spinner");
    if (targetBlockElt) targetBlockElt.appendChild(spinner);
    intervalId = setInterval(() => {
      updateSpinnerText(spinner, [" .", " ..", " ...", " "]);
    }, 600);
  }, 100);
  return intervalId;

  function updateSpinnerText(container, frames) {
    const currentIndex = frames.indexOf(container.innerText);
    const nextIndex = currentIndex + 1 < frames.length ? currentIndex + 1 : 0;
    container.innerText = frames[nextIndex];
  }
};

export const removeSpinner = (intervalId) => {
  clearInterval(intervalId);
  const spinner = document.querySelector(".speech-spinner");
  if (spinner) spinner.remove();
};
