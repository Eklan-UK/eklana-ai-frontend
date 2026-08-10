// Mission 2: Communication with Colleagues
export const mission2Prompts: Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}> = {
	receiving_handover: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Important Requirements

- Prioritize the student's weak phonemes ({{weak_phonemes}}) first.
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during nursing shift handovers.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while receiving or giving patient handovers, discussing diagnoses, medications, investigations, risks, pending tasks, and patient priorities.

3. Clinical Context

- Every sentence must sound like authentic nurse-to-nurse communication used in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect nursing shift handovers.
- Use realistic patient names, diagnoses, medications, allergies, laboratory results, imaging findings, physician instructions, safety concerns, pending investigations, or escalation plans where appropriate.
- The pronunciation practice should reinforce professional clinical communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Demonstrate active listening by focusing on important clinical information communicated during the handover.
- Identify critical information such as diagnosis, current condition, medications, allergies, risks, pending investigations, abnormal results, safety concerns, and priority tasks.
- Seek clarification by asking appropriate follow-up questions whenever information is incomplete, unclear, or ambiguous.
- Confirm understanding by accurately summarising priorities, follow-up actions, escalation requirements, and patient care plans before assuming responsibility.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - diagnoses
  - medications
  - laboratory results
  - imaging
  - patient risks
  - nursing assessments
  - pending tasks
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to nursing shift handovers.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural nurse-to-nurse sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{fill_blank_evidence}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

2. Important Requirements

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during nursing shift handovers.
- Every sentence should sound like authentic communication or documentation used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear during a nursing handover.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Demonstrates active listening by recognising important clinical information communicated during the handover.
- Identifies critical information such as diagnosis, current condition, medications, allergies, risks, pending investigations, abnormal results, safety concerns, and priority tasks.
- Seeks clarification by recognising when information is incomplete, unclear, or ambiguous.
- Confirms understanding by identifying vocabulary related to summarising priorities, follow-up actions, and escalation requirements before assuming patient care.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

6. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.

7. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "correctAnswer": "{{correct vocabulary}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Important Requirements

- The conversation should reflect realistic nursing shift handovers in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic nurse-to-nurse communication commonly used during shift handovers.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, collaborative, and appropriate response for the handover situation.

The correct answer should demonstrate one or more of the following competencies:

- Demonstrates active listening by acknowledging information appropriately and focusing on key clinical details throughout the handover.
- Identifies critical information such as diagnosis, current condition, medications, allergies, risks, pending investigations, abnormal results, safety concerns, and priority tasks.
- Seeks clarification by asking relevant follow-up questions whenever information is incomplete, unclear, or ambiguous.
- Confirms understanding by accurately summarising priorities, follow-up actions, escalation requirements, and patient care plans before assuming responsibility.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Outgoing Nurse, Charge Nurse, Doctor}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.


`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week: {{practiced_scenarios}}

VARIETY: If {{practiced_scenarios}} shows the student recently practiced a specific scenario, create a DIFFERENT scenario this time — related in clinical theme but not the same patient, setting, or situation.

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic nursing shift handovers in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new handover scenario.
- The student always plays the incoming nurse receiving the handover.
- The AI should play one or more outgoing nurses who are handing over multiple patients.
- The scenario should progress naturally from the beginning of the shift handover to clarification of important information and confirmation of priorities before the outgoing nurse leaves.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Sarah Chen
  - Emily Rodriguez
  - James Wilson
  - Michael Patel
  - Olivia Brown
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic nurse-to-nurse communication commonly heard during shift handovers in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Demonstrates active listening by paying attention throughout the handover and focusing on understanding key information.
- Identifies critical information such as diagnosis, current condition, medications, allergies, risks, pending investigations, abnormal results, safety concerns, and priority tasks.
- Seeks clarification by asking appropriate follow-up questions whenever information is incomplete, unclear, or ambiguous.
- Confirms understanding by summarizing key information, priorities, required follow-up actions, and escalation plans before accepting responsibility for the patients.

5. Realism

- Include realistic bedside or nursing station handovers involving 2–4 patients.
- Include realistic clinical information such as:
  - diagnosis
  - reason for admission
  - current condition
  - vital signs
  - medications
  - allergies
  - intravenous lines
  - oxygen therapy
  - wound care
  - laboratory results
  - imaging results
  - mobility status
  - fall risk
  - isolation precautions
  - pending tests
  - physician instructions
  - discharge plans
- Some information should require the learner to ask clarifying questions.
- Include realistic interruptions or follow-up questions where appropriate.
- Use authentic nursing terminology commonly used during shift handovers.

6. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character 1}}",
    "{{AI Character 2}}"
  ],
  "context": "{{Brief scenario description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON. No markdown. No explanation.

`,
	},
	giving_handover: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Important Requirements

