import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./FarmerVoice.css";

import {
  Volume2,
  Pause,
  Play,
  Square,
  Languages,
  AlertTriangle,
} from "lucide-react";


const LANGUAGES = {
  English: {
    code: "en-IN",
    label: "English",
    aliases: [
      "en-IN",
      "en-US",
      "en-GB",
      "en-AU",
    ],
  },

  Tamil: {
    code: "ta-IN",
    label: "தமிழ்",
    aliases: [
      "ta-IN",
      "ta",
    ],
  },

  Hindi: {
    code: "hi-IN",
    label: "हिन्दी",
    aliases: [
      "hi-IN",
      "hi",
    ],
  },
};


/* ============================================================
   CLEAN ADVISORY FOR SPEECH
============================================================ */

function cleanSpeechText(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}


/* ============================================================
   VOICE MATCHING
============================================================ */

function getMatchingVoice(
  voices,
  languageConfig,
) {
  if (!voices?.length) {
    return null;
  }


  const aliases =
    languageConfig.aliases.map(
      (value) =>
        value.toLowerCase(),
    );


  /*
   * First: exact requested locale.
   */
  const exact =
    voices.find(
      (voice) =>
        aliases.includes(
          String(
            voice.lang || "",
          ).toLowerCase(),
        ),
    );


  if (exact) {
    return exact;
  }


  /*
   * Second: same base language.
   */
  const baseLanguage =
    languageConfig.code
      .split("-")[0]
      .toLowerCase();


  return (
    voices.find((voice) => {
      const voiceLanguage =
        String(
          voice.lang || "",
        )
          .toLowerCase()
          .split("-")[0];

      return (
        voiceLanguage ===
        baseLanguage
      );
    }) || null
  );
}


/* ============================================================
   COMPONENT
============================================================ */

