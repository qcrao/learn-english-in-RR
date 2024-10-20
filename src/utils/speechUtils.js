import { selectedVoiceName } from "../config";

// Define the speak function that accepts a voice object and text
const speakWithVoice = (voice, text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = 0.8;

  console.log(
    `Voice: ${voice.name}, URI: ${voice.voiceURI}, Language: ${voice.lang}`
  );

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
};

export const speakText = (text) => {
  // Listen for voices to be loaded
  speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    let selectedVoice = voices.find(
      (voice) => voice.name === selectedVoiceName
    );

    if (!selectedVoice) {
      console.warn("Selected voice not found, using default voice");
      selectedVoice = voices[0]; // Use the first available voice as default
    }

    speakWithVoice(selectedVoice, text);
  };

  // Manually trigger voice loading check (needed for some browsers)
  if (speechSynthesis.getVoices().length !== 0) {
    const voices = speechSynthesis.getVoices();
    let selectedVoice = voices.find(
      (voice) => voice.name === selectedVoiceName
    );

    if (!selectedVoice) {
      console.warn("Selected voice not found, using default voice");
      selectedVoice = voices[0]; // Use the first available voice as default
    }

    speakWithVoice(selectedVoice, text);
  }
};