- Prioritize the student's weak phonemes ({{weak_phonemes}}) first.
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used when giving nursing handovers.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while presenting patient reports, discussing diagnoses, medications, assessment findings, investigations, safety concerns, recommendations, and follow-up plans.

3. Clinical Context

- Every sentence must sound like authentic nurse-to-nurse communication used in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect a structured nursing handover.
- Use realistic patient names, diagnoses, medications, laboratory results, imaging findings, physician recommendations, procedures, pending tasks, monitoring requirements, and safety concerns where appropriate.
- The pronunciation practice should reinforce professional clinical communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Give concise and focused reports by using precise clinical vocabulary without unnecessary detail.
- Organize information logically by presenting diagnoses, recent events, treatments, assessments, monitoring needs, and recommendations in a clear sequence.
- Include critical patient details such as diagnoses, medications, procedures, vital sign changes, safety concerns, abnormal findings, pending investigations, and required follow-up.
- Use SBAR or ISBAR communication appropriately by practising vocabulary commonly used in Situation, Background, Assessment, and Recommendation during nursing handovers.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - diagnoses
  - medications
  - patient assessments
  - laboratory findings
  - imaging results
  - nursing interventions
  - monitoring
  - recommendations
  - safety concerns
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to structured nursing handovers.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural nurse-to-nurse handover sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{fill_blank_evidence}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Important Requirements

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during nursing shift handovers.
- Every sentence should sound like authentic nurse-to-nurse communication used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear in a nursing handover.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Gives concise and focused reports by selecting vocabulary that communicates essential patient information without unnecessary detail.
- Organizes information logically by using vocabulary appropriate for presenting diagnosis, clinical events, treatment, assessment findings, monitoring needs, and recommendations in sequence.
- Includes critical patient details by recognising vocabulary related to diagnoses, medications, procedures, vital sign changes, safety concerns, pending tasks, and abnormal findings.
- Uses SBAR or ISBAR communication appropriately by recognising vocabulary associated with Situation, Background, Assessment, and Recommendation during clinical handovers.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "correctAnswer": "{{correct vocabulary}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.



2. Important Requirements

- The conversation should reflect realistic nursing shift handovers in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic nurse-to-nurse communication commonly used during shift handovers.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, structured, and appropriate response for the specific handover situation.

The correct answer should demonstrate one or more of the following competencies:

- Gives concise and focused reports by communicating only the essential clinical information without unnecessary details.
- Organizes information logically by presenting information in a clear clinical sequence, such as diagnosis, recent events, treatment, assessment, monitoring needs, and recommendations.
- Includes critical patient details such as diagnosis, significant assessment findings, vital sign changes, medications, procedures, allergies, safety concerns, abnormal results, pending investigations, and follow-up tasks.
- Uses SBAR or ISBAR communication appropriately by presenting or reinforcing Situation, Background, Assessment, and Recommendation in a structured manner.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Incoming Nurse, Charge Nurse, Doctor}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week: {{practiced_scenarios}}

VARIETY: If {{practiced_scenarios}} shows the student recently practiced a specific scenario, create a DIFFERENT scenario this time — related in clinical theme but not the same patient, setting, or situation.

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic nursing shift handovers in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new handover scenario.
- The student always plays the outgoing nurse giving the handover.
- The AI should play one or more incoming nurses receiving the handover.
- The scenario should progress naturally from preparing the handover to presenting patient information, answering clarification questions, and confirming that responsibility for patient care has been transferred.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for their roles.

Examples:
- Sarah Chen
- Emily Rodriguez
- James Wilson
- Michael Patel
- Olivia Brown

- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic nurse-to-nurse communication commonly heard during shift handovers in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.
- The student should deliver handovers for multiple patients rather than a single patient whenever appropriate.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Gives concise and focused reports by communicating essential patient information clearly without unnecessary details or excessive rambling.
- Organizes information logically by presenting patient information in a consistent clinical sequence, such as diagnosis, recent events, treatments, current condition, monitoring needs, and pending tasks.
- Includes critical patient details including diagnosis, significant assessment findings, vital sign changes, medications, procedures, safety concerns, abnormal results, pending investigations, and required follow-up.
- Uses the SBAR or ISBAR communication framework appropriately by providing a structured Situation, Background, Assessment, and Recommendation (or Identification, Situation, Background, Assessment, Recommendation) during every patient handover.

5. Realism

- Include realistic nursing shift handovers involving 2–4 patients.
- Include authentic patient information such as:
  - patient identifiers
  - diagnosis
  - reason for admission
  - current clinical status
  - recent changes
  - medications
  - allergies
  - laboratory results
  - imaging findings
  - oxygen therapy
  - intravenous access
  - procedures
  - mobility status
  - fall risk
  - skin integrity
  - isolation precautions
  - pending tests
  - physician plans
  - discharge planning
- The receiving nurse should occasionally ask clarification questions requiring the learner to explain or clarify information.
- Include realistic interruptions or requests for clarification where appropriate.
- Use authentic nursing terminology commonly heard during ICU and hospital shift handovers.

6. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character 1}}",
    "{{AI Character 2}}"
  ],
  "context": "{{Brief scenario description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON. No markdown. No explanation.

`,
	},
	declining_request: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Important Requirements

- Prioritize the student's weak phonemes ({{weak_phonemes}}) first.
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during professional workplace discussions between nurses and managers.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while discussing staffing, scheduling, patient assignments, workload, professional boundaries, shift coverage, hospital policies, and collaborative problem-solving.

3. Clinical Context

- Every sentence must sound like authentic workplace communication used in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect professional conversations between nurses, managers, charge nurses, supervisors, or nurse educators.
- Use realistic workplace situations involving staffing shortages, patient assignments, scheduling conflicts, overtime requests, vacation approvals, workload distribution, shift changes, escalation, and collaborative planning.
- The pronunciation practice should reinforce professional workplace communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Maintain a respectful and calm tone by using polite, professional language even during difficult conversations.
- State limitations or refusals clearly by confidently explaining concerns or declining requests without sounding vague or overly apologetic.
- Avoid confrontation or defensive language by using respectful vocabulary that encourages constructive discussion and collaboration.
- Provide alternative solutions or assistance by practising language related to compromise, scheduling adjustments, staffing support, delegation, and next steps.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common workplace vocabulary and moderately difficult healthcare terminology.
- Include words from different categories such as:
  - staffing
  - scheduling
  - workload
  - patient assignments
  - leadership
  - teamwork
  - negotiation
  - professional communication
  - hospital operations
  - conflict resolution
- Avoid extremely rare terminology unless it is directly relevant to professional nursing workplace conversations.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical or workplace word}}",
    "sentence": "{{natural workplace sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{fill_blank_evidence}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.



2. Important Requirements

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during professional workplace conversations between nurses and managers.
- Every sentence should sound like authentic workplace communication used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough workplace context that only one answer is correct.
- Use full professional terminology rather than abbreviations whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate workplace or healthcare vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear in conversations about scheduling, workload, staffing, or professional communication.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Maintains a respectful and calm tone by selecting language that is polite, professional, and emotionally controlled.
- States limitations or refusals clearly by using vocabulary that communicates concerns, workload, availability, or scheduling without ambiguity.
- Avoids confrontation or defensive language by choosing words that promote collaboration instead of blame or conflict.
- Provides alternative solutions or assistance by recognising vocabulary related to compromise, flexibility, scheduling, staffing, and next steps.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

6. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.

7. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.


Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "correctAnswer": "{{correct vocabulary}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.



2. Important Requirements

- The conversation should reflect realistic workplace discussions in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses, managers, charge nurses, nurse supervisors, and hospital administrators.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses professionally reasonable.
- At least half of the questions should contain two responses that an experienced nurse could realistically say.
- The learner must identify the MOST respectful, assertive, collaborative, and professionally appropriate response.

The correct answer should demonstrate one or more of the following competencies:

- Maintains a respectful and calm tone by communicating professionally without sounding rude, dismissive, irritated, or emotional.
- States limitations or refusals clearly by explaining concerns or declining requests directly, confidently, and respectfully without excessive apologising.
- Avoids confrontation or defensive language by remaining solution-focused and avoiding blame, arguments, or emotional escalation.
- Provides alternative solutions or assistance by suggesting reasonable compromises, offering different options, or proposing practical next steps whenever appropriate.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

6. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.

7. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Manager, Charge Nurse, Supervisor, Nurse Educator}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these workplace scenarios this week: {{practiced_scenarios}}

VARIETY: If {{practiced_scenarios}} shows the student recently practiced a specific scenario, create a DIFFERENT scenario this time — related in clinical theme but not the same patient, setting, or situation.

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic workplace conversations between a nurse and a manager or supervisor in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new workplace situation.
- The student always plays the nurse.
- The AI should play a realistic manager, charge nurse, nurse supervisor, or nurse educator.
- The scenario should involve situations where the nurse needs to respectfully decline a request, question an unfair decision, express concerns about workload or scheduling, or professionally say no while maintaining a collaborative relationship.
- The scenario should progress naturally from the manager making a request, to the learner expressing concerns, discussing possible solutions, and concluding with mutual understanding.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for their roles.

Examples:
- Sarah Mitchell
- David Carter
- Emily Rodriguez
- Michael Patel
- Jennifer Wilson

- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic workplace communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Maintains a respectful and calm tone by speaking politely and professionally without sounding rude, dismissive, irritated, or emotional.
- States limitations or refusals clearly by explaining why a request cannot reasonably be accepted without being vague or excessively apologetic.
- Avoids confrontation or defensive language by remaining composed, respectful, and solution-focused throughout the discussion.
- Provides alternative solutions or assistance by suggesting compromises, proposing reasonable alternatives, or identifying appropriate next steps whenever possible.

5. Realism

- Include realistic workplace situations such as:
  - unfair patient assignments
  - unsafe workloads
  - unexpected schedule changes
  - denied break requests
  - overtime requests
  - being asked to stay beyond scheduled hours
  - vacation scheduling conflicts
  - on-call rotation concerns
  - requests outside the nurse's responsibilities
  - staffing shortages
- Managers should present realistic organisational constraints without being unnecessarily hostile.
- The learner should have opportunities to:
  - explain concerns professionally
  - advocate for patient safety
  - discuss workload fairly
  - set appropriate professional boundaries
  - respectfully disagree
  - negotiate alternative solutions
- The conversation should remain respectful and collaborative even when opinions differ.

6. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character 1}}"
  ],
  "context": "{{Brief scenario description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON. No markdown. No explanation.

`,
	},
	small_talk_colleagues: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Important Requirements