export default function FarmerVoice({
  advisory = "",
  language = "English",
  onLanguageChange,
  compact = false,
}) {
  const [speaking, setSpeaking] =
    useState(false);

  const [paused, setPaused] =
    useState(false);

  const [voices, setVoices] =
    useState([]);

  const utteranceRef =
    useRef(null);


  const selectedLanguage =
    LANGUAGES[language] ||
    LANGUAGES.English;


  const speechText =
    useMemo(
      () =>
        cleanSpeechText(
          advisory,
        ),
      [advisory],
    );


  const selectedVoice =
    useMemo(
      () =>
        getMatchingVoice(
          voices,
          selectedLanguage,
        ),
      [
        voices,
        selectedLanguage,
      ],
    );


  const speechSupported =
    typeof window !==
      "undefined" &&
    "speechSynthesis" in
      window &&
    typeof window
      .SpeechSynthesisUtterance !==
      "undefined";


  function refreshVoices() {
    if (!speechSupported) {
      setVoices([]);
      return;
    }


    const available =
      window.speechSynthesis
        .getVoices();


    setVoices(
      Array.isArray(
        available,
      )
        ? available
        : [],
    );
  }


  /* ==========================================================
     LOAD BROWSER VOICES
  ========================================================== */

  useEffect(() => {
    if (!speechSupported) {
      return undefined;
    }


    refreshVoices();


    const timer =
      window.setTimeout(
        refreshVoices,
        500,
      );


    const handleVoicesChanged =
      () => {
        refreshVoices();
      };


    window.speechSynthesis
      .addEventListener(
        "voiceschanged",
        handleVoicesChanged,
      );


    return () => {
      window.clearTimeout(
        timer,
      );

      window.speechSynthesis
        .removeEventListener(
          "voiceschanged",
          handleVoicesChanged,
        );

      window.speechSynthesis.cancel();
    };
  }, [language]);


  /* ==========================================================
     STOP WHEN ADVISORY / LANGUAGE CHANGES
  ========================================================== */

  useEffect(() => {
    if (!speechSupported) {
      return;
    }

    window.speechSynthesis.cancel();

    setSpeaking(false);
    setPaused(false);

    utteranceRef.current =
      null;
  }, [
    language,
    advisory,
  ]);


  /* ==========================================================
     PLAY
  ========================================================== */

  const handlePlay = () => {
    if (
      !speechSupported ||
      !speechText
    ) {
      return;
    }


    window.speechSynthesis.cancel();


    const utterance =
      new window.SpeechSynthesisUtterance(
        speechText,
      );


    /*
     * If Windows has the requested
     * language voice, use it.
     *
     * Otherwise tell the browser
     * the requested language and
     * let its speech engine decide.
     */
    if (selectedVoice) {
      utterance.voice =
        selectedVoice;

      utterance.lang =
        selectedVoice.lang ||
        selectedLanguage.code;
    } else {
      utterance.lang =
        selectedLanguage.code;
    }


    utterance.rate = 0.90;
    utterance.pitch = 1;
    utterance.volume = 1;


    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
    };


    utterance.onpause = () => {
      setPaused(true);
    };


    utterance.onresume = () => {
      setPaused(false);
    };


    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current =
        null;
    };


    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current =
        null;
    };


    utteranceRef.current =
      utterance;


    window.speechSynthesis.speak(
      utterance,
    );
  };


  /* ==========================================================
     PAUSE
  ========================================================== */

  const handlePause = () => {
    if (
      !speechSupported
    ) {
      return;
    }


    if (
      speaking &&
      !paused &&
      window.speechSynthesis
        .speaking
    ) {
      window.speechSynthesis.pause();

      setPaused(true);
    }
  };


  /* ==========================================================
     RESUME
  ========================================================== */

  const handleResume = () => {
    if (
      !speechSupported
    ) {
      return;
    }


    if (
      speaking &&
      paused &&
      window.speechSynthesis
        .paused
    ) {
      window.speechSynthesis.resume();

      setPaused(false);
    }
  };


  /* ==========================================================
     STOP
  ========================================================== */

  const handleStop = () => {
    if (
      !speechSupported
    ) {
      return;
    }


    window.speechSynthesis.cancel();

    setSpeaking(false);
    setPaused(false);

    utteranceRef.current =
      null;
  };


  /*
   * IMPORTANT:
   * Voice can still be attempted when
   * a specific OS voice is unavailable.
   */
  const voiceReady =
    Boolean(
      speechSupported &&
      speechText,
    );


  const statusText =
    !speechSupported
      ? "Speech synthesis is not supported by this browser."
      : selectedVoice
        ? `${selectedLanguage.label} voice ready`
        : `${selectedLanguage.label} voice requested · using browser speech engine`;


  return (
    <section
      className={
        compact
          ? "farmer-voice-card farmer-voice-compact"
          : "farmer-voice-card"
      }
    >

      <div className="farmer-voice-header">

        <div className="farmer-voice-icon">
          <Volume2 size={18} />
        </div>


        <div className="farmer-voice-title">

          <span className="eyebrow">
            CRAI FARMER ASSISTANT
          </span>

          <h3>
            Listen to advisory
          </h3>

        </div>


        <div
          className={
            voiceReady
              ? "farmer-voice-ready"
              : "farmer-voice-ready unavailable"
          }
        >
          <span />

          {voiceReady
            ? "Voice ready"
            : "Voice unavailable"}
        </div>

      </div>


      {/* ======================================================
          LANGUAGE
      ====================================================== */}

      <div className="farmer-voice-language-row">

        <div className="farmer-voice-language-title">

          <Languages size={15} />

          <span>
            Language
          </span>

        </div>


        <div className="farmer-voice-language-buttons">

          {Object.keys(
            LANGUAGES,
          ).map((key) => (

            <button
              key={key}
              type="button"
              className={
                language === key
                  ? "voice-language active"
                  : "voice-language"
              }
              onClick={() => {
                handleStop();

                onLanguageChange?.(
                  key,
                );
              }}
            >
              {LANGUAGES[key].label}
            </button>

          ))}

        </div>

      </div>


      {/* ======================================================
          SPEAKING STATUS
      ====================================================== */}

      {speaking && (

        <div className="farmer-voice-speaking">

          <div className="voice-speaking-icon">
            <Volume2 size={17} />
          </div>


          <div>

            <strong>
              {paused
                ? "Voice paused"
                : "Speaking to farmer..."}
            </strong>

            <span>
              {selectedLanguage.label}
              {" · "}
              {selectedVoice?.lang ||
                selectedLanguage.code}
            </span>

          </div>

        </div>

      )}


      {/* ======================================================
          CONTROLS
      ====================================================== */}

      <div className="farmer-voice-controls">

        {!speaking ||
        paused ? (

          <button
            type="button"
            className="voice-control primary"
            onClick={
              paused
                ? handleResume
                : handlePlay
            }
            disabled={
              !speechText ||
              !voiceReady
            }
          >

            {paused
              ? <Play size={16} />
              : <Volume2 size={16} />}

            <span>
              {paused
                ? "Resume"
                : "Listen to CRAI"}
            </span>

          </button>

        ) : (

          <button
            type="button"
            className="voice-control primary"
            onClick={
              handlePause
            }
          >

            <Pause size={16} />

            <span>
              Pause
            </span>

          </button>

        )}


        <button
          type="button"
          className="voice-control"
          onClick={
            handleStop
          }
          disabled={!speaking}
        >

          <Square size={15} />

          <span>
            Stop
          </span>

        </button>

      </div>


      {/* ======================================================
          STATUS
      ====================================================== */}

      <div
        className={
          voiceReady
            ? "farmer-voice-status"
            : "farmer-voice-status warning"
        }
      >

        {voiceReady ? (
          <span className="voice-status-dot available" />
        ) : (
          <AlertTriangle size={13} />
        )}

        <span>
          {statusText}
        </span>

      </div>


      {selectedVoice && (

        <div className="farmer-voice-selected">

          Device voice:{" "}

          <strong>
            {selectedVoice.name}
          </strong>

          {" · "}

          {selectedVoice.lang}

        </div>

      )}

    </section>
  );
}
