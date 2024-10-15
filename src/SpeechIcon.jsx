import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeUp } from "@fortawesome/free-solid-svg-icons";

export const SpeechIcon = ({ onClick }) => (
  <span className="speech-icon" style={{ marginLeft: '5px', cursor: 'pointer' }} onClick={onClick}>
    <FontAwesomeIcon icon={faVolumeUp} />
  </span>
);