- Prioritize the student's weak phonemes ({{weak_phonemes}}) first.
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during workplace conversations between healthcare colleagues.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while greeting colleagues, offering encouragement, discussing work, talking during breaks, collaborating with teammates, welcoming new staff, or participating in everyday workplace conversations.

3. Workplace Context

- Every sentence must sound like authentic workplace communication used in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect professional but friendly conversations between nurses and other healthcare professionals.
- Use realistic workplace situations such as starting a shift, handing over tasks informally, taking breaks, discussing continuing education, supporting colleagues after difficult cases, welcoming new staff, celebrating achievements, or preparing for the day's work.
- The pronunciation practice should reinforce natural workplace communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Use appropriate workplace social language by communicating naturally and politely with colleagues.
- Maintain conversational flow by responding smoothly, asking relevant follow-up questions, and contributing naturally to workplace conversations.
- Demonstrate professionalism and respect by using courteous language while maintaining appropriate workplace boundaries.
- Build rapport and positive relationships by practising vocabulary that encourages friendly conversation, teamwork, encouragement, appreciation, and inclusive communication.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common workplace vocabulary and moderately difficult healthcare terminology.
- Include words from different categories such as:
  - greetings
  - teamwork
  - collaboration
  - encouragement
  - scheduling
  - workplace relationships
  - professional communication
  - hospital departments
  - education and training
  - healthcare teamwork
- Avoid extremely rare terminology unless it is directly relevant to everyday workplace conversations between healthcare professionals.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical or workplace word}}",
    "sentence": "{{natural workplace sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{fill_blank_evidence}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate exactly 10 - 15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.



