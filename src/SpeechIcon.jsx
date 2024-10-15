import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeUp } from "@fortawesome/free-solid-svg-icons";

export const SpeechIcon = ({ onClick, onMouseEnter, onMouseLeave }) => (
  <span
    className="speech-icon"
    style={{ marginLeft: "5px", cursor: "pointer" }}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}>
    <FontAwesomeIcon icon={faVolumeUp} />
  </span>
);
