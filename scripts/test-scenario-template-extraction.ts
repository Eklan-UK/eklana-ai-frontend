/**
 * Standalone diagnostic: test simulation-scenario extraction against the new
 * slide template format, with no HTTP, no database, and no file upload
 * involved — just a hardcoded sample of raw slide text run straight through
 * extractScenarioContext().
 *
 * The sample below is a SYNTHETIC two-character rapid-response scenario
 * (Nurse Sunju as the student role, Mr. Kim as the patient, plus a second
 * AI-voiced character — a Charge Nurse in phase 1 and a Rapid Response Nurse
 * in phase 2) written to exercise the exact failure mode this script exists
 * to catch: a second character present in the deck getting dropped during
 * extraction so only one character comes through per phase. It is NOT
 * pulled from any real prior test session — there was no such transcript
 * available to reuse, so this is a constructed stand-in with the same shape.
 *
 * Usage:
 *   npx tsx scripts/test-scenario-template-extraction.ts
 *
 * Loads .env.local then .env for GEMINI_API_KEY before importing anything
 * that reads process.env at module-load time (config.ts), so those imports
 * must be dynamic, done after loadEnv runs — same pattern as
 * scripts/diagnose-simulation-role-confusion.ts.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const STUDENT_CHARACTER_NAME = "Nurse Sunju";

const SAMPLE_SLIDE_TEXT = `
Title: Rapid Response — Acute Respiratory Distress on the Telemetry Unit

Workplace Setting: Telemetry unit, general medical-surgical hospital ward

Student's Role: Nurse Sunju, the bedside nurse assigned to the patient this shift

Background/Briefing:
You are Nurse Sunju, halfway through a day shift on the telemetry unit. Your
patient in bed 4, Mr. Kim, was admitted two days ago for pneumonia and has
been stable on room air until now. You are about to do a routine check when
you notice he looks more short of breath than he did an hour ago.

Vitals/Clinical Info (patient snapshot at the start of the encounter):
- SpO2: 91% on room air
- Heart rate: 108 bpm
- Respiratory rate: 24/min
- Blood pressure: 132/84
- Temperature: 37.9°C
- Mr. Kim is alert and oriented, sitting up in bed, using slightly labored breathing

Phase 1: Initial Assessment at the Bedside
Trigger: Scene begins — Nurse Sunju enters the room for a routine check
AI-Voiced Characters: Mr. Kim (patient), Charge Nurse Maria Lopez
Conversation Beats:
- Mr. Kim: reports new shortness of breath and mild chest tightness, sounds anxious and short of breath when speaking
- Mr. Kim: expresses worry about what is happening to him
- Charge Nurse Maria Lopez: passing by the room, asks Sunju if she needs a hand or wants her to grab anything
- Charge Nurse Maria Lopez: offers to help call for support if Sunju identifies a change in condition
Gated Findings (revealed only after the learner actively assesses/asks):
- Label: Repeat SpO2 reading — Data: SpO2 has dropped to 86% on room air — Reveal condition: after the learner re-checks oxygen saturation following the patient's report of worsening breathlessness
- Label: Lung sounds — Data: Bilateral crackles at the bases on auscultation — Reveal condition: after the learner listens to the patient's lung sounds
Phase ends when: Nurse Sunju recognizes the deterioration and decides to escalate (e.g. calls for the Rapid Response Team)

Phase 2: Rapid Response Team Arrival
Trigger: Nurse Sunju calls the Rapid Response Team
AI-Voiced Characters: Mr. Kim (patient), Rapid Response Nurse Dana Okafor
Conversation Beats:
- Rapid Response Nurse Dana Okafor: arrives briskly, asks Sunju for an SBAR-style handoff of the situation
- Rapid Response Nurse Dana Okafor: confirms the plan (oxygen, repeat vitals, physician notification) once Sunju reports it
- Mr. Kim: continues to appear anxious, asks whether he is having a heart attack
Gated Findings (revealed only after the learner actively assesses/asks):
- Label: Post-oxygen SpO2 — Data: SpO2 improves to 94% after 4L nasal cannula is applied — Reveal condition: after the learner applies supplemental oxygen and rechecks saturation
Phase ends when: Nurse Sunju gives a complete SBAR handoff to the Rapid Response Nurse

Grading Rubric:
- Recognizes early signs of respiratory deterioration
- Escalates appropriately and in a timely manner
- Communicates clearly using SBAR format during handoff
- Maintains a calm, reassuring tone with the patient throughout

Weekly Focus: Recognizing and escalating acute clinical deterioration

Max Duration: 12 minutes

Facilitator Notes (not shown to learner):
- Ideal escalation should occur within 2-3 conversational turns of the SpO2 drop being revealed
- Debrief question: What cues indicated deterioration before the numeric SpO2 drop was confirmed?
- Model SBAR handoff: "Situation: Mr. Kim in bed 4 is acutely short of breath, SpO2 dropped to 86% on room air. Background: admitted for pneumonia, previously stable. Assessment: bilateral crackles, tachycardic, tachypneic. Recommendation: needs oxygen, physician evaluation, and continued monitoring."
`.trim();

function printCharacterBreakdown(scenarioScript: Array<{
  phaseTitle: string;
  situation: string;
  clinicalInformation: string;
  characters: string[];
  dramatisationPrompt: string;
}>) {
  console.log("\n=== scenarioScript — character breakdown per phase ===");
  scenarioScript.forEach((phase, idx) => {
    console.log(`\n--- Phase ${idx + 1}: "${phase.phaseTitle}" ---`);
    console.log(`  situation: ${phase.situation}`);
    console.log(`  clinicalInformation: ${phase.clinicalInformation}`);
    console.log(`  characters (${phase.characters.length}): ${phase.characters.join(", ") || "(none)"}`);
    console.log(`  dramatisationPrompt: ${phase.dramatisationPrompt}`);
  });
  console.log("");
}

async function main() {
  const { extractScenarioContext } = await import("../src/domain/simulation/simulation-scenario-extraction.service");

  console.log(`Calling extractScenarioContext(sampleText, "${STUDENT_CHARACTER_NAME}")...\n`);

  const result = await extractScenarioContext(SAMPLE_SLIDE_TEXT, STUDENT_CHARACTER_NAME);

  console.log("=== background (full) ===");
  console.log(result.background);
  console.log("");

  console.log("=== patientInformation (full) ===");
  console.log(result.patientInformation);
  console.log("");

  console.log("=== dramatisationPrompt (full) ===");
  console.log(result.dramatisationPrompt);
  console.log("");

  console.log("=== hints (full) ===");
  if (result.hints.length === 0) {
    console.log("(empty array — deck had no student-facing reference material)");
  } else {
    for (const hint of result.hints) {
      console.log(`  - [${hint.phaseTitle}] ${hint.hintText}`);
    }
  }
  console.log("");

  printCharacterBreakdown(result.scenarioScript);

  console.log("=== hiddenContext (full) ===");
  console.log(result.hiddenContext);
  console.log("");

  const allCharacters = new Set<string>();
  for (const phase of result.scenarioScript) {
    for (const c of phase.characters) allCharacters.add(c);
  }
  console.log("=== Summary ===");
  console.log(`Total phases: ${result.scenarioScript.length}`);
  console.log(`Distinct characters across all phases: ${allCharacters.size} — ${Array.from(allCharacters).join(", ")}`);
  const hasKim = Array.from(allCharacters).some((c) => c.toLowerCase().includes("kim"));
  const hasSecondCharacter = allCharacters.size >= 2;
  console.log(`"Mr. Kim" present: ${hasKim}`);
  console.log(`Second character present (e.g. Charge Nurse / Rapid Response Nurse): ${hasSecondCharacter}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
