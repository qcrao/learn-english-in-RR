import { selectedVoiceName } from "../config";

// Define the speak function that accepts a voice object and text
const speakWithVoice = (voice, text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = 0.8;
  utterance.volume = 1; // 确保音量设置为最大

  console.log(`Voice: ${voice.name}, URI: ${voice.voiceURI}, Language: ${voice.lang}`);

  // 添加错误处理
  utterance.onerror = (event) => {
    console.error('SpeechSynthesisUtterance error:', event);
  };

  // 添加开始和结束事件的日志
  utterance.onstart = () => console.log('Speech started');
  utterance.onend = () => console.log('Speech ended');

  speechSynthesis.cancel(); // 取消任何正在进行的语音
  setTimeout(() => {
    speechSynthesis.speak(utterance);
  }, 100); // 短暂延迟后开始说话
};

export const speakText = (text) => {
  const speakWithAvailableVoices = () => {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => v.name));
    
    let selectedVoice = voices.find((voice) => voice.name === selectedVoiceName);

    if (!selectedVoice) {
      console.warn("Selected voice not found, using default voice");
      selectedVoice = voices[0]; // Use the first available voice as default
    }

    if (selectedVoice) {
      speakWithVoice(selectedVoice, text);
    } else {
      console.error('No voices available');
    }
  };

  // 如果voices已经可用，直接使用
  if (speechSynthesis.getVoices().length !== 0) {
    speakWithAvailableVoices();
  } else {
    // 否则，等待voices加载完成
    speechSynthesis.onvoiceschanged = speakWithAvailableVoices;
  }
};

// 添加一个测试函数
export const testSpeech = () => {
  speakText("This is a test. Can you hear me?");
};
