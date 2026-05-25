import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

export default function Toggle({ checked, label, hint, onChange }) {
  return (
    <button
      type="button"
      className={`ventas-toggle ${checked ? "ventas-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      title={hint || label}
      aria-pressed={checked}
    >
      <span className="ventas-toggle__box" aria-hidden="true">
        {checked ? <FontAwesomeIcon icon={faCheck} /> : null}
      </span>
      <span className="ventas-toggle__text">{label}</span>
    </button>
  );
}
