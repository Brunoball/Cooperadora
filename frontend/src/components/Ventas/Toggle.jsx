import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faToggleOff, faToggleOn } from "@fortawesome/free-solid-svg-icons";

export default function Toggle({ checked, label, hint, onChange }) {
  return (
    <button
      type="button"
      className={`ventas-toggle ${checked ? "ventas-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      title={hint || label}
    >
      <FontAwesomeIcon icon={checked ? faToggleOn : faToggleOff} />
      <span>{label}</span>
    </button>
  );
}
