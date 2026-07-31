// Mission 1: Communication with Patients
// TODO: replace placeholder prompt strings with real per-topic prompt copy.
export const mission1Prompts: Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}> = {
	handling_emergency_critical: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

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
- If additional words are needed, supplement with vocabulary commonly used when handling emergency and critical-care situations.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce during emergency patient care.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect emergency or critical-care situations.
- Use realistic patient names, symptoms, vital signs, medications, procedures, medical equipment, physician instructions, or multidisciplinary communication where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Recognize patient deterioration quickly by identifying emergency signs such as low oxygen saturation, chest pain, respiratory distress, hypotension, confusion, altered level of consciousness, or sudden changes in condition.
- Provide immediate and appropriate nursing interventions by initiating oxygen therapy, monitoring vital signs, positioning the patient safely, assessing symptoms, notifying the physician, or activating the Rapid Response Team when appropriate.
- Give clear, calm, and direct patient instructions using concise communication such as "Please stay still," "Take slow, deep breaths," or "I'm going to check your blood pressure."
- Use professional ICU terminology accurately, including oxygen saturation, blood pressure, respiratory distress, chest tightness, pulse, heart rhythm, level of consciousness, intravenous line, vital signs, and Rapid Response Team.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - symptoms
  - assessments
  - medications
  - procedures
  - medical equipment
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to handling emergency and critical-care situations.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural clinical sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.


`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{weak_words}}

Generate 10 - 15 vocabulary questions according to the following rules:

1. Format

- Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}.

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

- Use the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, create more sentences for the weak words to be used in.
- Every sentence should sound like authentic communication or documentation used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear in an emergency or critical-care situation.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Recognizes patient deterioration quickly by identifying emergency signs such as low oxygen saturation, chest pain, respiratory distress, hypotension, confusion, altered level of consciousness, or sudden changes in condition.
- Provides immediate and appropriate nursing interventions by initiating oxygen therapy, monitoring vital signs, positioning the patient safely, assessing symptoms, notifying the physician, or activating the Rapid Response Team when appropriate.
- Gives clear, calm, and direct patient instructions during emergency situations.
- Uses professional ICU terminology accurately, including oxygen saturation, blood pressure, respiratory distress, chest tightness, pulse, heart rhythm, level of consciousness, intravenous line, vital signs, and Rapid Response Team.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to strengthen recognition and understanding of emergency and critical-care vocabulary while improving clinical communication during high-pressure situations.

- Every option must be authentic medical vocabulary.
- The correct answer must be unambiguously correct for the specific clinical situation.
- Incorrect answers should be plausible but incorrect because of incorrect assessment, intervention, procedure, equipment, medication, or clinical meaning.
- Every sentence should reflect realistic emergency or ICU scenarios.

6. Sentence Design

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

7. Answer Options

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

8. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

9. Difficulty

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

Generate  key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

Generate 10 - 15 key phrases according to the following  rules:

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
The conversation should be like a real-world scenario. Avoid textbook language, scripted dialogue, robotic communication and overly formal wording.
Use natural nurse-to-nurse and doctor-to-nurse language as used in the {{country}}
Every correct answer must contain at least one authentic phrase from the ones that were missed.

3. Realistic Answer Choices
Do NOT make the incorrect answers obviously wrong.
Instead:
Make many answer choices clinically reasonable.
Make at least half of the questions contain two answers that could realistically be said by a nurse.
The learner must identify which answer is the MOST professional, concise, collaborative, and appropriate emergency situation
The correct should be the one that demonstrates the following:
Recognizes patient deterioration quickly by identifying emergency signs such as low oxygen saturation, chest pain, respiratory distress, hypotension, or confusion without delay
Provides immediate appropriate intervention by initiating correct first actions such as increasing oxygen, monitoring vital signs, positioning patient safely, or assessing symptoms
Gives clear patient instructions by using short, direct instructions such as "Take slow deep breaths" or "Please stay still"
Correctly uses professional ICU terminology like oxygen saturation, blood pressure, respiratory distress, chest tightness, or heart rhythm.

4. Balanced Answer Distribution
- Do NOT place all correct answers in the same position.
- Distribute correct answers evenly across: A, B, C, D. The answer pattern should feel random.
- The learner’s objective is to help learners develop automaticity, speaking clarity, and professional confidence when handling emergency and critical-care situations by repeatedly practising highly personalised clinical scenarios that closely mirror real-world experiences .

-All 4 options must sound like something a professional nurse would say — no casual or unprofessional options.
-The correct answer must be unambiguously right for THIS specific situation.
- Wrong options must be plausible nursing phrases that are clearly wrong due to wrong timing, wrong clinical action, wrong information, or wrong level of urgency — NOT because they sound unprofessional.
- The situation prompt must include enough clinical detail that only one response is appropriate.

Return a JSON array:
[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Patient, Doctor, Incoming Nurse}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": ["{{correctAnswer}}", "{{wrong1}}", "{{wrong2}}", "{{wrong3}}"]
  }
]

Return only valid JSON. No markdown, no explanation.
`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week: {{practiced_scenarios}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic emergency or critical-care situations in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same competencies in a new clinical situation.
- The student always plays the nurse.
- The scenario should progress naturally from recognizing patient deterioration through assessment, emergency intervention, multidisciplinary communication, and patient stabilization or transfer.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Dr. James Wilson
  - Sarah Chen
  - Michael Patel
  - Mr. David Thompson
  - Emily Rodriguez
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete, natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Recognizes patient deterioration quickly by identifying emergency signs such as low oxygen saturation, chest pain, respiratory distress, hypotension, confusion, altered level of consciousness, or sudden changes in condition.
- Provides immediate and appropriate nursing interventions by initiating oxygen therapy, monitoring vital signs, positioning the patient safely, assessing symptoms, notifying the physician, or activating the Rapid Response Team when appropriate.
- Gives clear, calm, and direct patient instructions using concise communication such as:
  - "Please stay still."
  - "Take slow, deep breaths."
  - "Try not to sit up yet."
  - "I'm going to check your blood pressure."
- Uses professional ICU terminology accurately, including oxygen saturation, blood pressure, respiratory distress, chest tightness, pulse, heart rhythm, level of consciousness, intravenous line, vital signs, and Rapid Response Team.

5. Realism

- Include realistic patient symptoms, vital signs, monitor alarms, medications, physician orders, nursing interventions, laboratory results, and multidisciplinary communication where appropriate.
- Patients should ask realistic questions about their symptoms, medications, treatment plan, or prognosis.
- AI characters should ask questions or provide updates that require the learner to communicate professionally.
- Include natural interruptions and changes in patient condition that reflect real emergency situations.

6. Learning Objective

The learner's objective is to develop automatic, confident, and clinically appropriate communication while managing emergency and critical-care situations.

The roleplay should encourage the learner to:

- recognize patient deterioration quickly
- prioritize immediate nursing interventions
- communicate effectively with patients and the healthcare team
- provide reassurance while maintaining professionalism
- use accurate emergency and ICU terminology
- remain calm under pressure

7. Output Format

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

Return only valid JSON. No markdown. No explanation.`,
	},
	patient_follow_up: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

Generate exactly 10 - 15 pronunciation items according to the following rules:

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
- If additional words are needed, supplement with vocabulary commonly used during patient follow-up conversations.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce during patient assessments, patient education, medication discussions, discharge planning, and follow-up care.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect patient follow-up conversations.
- Use realistic patient names, symptoms, medications, vital signs, recovery progress, discharge planning, monitoring, physician recommendations, or patient education where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Recognize patient concerns, symptoms, emotional distress, recovery progress, medication concerns, discharge questions, or changes in condition during follow-up conversations.
- Provide appropriate follow-up care by explaining medications, monitoring, recovery expectations, discharge planning, safety precautions, and next steps clearly and professionally.
- Give clear, calm, reassuring, and patient-friendly communication while answering questions, providing education, and giving instructions.
- Use professional patient-care terminology accurately, including medications, monitoring, recovery, discharge planning, vital signs, oxygen therapy, fall prevention, patient assessment, and cardiac care where appropriate.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - symptoms
  - assessments
  - medications
  - monitoring
  - discharge planning
  - patient education
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to patient follow-up care.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural clinical sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{weak_words}}

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

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during patient follow-up conversations.
- Every sentence should sound like authentic communication or documentation used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear during patient follow-up care.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Recognizes patient concerns, symptoms, emotional distress, recovery progress, medication concerns, discharge questions, or changes in condition during follow-up conversations.
- Provides appropriate follow-up care by explaining medications, monitoring, recovery expectations, discharge planning, safety precautions, and next steps clearly and professionally.
- Uses clear, calm, reassuring, and patient-friendly language while answering questions, providing education, and giving instructions.
- Uses professional patient-care terminology accurately, including medications, monitoring, recovery, discharge planning, vital signs, oxygen therapy, fall prevention, patient assessment, and cardiac care where appropriate.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to strengthen recognition and understanding of patient follow-up vocabulary while improving communication during patient assessments and follow-up care.

- Every option must be authentic clinical vocabulary.
- The correct answer must be unambiguously correct for the specific clinical situation.
- Incorrect answers should be plausible but incorrect because of incorrect assessment, intervention, medication, patient education, recovery guidance, monitoring, or clinical meaning.
- Every sentence should reflect realistic patient follow-up situations in hospitals.

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

- The conversation should reflect realistic patient follow-up situations in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses and patients, physicians, family members, or other healthcare professionals where appropriate.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that a competent nurse could realistically say.
- The learner must identify the MOST professional, empathetic, concise, and appropriate response for the situation.

The correct answer should demonstrate one or more of the following competencies:

- Recognizes patient concerns, symptoms, emotional distress, recovery progress, medication concerns, discharge questions, or changes in condition during follow-up conversations.
- Provides appropriate follow-up care information by explaining medications, monitoring, recovery expectations, discharge planning, safety precautions, and next steps clearly and professionally.
- Gives clear, calm, reassuring, and patient-friendly responses while answering questions, providing education, and giving instructions.
- Uses professional patient-care terminology accurately, including medications, monitoring, recovery, discharge planning, vital signs, oxygen therapy, fall prevention, patient assessment, and cardiac care where appropriate.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to develop automatic, natural, and professional communication during patient follow-up conversations through repeated practice in realistic clinical scenarios.

- Every option should sound like something a professional nurse could realistically say.
- The correct answer must be unambiguously the best response for the specific situation.
- Incorrect answers should be plausible but incorrect because of inappropriate timing, incomplete patient education, insufficient reassurance, inaccurate clinical information, weak prioritization, or poor communication—not because they sound unprofessional.
- Every prompt must contain enough clinical detail that only one response is the best choice.
- Include situations where the nurse builds rapport through empathy, encouragement, or appropriate small talk while maintaining professional boundaries.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Patient, Doctor, Family Member, Incoming Nurse}}",
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

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic patient follow-up situations in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the nurse.
- The scenario should progress naturally from assessing the patient's condition to providing follow-up care, answering questions, and concluding the interaction professionally.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Dr. James Wilson
  - Sarah Chen
  - Mr. David Thompson
  - Emily Rodriguez
  - Michael Patel
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Recognizes patient concerns, symptoms, emotional distress, recovery progress, medication concerns, discharge questions, or changes in condition during follow-up conversations.
- Provides appropriate follow-up care by explaining medications, monitoring, recovery expectations, discharge planning, safety precautions, and next steps clearly and professionally.
- Uses clear, calm, reassuring, and patient-friendly language while answering questions, giving instructions, providing education, and maintaining a professional bedside manner.
- Uses professional patient-care terminology accurately, including medications, monitoring, recovery, discharge planning, vital signs, oxygen therapy, fall prevention, patient assessment, and cardiac care where appropriate.

5. Realism

- Include realistic patient concerns, recovery progress, medications, vital signs, physician recommendations, discharge planning, and monitoring where appropriate.
- Patients should naturally ask questions about:
  - medications
  - side effects
  - pain
  - recovery expectations
  - discharge
  - mobility
  - diet
  - follow-up appointments
  - warning signs to watch for
- The learner should respond with empathy while maintaining professional boundaries.
- Include opportunities for reassurance, patient education, and relationship-building through natural conversation.
- Where appropriate, include brief, natural small talk that helps build rapport (e.g., family, hobbies, meals, weather, weekend plans), while maintaining professional boundaries and keeping the patient's care as the primary focus.

6. Learning Objective

The learner's objective is to develop automatic, confident, and natural communication during patient follow-up conversations.

The roleplay should encourage the learner to:

- recognize patient concerns and recovery needs
- explain medications and treatment plans clearly
- answer patient questions confidently
- educate patients using easy-to-understand language
- provide reassurance while maintaining professional boundaries
- use accurate patient-care terminology naturally

7. Output Format

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
	admitting_patient: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

Generate exactly 10 - 15 pronunciation items according to the following rules:

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
- If additional words are needed, supplement with vocabulary commonly used during patient admissions.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while greeting patients, verifying identity, completing admissions, explaining procedures, collecting medical history, and answering patient questions.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect patient admission conversations.
- Use realistic patient names, admission reasons, allergies, medical history, medications, identification checks, vital signs, physician instructions, or hospital procedures where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Introduce themselves clearly by stating their name and role confidently and professionally.
- Explain the purpose of the admission, what will happen during the process, and what the patient should expect.
- Confirm the patient's identity correctly using at least two identifiers, such as the patient's full name and date of birth, before providing care.
- Encourage the patient to ask questions or express concerns and respond in a supportive and professional manner.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - patient identification
  - admission procedures
  - medical history
  - medications
  - allergies
  - assessments
  - hospital routines
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to patient admissions.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural clinical sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{weak_words}}

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

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during patient admissions.
- Every sentence should sound like authentic communication or documentation used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear during the admission process.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Introduce themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the admission, what will happen during the process, and what the patient should expect.
- Confirms the patient's identity correctly using at least two identifiers, such as the patient's full name and date of birth, before providing care.
- Encourages the patient to ask questions or express concerns and respond in a supportive and professional manner.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to strengthen recognition and understanding of vocabulary commonly used during patient admissions while improving professional communication.

- Every option must be authentic clinical vocabulary.
- The correct answer must be unambiguously correct for the specific admission scenario.
- Incorrect answers should be plausible but incorrect because of incorrect patient identification, admission procedure, documentation, assessment, communication, or clinical meaning.
- Every sentence should reflect realistic patient admission situations in hospitals.

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

- The conversation should reflect realistic patient admission situations in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses and patients, family members, physicians, or other healthcare professionals where appropriate.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that a competent nurse could realistically say.
- The learner must identify the MOST professional, concise, patient-centred, and appropriate response for the admission situation.

The correct answer should demonstrate one or more of the following competencies:

- Introduces themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the admission, what will happen during the process, and what the patient should expect.
- Confirms the patient's identity correctly using at least two identifiers, such as the patient's full name and date of birth, before providing care.
- Encourages the patient to ask questions or express concerns and responds in a supportive, respectful, and professional manner.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication during patient admissions through repeated practice in realistic clinical scenarios.

- Every option should sound like something a professional nurse could realistically say.
- The correct answer must be unambiguously the best response for the specific admission scenario.
- Incorrect answers should be plausible but incorrect because of incomplete patient identification, insufficient explanation, poor communication, inappropriate sequencing of the admission process, or missed opportunities to encourage patient questions—not because they sound unprofessional.
- Every prompt must contain enough clinical detail that only one response is the best choice.
- Include situations where the nurse builds rapport through empathy, reassurance, and respectful conversation while maintaining professional boundaries.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Patient, Family Member, Doctor, Incoming Nurse}}",
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

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic patient admission situations in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new admission scenario.
- The student always plays the nurse.
- The scenario should progress naturally from greeting the patient to completing the admission process, answering questions, and preparing the patient for the next stage of care.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Mr. David Thompson
  - Mrs. Linda Garcia
  - Dr. James Wilson
  - Emily Rodriguez
  - Sarah Chen
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Introduces themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the admission, what will happen during the process, and what the patient should expect.
- Confirms the patient's identity correctly using at least two identifiers, such as the patient's full name and date of birth, before providing care.
- Encourages the patient to ask questions or express concerns and responds in a supportive and professional manner.

5. Realism

- Include realistic admission activities such as verifying patient identity, reviewing the reason for admission, collecting medical history, confirming allergies, reviewing current medications, explaining hospital procedures, obtaining baseline vital signs, and discussing the immediate plan of care where appropriate.
- Patients should naturally ask questions about the admission process, room arrangements, hospital routines, tests, medications, visiting hours, or what will happen next.
- Include opportunities for the learner to reassure the patient, build rapport, and create a welcoming environment while maintaining professional boundaries.

6. Learning Objective

The learner's objective is to develop automatic, confident, and natural communication during patient admissions.

The roleplay should encourage the learner to:

- introduce themselves professionally
- explain the admission process clearly
- verify patient identity correctly
- answer patient questions confidently
- build rapport through warm, respectful communication
- maintain patient safety and professionalism throughout the admission process

7. Output Format

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
	small_talk_patient: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

Generate exactly 10 - 15 pronunciation items according to the following rules:

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
- If additional words are needed, supplement with vocabulary commonly used during bedside conversations and patient interactions.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while greeting patients, engaging in small talk, discussing medications, explaining care, answering questions, providing reassurance, and speaking with family members.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples, isolated vocabulary, or dictionary definitions.
- Every sentence should naturally reflect bedside conversations with patients or family members.
- Use realistic patient names, medications, recovery progress, discharge plans, daily routines, hobbies, meals, family visits, physician recommendations, or patient education where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:

- Use appropriate social language by speaking naturally and conversationally without sounding overly formal or robotic.
- Respond naturally in conversation by maintaining smooth conversational flow while adapting to patient questions and comments.
- Maintain professionalism by keeping appropriate boundaries, a respectful tone, and professional bedside behaviour throughout the interaction.
- Encourage patient comfort and engagement by helping the patient feel relaxed, included, and willing to continue the conversation.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common conversational vocabulary and moderately difficult clinical terminology.
- Include words from different communication categories such as:
  - greetings
  - patient education
  - medications
  - recovery
  - discharge
  - reassurance
  - bedside conversation
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to bedside conversations.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical or conversational word}}",
    "sentence": "{{natural bedside conversation sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a fill-in-the-blank vocabulary drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week: {{weak_words}}

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

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during bedside conversations and patient interactions.
- Every sentence should sound like authentic communication used in hospitals in {{country}}.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough conversational and clinical context that only one answer is correct.
- Use full medical terminology rather than abbreviations wherever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four options legitimate clinical or patient-care vocabulary.
- At least half of the questions should contain two or more answers that could realistically appear during bedside conversations.
- The learner must identify the vocabulary word that best completes the sentence.

The correct answer should reinforce one or more of the following competencies:

- Uses appropriate social language by speaking naturally and conversationally without sounding overly formal or robotic.
- Responds naturally in conversation by maintaining smooth conversational flow while addressing patient questions or comments.
- Maintains professionalism by keeping appropriate boundaries, a respectful tone, and professional bedside behaviour throughout the interaction.
- Encourages patient comfort and engagement by helping the patient feel relaxed, included, and willing to continue the conversation.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to strengthen recognition and understanding of vocabulary commonly used during bedside conversations while improving natural communication with patients.

- Every option must be authentic clinical or patient-care vocabulary.
- The correct answer must be unambiguously correct for the specific situation.
- Incorrect answers should be plausible but incorrect because of inappropriate word choice, inaccurate clinical meaning, poor conversational fit, or incorrect patient communication.
- Every sentence should reflect realistic conversations between nurses, patients, and family members in hospitals.

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

- The conversation should reflect realistic bedside conversations in hospitals in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses and patients, family members, physicians, or other healthcare professionals where appropriate.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses conversationally and clinically reasonable.
- At least half of the questions should contain two answers that a competent nurse could realistically say.
- The learner must identify the MOST natural, professional, empathetic, and appropriate response for the situation.

The correct answer should demonstrate one or more of the following competencies:

- Uses appropriate social language by speaking naturally and conversationally without sounding overly formal or robotic.
- Responds naturally in conversation by maintaining smooth conversational flow and adapting appropriately to the patient's comments or questions.
- Maintains professionalism by keeping appropriate boundaries, a respectful tone, and professional bedside behaviour throughout the interaction.
- Encourages patient comfort and engagement by helping the patient feel relaxed, included, and willing to continue the conversation.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to develop automatic, natural, and professional bedside communication through repeated practice in realistic patient conversations.

- Every option should sound like something a professional nurse could realistically say.
- The correct answer must be unambiguously the best response for the specific situation.
- Incorrect answers should be plausible but incorrect because of poor conversational flow, insufficient empathy, inappropriate boundaries, incomplete patient education, or less effective communication—not because they sound unprofessional.
- Every prompt must contain enough conversational and clinical context that only one response is the best choice.
- Include situations where the nurse builds rapport through empathy, encouragement, active listening, appropriate humour, or light conversation while maintaining professional boundaries.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Patient, Family Member, Doctor, Incoming Nurse}}",
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

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic bedside conversations between a nurse and patient in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new patient interaction.
- The student always plays the nurse.
- The scenario should progress naturally from greeting the patient to engaging in friendly conversation, answering questions, providing reassurance, and concluding the interaction professionally.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Mr. David Thompson
  - Mrs. Linda Garcia
  - Emily Rodriguez
  - Michael Patel
  - Sarah Chen
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Uses appropriate social language by speaking naturally and conversationally without sounding overly formal or robotic.
- Responds naturally in conversation by maintaining smooth conversational flow and adapting to the patient's comments and questions.
- Maintains professionalism by keeping appropriate boundaries, a respectful tone, and professional bedside behaviour throughout the interaction.
- Encourages patient comfort and engagement by helping the patient feel relaxed, included, and comfortable continuing the conversation.

5. Realism

- Include realistic bedside conversations before, during, or after routine patient care.
- Patients may ask questions about:
  - their health condition
  - medications
  - pain management
  - discharge plans
  - meals
  - sleep
  - family visits
  - hobbies
  - work
  - weather
  - weekend plans
  - life at home
- Include opportunities for the learner to build rapport through empathy, encouragement, appropriate humour, and friendly conversation while maintaining professional boundaries.
- Family members may occasionally join the conversation and ask appropriate questions.

6. Learning Objective

The learner's objective is to develop automatic, natural, and professional bedside communication while building rapport with patients.

The roleplay should encourage the learner to:

- use natural conversational English
- respond smoothly to patient comments and questions
- build trust through empathy and active listening
- reassure patients without making unrealistic promises
- maintain professional boundaries
- create a welcoming and supportive bedside environment

7. Output Format

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