2. Important Requirements

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during workplace conversations between healthcare colleagues.
- Every sentence should sound like authentic workplace communication used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough workplace context that only one answer is correct.
- Use full professional terminology rather than abbreviations whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate workplace or healthcare vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear in conversations between colleagues.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Uses appropriate workplace social language by selecting vocabulary that is friendly, natural, and appropriate for professional interactions.
- Maintains conversational flow by recognising vocabulary commonly used to ask questions, respond naturally, share experiences, and continue conversations.
- Demonstrates professionalism and respect by choosing vocabulary that maintains appropriate workplace boundaries and respectful communication.
- Builds rapport and positive relationships by recognising language that encourages collaboration, inclusion, encouragement, appreciation, and friendly interaction.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

6. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.

7. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "correctAnswer": "{{correct vocabulary}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

SCENARIO ANCHOR: If {{practiced_scenarios}} contains a specific clinical scenario (not the generic fallback text), build your sentences and examples inside that same clinical setting — same type of patient situation, same clinical context — using the patient/setting details from that scenario where natural. Do not invent an unrelated scenario. If {{practiced_scenarios}} is empty or only contains generic text, fall back to your own topic-appropriate scenario as usual.

Generate 10 - 15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

2. Important Requirements

- The conversation should reflect realistic workplace conversations between healthcare colleagues in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly used between nurses, charge nurses, nurse educators, physicians, and other healthcare professionals.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses professionally reasonable.
- At least half of the questions should contain two responses that an experienced nurse could realistically say.
- The learner must identify the MOST natural, friendly, professional, and contextually appropriate response.

The correct answer should demonstrate one or more of the following competencies:

- Uses appropriate workplace social language by communicating naturally, politely, and appropriately with colleagues.
- Maintains conversational flow by responding smoothly, asking relevant follow-up questions, contributing naturally to conversations, and avoiding awkward or scripted responses.
- Demonstrates professionalism and respect by maintaining appropriate workplace boundaries, respecting colleagues' perspectives, and communicating courteously.
- Builds rapport and positive relationships by showing genuine interest, encouraging conversation, expressing appreciation, offering support, and creating an inclusive workplace atmosphere.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

6. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.

7. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Colleague, Charge Nurse, Doctor, Healthcare Assistant}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these workplace scenarios this week: {{practiced_scenarios}}

VARIETY: If {{practiced_scenarios}} shows the student recently practiced a specific scenario, create a DIFFERENT scenario this time — related in clinical theme but not the same patient, setting, or situation.

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic workplace conversations between nurses in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new workplace social situation.
- The student always plays the nurse.
- The AI should play one or more colleagues such as another staff nurse, charge nurse, nurse educator, clinical instructor, or healthcare assistant.
- The conversations should happen naturally before a shift, during a break, while preparing for rounds, after a difficult patient case, after a shift, or during everyday workplace interactions.
- The conversation should remain social while still reflecting a professional healthcare environment.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for their roles.

Examples:
- Sarah Chen
- Emily Rodriguez
- James Wilson
- Michael Patel
- Olivia Brown

- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic workplace conversations commonly heard among healthcare professionals in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.
- The conversation should feel relaxed, friendly, and spontaneous while remaining professional.

4. Workplace Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Uses appropriate workplace social language by communicating naturally, politely, and appropriately with colleagues.
- Maintains conversational flow by responding smoothly, asking follow-up questions, sharing relevant experiences, and keeping conversations engaging without sounding scripted.
- Demonstrates professionalism and respect by maintaining appropriate workplace boundaries, respecting different opinions, and communicating courteously.
- Builds rapport and positive relationships by showing interest in colleagues, actively listening, encouraging conversation, offering support, and creating a welcoming team environment.

5. Realism

- Include realistic workplace topics such as:
  - starting or ending a shift
  - discussing weekend plans
  - talking about holidays
  - asking about family
  - discussing lunch or coffee breaks
  - welcoming a new colleague
  - celebrating birthdays or achievements
  - discussing continuing education or certifications
  - recovering after a busy shift
  - talking about hobbies or interests
  - supporting a stressed colleague
  - preparing for the day's workload
- Conversations should remain socially appropriate and should never disclose confidential patient information unnecessarily.
- Include natural humour, encouragement, empathy, or friendly conversation where appropriate.
- The dialogue should reflect multicultural workplaces commonly found in hospitals in {{country}}.

6. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character 1}}",
    "{{AI Character 2}}"
  ],
  "context": "{{Brief scenario description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON. No markdown. No explanation.

`,
	},
};
