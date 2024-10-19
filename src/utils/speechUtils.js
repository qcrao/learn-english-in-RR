import { selectedVoiceName } from "../config";

export const speakText = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.8;

  // Get available voices
  const voices = speechSynthesis.getVoices();

  // if selectedVoiceName is not found, use Nicky
  // if (!selectedVoiceName) {
  //   selectedVoiceName = "Nicky";
  // }

  // Select the specified voice
  let selectedVoice = voices.find((voice) => voice.name === selectedVoiceName);

  // If the specified voice is found, use it
  if (!selectedVoice) {
    console.warn("Selected voice not found, using default voice");
    selectedVoice = voices[0]; // Use the first available voice as default
  }

  utterance.voice = selectedVoice;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
};
