import { useState } from "react";
import { useAppState } from "../../app/state";

export function TeacherPage() {
  const { constants } = useAppState();
  const [inputPasscode, setInputPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");

  function unlock() {
    if (inputPasscode === constants.teacher_mode.default_passcode) {
      setIsUnlocked(true);
      setError("");
      return;
    }
    setError("Incorrect passcode.");
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Teacher Mode</h1>
        <p>Enter passcode to unlock constants editing tools.</p>
      </header>

      {!isUnlocked ? (
        <div className="card">
          <label htmlFor="teacher-passcode">Teacher passcode</label>
          <input
            id="teacher-passcode"
            type="password"
            value={inputPasscode}
            onChange={(event) => setInputPasscode(event.target.value)}
          />
          <div className="page-actions">
            <button type="button" onClick={unlock}>
              Unlock
            </button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      ) : (
        <div className="card">
          <h2>Teacher tools unlocked</h2>
          <p>Constants edit controls are enabled in the next checkpoint.</p>
        </div>
      )}
    </section>
  );
}
