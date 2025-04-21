export const displaySpinner = async (targetUid) => {
  // Create a promise that will resolve with the interval ID
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 5;
    let intervalId = null;
    
    const attemptDisplaySpinner = () => {
      const targetBlockElt = document.querySelector(`[id*="${targetUid}"]`);
      
      if (targetBlockElt) {
        // Found the element, create the spinner
        const previousSpinner = targetBlockElt.querySelector(".speech-spinner");
        if (previousSpinner) previousSpinner.remove();
        
        const spinner = document.createElement("strong");
        spinner.classList.add("speech-spinner");
        targetBlockElt.appendChild(spinner);
        
        intervalId = setInterval(() => {
          updateSpinnerText(spinner, [" .", " ..", " ...", " "]);
        }, 600);
        
        resolve(intervalId);
      } else if (attempts < maxAttempts) {
        // Try again with exponential backoff
        attempts++;
        const waitTime = 150 * Math.pow(2, attempts - 1);
        setTimeout(attemptDisplaySpinner, waitTime);
      } else {
        // Give up after maximum attempts
        console.error(`Could not find DOM element for block with UID ${targetUid} after ${maxAttempts} attempts`);
        resolve(null); // Resolve with null to indicate failure
      }
    };
    
    // Start the first attempt after a short delay
    setTimeout(attemptDisplaySpinner, 100);
  });
  
  function updateSpinnerText(container, frames) {
    const currentIndex = frames.indexOf(container.innerText);
    const nextIndex = currentIndex + 1 < frames.length ? currentIndex + 1 : 0;
    container.innerText = frames[nextIndex];
  }
};

export const removeSpinner = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  // Try to find and remove any spinners
  const spinners = document.querySelectorAll(".speech-spinner");
  spinners.forEach(spinner => {
    if (spinner) spinner.remove();
  });
};

export const insertParagraphForStream = (targetUid) => {
  console.log("in insertParagraphForStream targetUid: ", targetUid);
  
  // Retry mechanism to find the element if it's not available immediately
  const findTargetElement = (uid, retries = 5, interval = 100) => {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const attemptFind = () => {
        const element = document.querySelector(`[id*="${uid}"]`);
        if (element || attempts >= retries) {
          resolve(element);
        } else {
          attempts++;
          setTimeout(attemptFind, interval);
        }
      };
      
      attemptFind();
    });
  };
  
  // Use the retry mechanism and handle the result
  findTargetElement(targetUid).then(targetBlockElt => {
    console.log("targetBlockElt: ", targetBlockElt);
    
    if (!targetBlockElt) {
      console.error(`Could not find DOM element for block with UID ${targetUid} after multiple attempts`);
      return null;
    }
    
    const previousStreamElt = targetBlockElt.querySelector(".speech-stream");
    if (previousStreamElt) previousStreamElt.remove();
    
    const streamElt = document.createElement("p");
    streamElt.classList.add("speech-stream");
    targetBlockElt.appendChild(streamElt);
    displaySpinner(targetUid);
    return streamElt;
  });
  
  // Return a placeholder element that will be replaced once the actual element is found
  const placeholder = document.createElement("p");
  placeholder.classList.add("speech-stream", "placeholder");
  return placeholder;
};
