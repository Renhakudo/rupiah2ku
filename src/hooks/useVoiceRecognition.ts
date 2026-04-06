import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceRecognitionProps {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
  lang?: string;
}

export const useVoiceRecognition = ({ onResult, onError, lang = 'id-ID' }: UseVoiceRecognitionProps) => {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = lang;

        recognition.onresult = (event: any) => {
          const finalTranscript = event.results[0][0].transcript;
          onResult(finalTranscript);
        };

        recognition.onerror = (event: any) => {
          setIsListening(false);
          if (onError) onError(event.error);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setIsSupported(false);
      }
    }
  }, [lang, onResult, onError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening
  };
};
