import React from "react";
import { Icon } from "@blueprintjs/core";

export const SpeechIcon = ({ onClick, onMouseEnter, onMouseLeave }) => (
  <span
    className="speech-icon"
    style={{ marginLeft: "5px", cursor: "pointer" }}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <Icon icon="volume-up" />
  </span>
);
